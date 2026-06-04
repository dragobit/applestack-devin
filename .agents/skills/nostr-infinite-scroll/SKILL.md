---
name: nostr-infinite-scroll
description: Build feed interfaces, implement pagination for Nostr events, or create social media-style infinite scroll experiences.
---

# Infinite Scroll for Nostr Feeds

For feed-like interfaces, implement infinite scroll with applesauce's `createTimelineLoader`. The loader handles Nostr's timestamp-based (`until`) pagination internally: each call fetches the next older block of events and pushes them into the global `eventStore`. You render **reactively** from `eventStore.timeline(filters)` — the list updates automatically as events arrive, and calling the loader again loads the next page.

This is a two-part pattern:

1. **Render reactively** from the `eventStore` with `use$(() => eventStore.timeline(filters), [deps])`. Timeline observables already emit a fresh, deduplicated, descending-ordered array on every change.
2. **Load older pages** by calling the timeline loader. Each call continues from where the previous one stopped; subscribe to the returned cold observable to fire the request.

```typescript
import { useCallback, useMemo, useState } from 'react';
import { use$ } from '@/hooks/use$';
import { useEventStore } from '@/hooks/useEventStore';
import { createTimelineLoader } from 'applesauce-loaders/loaders';
import { pool, eventStore } from '@/services/nostr';
import { extraRelays } from '@/services/settings';
import type { Filter } from 'applesauce-core/helpers';

export function useGlobalFeed(filters: Filter[] = [{ kinds: [1] }]) {
  const store = useEventStore();

  // Stable keys so the loader / timeline only re-create when inputs really change
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  const relays = useMemo(() => extraRelays.getValue(), []);

  // Reactive view of everything matching the filters that's in the store.
  // Emits a fresh, deduplicated, newest-first array on every change.
  const events = use$(
    () => store.timeline(filters),
    [store, filterKey],
  );

  // One timeline loader instance, recreated only when relays/filters change.
  const loader = useMemo(
    () => createTimelineLoader(pool, relays, filters, { limit: 20, eventStore }),
    [relays, filterKey],
  );

  const [loading, setLoading] = useState(false);

  // Load the next (older) page. Events flow into the store and render reactively.
  const loadMore = useCallback(() => {
    setLoading(true);
    loader().subscribe({
      complete: () => setLoading(false),
      error: () => setLoading(false),
    });
  }, [loader]);

  return { events: events ?? [], loadMore, loading };
}
```

> Note: `extraRelays` is a `BehaviorSubject` in `src/services/settings.ts`. The example snapshots it with `.getValue()` for a stable loader. If you want the feed to react to relay changes, read it with `use$(extraRelays)` and include it in the `loader` deps.

Example usage with an intersection observer for automatic loading:

```tsx
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { Skeleton } from '@/components/ui/skeleton';
import { useGlobalFeed } from '@/hooks/useGlobalFeed';

function GlobalFeed() {
  const { events, loadMore, loading } = useGlobalFeed([{ kinds: [1] }]);
  const { ref, inView } = useInView();

  // Trigger the initial page on mount, then load more as the sentinel scrolls in.
  useEffect(() => {
    if (inView && !loading) loadMore();
  }, [inView, loading, loadMore]);

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <PostCard key={event.id} event={event} />
      ))}

      {/* Sentinel: loading the next page when it enters the viewport */}
      <div ref={ref} className="py-4">
        {loading && <Skeleton className="h-20 w-full" />}
      </div>
    </div>
  );
}
```

## Why no manual de-duplication?

With the nostrify/TanStack approach you had to flatten pages and filter duplicate ids by hand. Here the `eventStore` is the single source of truth: every event the loader fetches is added to the store, which deduplicates by id, resolves replaceable events, and re-emits the `timeline` array. The component never sees a duplicate, so the `Set`-based filtering step is gone.

## Key points

- **`createTimelineLoader(pool, relays, filters, { limit, eventStore })`** returns a function. Each call loads the next older block; pass the `eventStore` so events are stored and rendered reactively.
- **Loaders are cold observables** — nothing fires until you `.subscribe()`. Calling `loader()` without subscribing does nothing.
- **Render from `eventStore.timeline(filters)`** via `use$`, not from the loader's emissions. The store handles ordering and de-duplication.
- **Memoize `filters`/`relays`** (or a stable JSON key) so the loader and timeline subscription aren't recreated every render.
- **Stop condition:** when a `loader()` call completes without emitting new events, you've reached the end of available history. Track that if you want to hide the loading sentinel; otherwise extra calls are cheap no-ops once exhausted.
