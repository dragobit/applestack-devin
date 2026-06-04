import type { ReactNode } from 'react';

interface ProfileHoverCardProps {
  pubkey: string;
  asChild?: boolean;
  children: ReactNode;
}

/**
 * Minimal profile hover card — a passthrough wrapper.
 *
 * A richer `ProfileHoverCard` would show an avatar, display name,
 * bio, follower count, and follow button on hover. To replicate,
 * wrap with `@/components/ui/hover-card` and pull metadata via
 * `useProfile(pubkey)` inside the hover content.
 */
export function ProfileHoverCard({ children }: ProfileHoverCardProps) {
  return <>{children}</>;
}
