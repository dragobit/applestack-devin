import type { ProfileContent } from 'applesauce-core/helpers';

/**
 * Get a display name for a user.
 * Uses profile.name if available, otherwise falls back to "Anonymous".
 * Visual truncation is handled by CSS (`truncate` class) on the containing element
 * to avoid breaking NIP-30 custom emoji shortcodes.
 */
export function getDisplayName(
  profile: ProfileContent | undefined,
  _pubkey: string,
): string {
  return profile?.name || 'Anonymous';
}
