import { nip19 } from 'nostr-tools';
import type { ProfileContent } from 'applesauce-core/helpers';

/**
 * Returns the internal URL for a user's profile page.
 *
 * Defaults to `/<npub1...>`, matching the template's `/:nip19`
 * route in AppRouter. If a user's profile has a `nip05` identifier
 * you want to prefer, swap the return statement accordingly
 * (e.g. `/@${nip05}` with a corresponding `/:handle` route).
 *
 * The `profile` argument is accepted for parity with richer
 * implementations that route by NIP-05 handle; the stub ignores it.
 */
export function useProfileUrl(pubkey: string, _profile?: ProfileContent): string {
  return `/${nip19.npubEncode(pubkey)}`;
}
