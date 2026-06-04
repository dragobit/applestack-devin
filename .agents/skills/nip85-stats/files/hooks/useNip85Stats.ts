import { useEffect } from "react";
import type { NostrEvent } from "nostr-tools";
import { use$ } from "@/hooks/use$";
import { useEventStore } from "@/hooks/useEventStore";
import { addressLoader } from "@/services/nostr";
import { extraRelays, nip85StatsPubkey } from "@/services/settings";

/** Engagement counts exposed by NIP-85 kind 30383 (events) and 30384 (addressable events). */
export interface Nip85EventStats {
  commentCount: number;
  repostCount: number;
  reactionCount: number;
  zapCount: number;
  /** Zap amount in sats. */
  zapAmount: number;
}

/** A subset of NIP-85 kind 30382 (user) stats — extend as needed. */
export interface Nip85UserStats {
  followers: number;
  postCount: number;
}

/**
 * Read an integer tag value from a NIP-85 assertion event. Returns 0 when missing
 * or unparseable, which mirrors the semantics of "no data" in NIP-85.
 */
function getIntTag(tags: string[][], tagName: string): number {
  const tag = tags.find(([name]) => name === tagName);
  if (!tag?.[1]) return 0;
  const n = parseInt(tag[1], 10);
  return Number.isFinite(n) ? n : 0;
}

function parseEventStats(event: NostrEvent): Nip85EventStats {
  const { tags } = event;
  return {
    commentCount: getIntTag(tags, "comment_cnt"),
    repostCount: getIntTag(tags, "repost_cnt"),
    reactionCount: getIntTag(tags, "reaction_cnt"),
    zapCount: getIntTag(tags, "zap_cnt"),
    zapAmount: getIntTag(tags, "zap_amount"),
  };
}

function parseUserStats(event: NostrEvent): Nip85UserStats {
  const { tags } = event;
  return {
    followers: getIntTag(tags, "followers"),
    postCount: getIntTag(tags, "post_cnt"),
  };
}

/**
 * Subscribe reactively to a NIP-85 assertion event and trigger a one-time load.
 *
 * Filtering by `authors: [statsPubkey]` is enforced by the `pubkey` field of the
 * address pointer — without it, anyone could publish a fake assertion with the
 * same `d` tag and the client would accept it.
 *
 * @param kind - 30382 (user), 30383 (event), or 30384 (addressable event)
 * @param identifier - the `d` tag value (pubkey hex / event id / "<kind>:<pubkey>:<d-tag>")
 * @returns the matching assertion event, or `undefined` while loading / when none exists
 */
function useNip85Assertion(
  kind: number,
  identifier: string | undefined,
): NostrEvent | undefined {
  const eventStore = useEventStore();
  // nip85StatsPubkey is a BehaviorSubject<string> (see src/services/settings.ts),
  // so use$ re-renders whenever the configured provider changes.
  const statsPubkey = use$(nip85StatsPubkey);

  const enabled = Boolean(identifier && statsPubkey);

  // Trigger a one-time load of the addressable assertion event. The loader is a
  // cold observable, so it only fires once subscribed; events flow into the
  // EventStore and the reactive model below picks them up.
  useEffect(() => {
    if (!enabled || !identifier || !statsPubkey) return;

    const sub = addressLoader({
      kind,
      pubkey: statsPubkey,
      identifier,
      relays: extraRelays.getValue(),
    }).subscribe({
      // Errors are non-fatal: NIP-85 is an optimization, not a source of truth.
      error: () => {},
    });

    return () => sub.unsubscribe();
  }, [enabled, kind, identifier, statsPubkey]);

  // Read the assertion reactively from the EventStore, constrained to the
  // trusted provider pubkey via the address pointer.
  return use$(() => {
    if (!enabled || !identifier || !statsPubkey) return undefined;
    return eventStore.replaceable({ kind, pubkey: statsPubkey, identifier });
  }, [eventStore, enabled, kind, identifier, statsPubkey]);
}

/**
 * Fetches NIP-85 event stats (kind 30383) from the configured stats pubkey.
 * Returns `null` when no stats pubkey is configured or the provider has no
 * assertion for this event; `undefined` while loading.
 */
export function useNip85EventStats(
  eventId: string | undefined,
): Nip85EventStats | null {
  const statsPubkey = use$(nip85StatsPubkey);
  const event = useNip85Assertion(30383, eventId);

  if (!eventId || !statsPubkey) return null;
  if (!event) return null;
  return parseEventStats(event);
}

/**
 * Fetches NIP-85 user stats (kind 30382) from the configured stats pubkey.
 * Returns `null` when no stats pubkey is configured or the provider has no
 * assertion for this pubkey.
 */
export function useNip85UserStats(
  pubkey: string | undefined,
): Nip85UserStats | null {
  const statsPubkey = use$(nip85StatsPubkey);
  const event = useNip85Assertion(30382, pubkey);

  if (!pubkey || !statsPubkey) return null;
  if (!event) return null;
  return parseUserStats(event);
}

/**
 * Fetches NIP-85 addressable event stats (kind 30384) from the configured
 * stats pubkey. The `addr` argument is the full NIP-01 event address string,
 * e.g. `30023:<pubkey>:<d-tag>`.
 */
export function useNip85AddrStats(
  addr: string | undefined,
): Nip85EventStats | null {
  const statsPubkey = use$(nip85StatsPubkey);
  const event = useNip85Assertion(30384, addr);

  if (!addr || !statsPubkey) return null;
  if (!event) return null;
  return parseEventStats(event);
}
