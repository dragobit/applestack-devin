import { lastValueFrom, toArray } from "rxjs";
import { mapEventsToStore } from "applesauce-core";
import type { NostrEvent } from "nostr-tools";

import { eventStore, pool } from "@/services/nostr";
import { extraRelays } from "@/services/settings";
import { usePolledFetch } from "@/hooks/usePolledFetch";
import { fetchTxDetail, nostrPubkeyToBitcoinAddress } from "@/lib/bitcoin";

/** A single verified on-chain zap, with the amount that actually paid the recipient on-chain. */
export interface OnchainZapEntry {
  /** The kind 8333 event. */
  event: NostrEvent;
  /** Bitcoin transaction id (lowercase hex). */
  txid: string;
  /** Pubkey of the sender (the 8333 event author). */
  senderPubkey: string;
  /** Pubkey of the recipient (from `p` tag). */
  recipientPubkey: string;
  /** Verified amount in sats — sum of tx outputs that pay the recipient's derived Taproot address. */
  amountSats: number;
  /** Sender's self-reported amount (may differ from verified). */
  claimedAmountSats: number;
  /** Comment from the 8333 event content. */
  comment: string;
  /** Unix timestamp of the 8333 event. */
  createdAt: number;
  /** Whether the Bitcoin tx is confirmed on-chain. */
  confirmed: boolean;
}

/** Parse the txid from a kind 8333 event's `i` tag. Returns null if missing or malformed. */
export function extractOnchainZapTxid(event: NostrEvent): string | null {
  const iTag = event.tags.find(
    ([n, v]) => n === "i" && typeof v === "string" && v.startsWith("bitcoin:tx:"),
  );
  if (!iTag?.[1]) return null;
  const txid = iTag[1].slice("bitcoin:tx:".length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(txid)) return null;
  return txid;
}

/** Parse the claimed amount (sats) from a kind 8333 event. */
export function extractOnchainZapClaimedAmount(event: NostrEvent): number {
  const tag = event.tags.find(([n]) => n === "amount");
  if (!tag?.[1]) return 0;
  const n = parseInt(tag[1], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Parse the recipient pubkey from a kind 8333 event (first `p` tag). */
export function extractOnchainZapRecipient(event: NostrEvent): string {
  const tag = event.tags.find(([n]) => n === "p");
  return tag?.[1] ?? "";
}

/**
 * Verify a kind 8333 on-chain zap event against the Bitcoin blockchain.
 *
 * Returns the verified amount (sum of tx outputs paying the recipient's
 * derived Taproot address) and confirmation status. Returns `null` if the
 * event is malformed or the transaction cannot be verified.
 *
 * A verified amount of 0 means the transaction exists but does not pay
 * the claimed recipient — callers should discard such events.
 */
export async function verifyOnchainZap(event: NostrEvent): Promise<OnchainZapEntry | null> {
  const txid = extractOnchainZapTxid(event);
  const recipientPubkey = extractOnchainZapRecipient(event);
  if (!txid || !recipientPubkey) return null;

  // Reject self-zaps (sender == recipient). The sender already controls the
  // destination address, so self-zaps are trivial to fabricate and contribute
  // nothing meaningful to zap totals.
  if (event.pubkey === recipientPubkey) return null;

  const recipientAddress = nostrPubkeyToBitcoinAddress(recipientPubkey);
  if (!recipientAddress) return null;

  let detail;
  try {
    detail = await fetchTxDetail(txid);
  } catch {
    return null;
  }

  const amountSats = detail.outputs
    .filter((o) => o.address === recipientAddress)
    .reduce((sum, o) => sum + o.value, 0);

  if (amountSats === 0) return null;

  const claimed = extractOnchainZapClaimedAmount(event);
  // If the sender is claiming more than the tx actually paid, cap it at the verified amount.
  const effectiveClaim = Math.min(claimed || amountSats, amountSats);

  return {
    event,
    txid,
    senderPubkey: event.pubkey,
    recipientPubkey,
    amountSats: effectiveClaim,
    claimedAmountSats: claimed,
    comment: event.content,
    createdAt: event.created_at,
    confirmed: detail.confirmed,
  };
}

/**
 * Fetch the raw kind 8333 events for a target, deduped to one canonical zap per
 * txid per target. Queries the configured relays via the applesauce relay pool
 * and pumps the results through the EventStore.
 */
async function fetchOnchainZapEvents(target: NostrEvent, aCoord: string): Promise<NostrEvent[]> {
  const filters: { kinds: number[]; "#e"?: string[]; "#a"?: string[]; limit: number }[] = [
    { kinds: [8333], "#e": [target.id], limit: 100 },
  ];
  if (aCoord) {
    filters.push({ kinds: [8333], "#a": [aCoord], limit: 100 });
  }

  // `pool.request` completes on EOSE; bound it with a timeout so a slow relay
  // doesn't hang the fetch. `toArray()` collects every event into one array.
  // (applesauce's request takes a numeric `timeout`, not an AbortSignal.)
  const events = await lastValueFrom(
    pool
      .request(extraRelays.getValue(), filters, { timeout: 5000 })
      .pipe(mapEventsToStore(eventStore), toArray()),
    { defaultValue: [] as NostrEvent[] },
  );

  // Dedupe by event id, then by txid (one canonical zap per tx per target).
  const byId = new Map<string, NostrEvent>();
  for (const e of events) byId.set(e.id, e);

  const byTxid = new Map<string, NostrEvent>();
  for (const e of byId.values()) {
    const txid = extractOnchainZapTxid(e);
    if (!txid) continue;
    const existing = byTxid.get(txid);
    // Prefer the earliest event for each txid (first to claim this tx).
    if (!existing || e.created_at < existing.created_at) {
      byTxid.set(txid, e);
    }
  }

  return Array.from(byTxid.values());
}

/**
 * Query all kind 8333 on-chain zaps targeting a specific event, then verify
 * each one on-chain. Returns only verified entries (deduped by txid).
 */
export function useOnchainZaps(target: NostrEvent | undefined) {
  const isAddressable = target && target.kind >= 30000 && target.kind < 40000;
  const dTag = isAddressable ? (target.tags.find(([n]) => n === "d")?.[1] ?? "") : "";
  const aCoord = isAddressable && target ? `${target.kind}:${target.pubkey}:${dTag}` : "";

  // Fetch the raw kind 8333 events, then verify each on-chain in parallel. The
  // whole pipeline runs as one polled async fetch (events + per-txid HTTP
  // verification) — the EventStore dedupes the Nostr side, and verification is
  // bounded by the explorer API.
  const { data, isLoading } = usePolledFetch<OnchainZapEntry[]>(
    `onchain-zaps:${target?.id ?? ""}:${aCoord}`,
    async () => {
      if (!target) return [];
      const events = await fetchOnchainZapEvents(target, aCoord);
      const results = await Promise.all(events.map((event) => verifyOnchainZap(event)));
      return results.filter((v): v is OnchainZapEntry => !!v);
    },
    { enabled: !!target },
  );

  const verified = data ?? [];

  // Sort by verified amount (largest first). Copy first so we don't mutate the
  // memoised fetch result in place.
  const sorted = [...verified].sort((a, b) => b.amountSats - a.amountSats);

  const totalSats = sorted.reduce((s, v) => s + v.amountSats, 0);

  return {
    zaps: sorted,
    totalSats,
    count: sorted.length,
    isLoading,
  };
}

/**
 * Verify a single kind 8333 event against the Bitcoin blockchain and return
 * the resulting `OnchainZapEntry`. Used by standalone surfaces (embedded
 * cards, detail page) that need to display a verified amount without doing
 * a full `#e`/`#a` fan-out.
 *
 * Returns `undefined` while loading, `null` if the event fails verification
 * (invalid tx, wrong recipient, self-zap, etc.), or the entry.
 */
export function useVerifiedOnchainZap(
  event: NostrEvent | undefined,
): OnchainZapEntry | null | undefined {
  const txid = event ? extractOnchainZapTxid(event) : null;
  const recipient = event ? extractOnchainZapRecipient(event) : "";

  const { data } = usePolledFetch<OnchainZapEntry | null>(
    `onchain-zaps-verify:${txid ?? ""}:${recipient}`,
    () => verifyOnchainZap(event!),
    { enabled: !!event && !!txid && !!recipient },
  );

  if (!event) return null;
  return data;
}
