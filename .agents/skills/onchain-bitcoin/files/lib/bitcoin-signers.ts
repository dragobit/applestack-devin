import type { IAccount } from "applesauce-accounts";
import { PrivateKeySigner, NostrConnectSigner } from "applesauce-signers";

import { signPsbtLocal } from "@/lib/bitcoin";

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

/**
 * Bitcoin PSBT signing for applesauce accounts.
 *
 * The nostrify template subclassed each Nostr signer class (`NSecSigner`,
 * `NBrowserSigner`, `NConnectSigner`) to add a `signPsbt` method. In applesauce
 * the active account's signer is constructed internally by the `AccountManager`
 * (see `src/hooks/useLoginActions.ts`), so we cannot swap in subclasses.
 *
 * Instead we dispatch on the account `type` and operate on `account.signer`
 * directly:
 *
 * - `"nsec"`          → `PrivateKeySigner`, whose private key is exposed as the
 *                       public `key: Uint8Array` field. We sign the PSBT locally.
 * - `"extension"`     → call `window.nostr.signPsbt()` (NIP-07 extension).
 * - `"nostr-connect"` → send a `sign_psbt` RPC over NIP-46.
 */

// ---------------------------------------------------------------------------
// Capability detection
// ---------------------------------------------------------------------------

/**
 * Account types this module knows how to derive Bitcoin signing from. Any other
 * account type (`readonly`, `serial`, `amber`, …) cannot sign PSBTs here.
 */
const BTC_SIGNABLE_TYPES = new Set(["nsec", "extension", "nostr-connect"]);

/** Runtime check for whether an account's type is structurally PSBT-capable. */
export function hasBtcSigning(account: IAccount | undefined | null): account is IAccount {
  return !!account && BTC_SIGNABLE_TYPES.has(account.type);
}

// ---------------------------------------------------------------------------
// nsec — local PrivateKeySigner signing
// ---------------------------------------------------------------------------

/**
 * Sign a Taproot PSBT locally using a `PrivateKeySigner`'s in-memory key.
 *
 * `PrivateKeySigner` exposes its secret key as the public `key: Uint8Array`
 * field, so we can read it directly and apply the BIP-341 TapTweak in
 * `signPsbtLocal`. (See `node_modules/applesauce-signers` — `private-key-signer`.)
 */
async function signPsbtNsec(signer: PrivateKeySigner, psbtHex: string): Promise<string> {
  const privateKeyHex = Buffer.from(signer.key).toString("hex");
  return signPsbtLocal(psbtHex, privateKeyHex);
}

// ---------------------------------------------------------------------------
// extension — NIP-07 window.nostr.signPsbt
// ---------------------------------------------------------------------------

/**
 * Sign a PSBT via the NIP-07 browser extension's `window.nostr.signPsbt()`.
 *
 * If the extension does not expose `signPsbt`, an error is thrown with a
 * user-friendly message that flips the UI into the unsupported state.
 */
async function signPsbtExtension(psbtHex: string): Promise<string> {
  const nostr = (globalThis as { nostr?: Record<string, unknown> }).nostr;

  if (!nostr || typeof nostr.signPsbt !== "function") {
    throw new Error(
      "Your browser extension doesn't support sending Bitcoin. Try a different extension, or log in with your secret key.",
    );
  }

  const signPsbt = nostr.signPsbt as (hex: string) => Promise<string>;
  return signPsbt(psbtHex);
}

// ---------------------------------------------------------------------------
// nostr-connect — NIP-46 sign_psbt RPC
// ---------------------------------------------------------------------------

/**
 * Heuristics for detecting whether a NIP-46 `sign_psbt` error reflects a
 * missing-capability rejection (e.g. "method not supported", "unknown
 * command") versus a transient operational failure (network, user rejection,
 * malformed input). We have to match on strings because NIP-46 errors are
 * plain strings without structured codes.
 */
const CAPABILITY_ERROR_PATTERNS = [
  /unknown\s+(method|command)/i,
  /not\s+(implemented|supported|found)/i,
  /unsupported\s+method/i,
  /method\s+not\s+found/i,
  /invalid\s+method/i,
  /no\s+such\s+method/i,
];

function looksLikeCapabilityError(msg: string): boolean {
  return CAPABILITY_ERROR_PATTERNS.some((re) => re.test(msg));
}

/**
 * Sign a PSBT via a NIP-46 `sign_psbt` RPC sent over the remote-signer channel.
 *
 * `NostrConnectSigner` has no public method for arbitrary RPCs, so we call the
 * `makeRequest(method, params)` method — TypeScript-private but JavaScript-public
 * at runtime (the applesauce equivalent of nostrify's private `cmd`). The remote
 * signer handles the TapTweak and Schnorr signing internally.
 *
 * NIP-46 returns unstructured string errors, so we use pattern matching to
 * distinguish capability failures (the signer doesn't know the method) from
 * operational failures (network, user rejection, bad input). Only capability
 * failures are re-wrapped with the "doesn't support sending Bitcoin" message
 * that flips the UI into the unsupported state; everything else propagates
 * unchanged so the caller can surface the real error.
 *
 * PORT-NOTE: `makeRequest` is a TS-private method accessed via a runtime cast.
 * Confirm against the installed applesauce-signers version that the remote
 * signer protocol method is named `sign_psbt` and takes `[psbtHex]` as params
 * (this matches the original nostrify NIP-46 `cmd('sign_psbt', [psbtHex])`
 * call, but applesauce does not define `sign_psbt` itself — it relies on the
 * remote signer implementing it).
 */
async function signPsbtNostrConnect(signer: NostrConnectSigner, psbtHex: string): Promise<string> {
  // `makeRequest` is TypeScript-private but JavaScript-public at runtime.
  const makeRequest = (
    signer as unknown as { makeRequest(method: string, params: string[]): Promise<string> }
  ).makeRequest;

  try {
    return await makeRequest.call(signer, "sign_psbt", [psbtHex]);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (looksLikeCapabilityError(msg)) {
      throw new Error(
        `Your remote signer doesn't support sending Bitcoin. Update your signer, or log in with your secret key. (${msg})`,
      );
    }
    // Not a capability failure — propagate the original error so the user
    // sees the actual reason (timeout, rejection, malformed PSBT, etc.).
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Sign a hex-encoded unsigned PSBT using the given account, dispatching on the
 * account's login type. Returns the hex-encoded signed (but not finalized) PSBT.
 *
 * Throws if the account type cannot sign PSBTs.
 */
export async function signPsbtWithAccount(account: IAccount, psbtHex: string): Promise<string> {
  switch (account.type) {
    case "nsec":
      return signPsbtNsec(account.signer as PrivateKeySigner, psbtHex);
    case "extension":
      return signPsbtExtension(psbtHex);
    case "nostr-connect":
      return signPsbtNostrConnect(account.signer as NostrConnectSigner, psbtHex);
    default:
      throw new Error(
        "Your login doesn't support sending Bitcoin. Log in with your secret key to send Bitcoin zaps.",
      );
  }
}
