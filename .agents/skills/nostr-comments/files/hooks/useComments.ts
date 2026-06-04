import { useMemo } from "react";
import { use$ } from "@/hooks/use$";
import { useEventStore } from "@/hooks/useEventStore";
import { pool } from "@/services/nostr";
import { extraRelays } from "@/services/settings";
import { mapEventsToStore, mapEventsToTimeline } from "applesauce-core";
import {
  createReplaceableAddress,
  isAddressableKind,
  isReplaceableKind,
} from "applesauce-core/helpers";
import type { Filter } from "applesauce-core/helpers";
import type { NostrEvent } from "nostr-tools";

export interface CommentsData {
  /** Every kind 1111 comment loaded for this root (all depths) */
  allComments: NostrEvent[];
  /** Comments that reply directly to the root, newest first */
  topLevelComments: NostrEvent[];
  /** All descendants of a comment, oldest first (recursive) */
  getDescendants: (commentId: string) => NostrEvent[];
  /** Direct replies to a comment, oldest first */
  getDirectReplies: (commentId: string) => NostrEvent[];
}

/** Get the relay-level filter that matches every comment referencing the root */
function buildCommentsFilter(
  root: NostrEvent | URL | `#${string}`,
  limit?: number,
): Filter {
  const filter: Filter = { kinds: [1111] };

  if (typeof root === "string") {
    filter["#I"] = [root];
  } else if (root instanceof URL) {
    filter["#I"] = [root.toString()];
  } else if (isAddressableKind(root.kind)) {
    const d = root.tags.find(([name]) => name === "d")?.[1] ?? "";
    filter["#A"] = [createReplaceableAddress(root.kind, root.pubkey, d)];
  } else if (isReplaceableKind(root.kind)) {
    filter["#A"] = [createReplaceableAddress(root.kind, root.pubkey, "")];
  } else {
    filter["#E"] = [root.id];
  }

  if (typeof limit === "number") filter.limit = limit;

  return filter;
}

/** Get the tag value used to match a top-level comment against the root */
function rootMatcher(
  root: NostrEvent | URL | `#${string}`,
): { tag: string; value: string } {
  if (typeof root === "string") return { tag: "i", value: root };
  if (root instanceof URL) return { tag: "i", value: root.toString() };
  if (isAddressableKind(root.kind)) {
    const d = root.tags.find(([name]) => name === "d")?.[1] ?? "";
    return { tag: "a", value: createReplaceableAddress(root.kind, root.pubkey, d) };
  }
  if (isReplaceableKind(root.kind)) {
    return {
      tag: "a",
      value: createReplaceableAddress(root.kind, root.pubkey, ""),
    };
  }
  return { tag: "e", value: root.id };
}

const getTagValue = (event: NostrEvent, tagName: string): string | undefined =>
  event.tags.find(([name]) => name === tagName)?.[1];

/** Build the threaded {@link CommentsData} structure from a flat list of comments */
function buildCommentsData(
  events: NostrEvent[],
  root: NostrEvent | URL | `#${string}`,
): CommentsData {
  const { tag, value } = rootMatcher(root);

  // Top-level comments reference the root directly via their lowercase reply tag
  const topLevelComments = events
    .filter((comment) => getTagValue(comment, tag) === value)
    .sort((a, b) => b.created_at - a.created_at);

  const getDirectReplies = (commentId: string): NostrEvent[] =>
    events
      .filter((comment) => getTagValue(comment, "e") === commentId)
      .sort((a, b) => a.created_at - b.created_at);

  const getDescendants = (parentId: string): NostrEvent[] => {
    const directReplies = getDirectReplies(parentId);
    const all = [...directReplies];
    for (const reply of directReplies) all.push(...getDescendants(reply.id));
    return all;
  };

  return {
    allComments: events,
    topLevelComments,
    getDescendants,
    getDirectReplies,
  };
}

/**
 * Reactively load NIP-22 (kind 1111) comments for a root event, URL, or hashtag.
 *
 * Comments are fetched from the configured relays into the global EventStore and
 * read back reactively, so new and deleted comments update the UI automatically.
 *
 * @param root - The event, URL, or `#hashtag` being commented on
 * @param limit - Maximum number of comments to load (relay-level)
 */
export function useComments(
  root: NostrEvent | URL | `#${string}`,
  limit?: number,
): { data: CommentsData | undefined; isLoading: boolean } {
  const store = useEventStore();

  const rootKey =
    root instanceof URL
      ? root.toString()
      : typeof root === "string"
        ? root
        : root.id;

  const filter = useMemo(
    () => buildCommentsFilter(root, limit),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rootKey, limit],
  );

  // Subscribe to relays to populate the store, then read the matching timeline
  // back from the store so the result stays reactive to new/deleted comments.
  const events = use$(
    () =>
      pool
        .subscription(extraRelays.getValue(), filter)
        .pipe(mapEventsToStore(store), mapEventsToTimeline()),
    [filter, store],
  );

  const data = useMemo(
    () => (events ? buildCommentsData(events, root) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, rootKey],
  );

  return { data, isLoading: events === undefined };
}
