import { useMemo } from "react";
import { use$ } from "./use$";
import { useEventStore } from "./useEventStore";
import { Note } from "applesauce-common/casts";
import { castTimelineStream } from "applesauce-common/observable";
import { mapEventsToStore, mapEventsToTimeline } from "applesauce-core";
import { pool } from "@/services/nostr";
import type { Filter } from "applesauce-core/helpers";

/**
 * Subscribe to a timeline of events from relays.
 * Events are automatically cast to Note objects with reactive properties.
 *
 * @param relays - Array of relay URLs to query
 * @param filters - Nostr filter objects
 * @returns Array of Note casts, or undefined while loading
 *
 * @example
 * ```tsx
 * import { useTimeline } from '@/hooks/useTimeline';
 *
 * function Timeline() {
 *   const notes = useTimeline(
 *     ['wss://relay.damus.io'],
 *     [{ kinds: [1], limit: 20 }]
 *   );
 *
 *   if (!notes) return <Loading />;
 *
 *   return (
 *     <div>
 *       {notes.map(note => (
 *         <NoteCard key={note.id} note={note} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTimeline(
  relays: string[],
  filters: Filter[],
): Note[] | undefined {
  const store = useEventStore();

  // Memoize the filters to prevent unnecessary re-subscriptions
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  const relayKey = useMemo(() => JSON.stringify(relays), [relays]);

  const notes = use$(
    () =>
      pool.subscription(relays, filters).pipe(
        mapEventsToStore(store), // Add events to store and deduplicate
        mapEventsToTimeline(), // Collect events into an array
        // @ts-expect-error - Cast type compatibility with EventStore
        castTimelineStream(Note, store), // Cast to Note objects
      ),
    [relayKey, filterKey, store],
  );

  return notes ?? undefined;
}

/**
 * Subscribe to a local timeline from the EventStore.
 * Only returns events already in the store, does not query relays.
 *
 * @param filters - Nostr filter objects
 * @returns Array of Note casts
 *
 * @example
 * ```tsx
 * import { useLocalTimeline } from '@/hooks/useTimeline';
 *
 * function CachedTimeline() {
 *   const notes = useLocalTimeline([{ kinds: [1], limit: 20 }]);
 *
 *   return (
 *     <div>
 *       {notes?.map(note => (
 *         <NoteCard key={note.id} note={note} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLocalTimeline(filters: Filter[]): Note[] | undefined {
  const store = useEventStore();

  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  const notes = use$(
    () =>
      store.timeline(filters).pipe(
        // @ts-expect-error - Cast type compatibility with EventStore
        castTimelineStream(Note, store),
      ),
    [filterKey, store],
  );

  return notes ?? undefined;
}
