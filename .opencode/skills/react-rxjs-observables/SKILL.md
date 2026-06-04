---
name: react-rxjs-observables
description: Use RxJS observables in React components with the use$ hook from applesauce-react
license: MIT
compatibility: opencode
metadata:
  framework: react
  library: applesauce
  audience: developers
---

# Using RxJS Observables in React Components

This skill teaches you how to integrate RxJS observables into React components using the `use$` hook from `applesauce-react`.

## What I do

- Show you how to subscribe to observables and automatically manage their lifecycle
- Explain the factory function pattern with dependencies for reactive data
- Cover common patterns like chained observables, side effects, and conditional subscriptions
- Help you avoid common mistakes with dependency arrays and re-subscriptions
- Guide you through loading states, error handling, and performance optimization

## When to use me

Use this skill when you need to:

- Subscribe to RxJS observables in React components
- Work with Applesauce models (ProfileModel, ThreadModel, CommentsModel, etc.)
- Access reactive properties from casts like `note.author.profile$`, `user.contacts$`, etc.
- Set up relay subscriptions or event loaders
- Combine multiple observables with `combineLatest`, `switchMap`, or other RxJS operators
- Debug infinite re-subscription loops or stale data issues

## Core Hook: `use$`

Import from your hooks directory:

```typescript
import { use$ } from "@/hooks/use$";
```

### Type Signatures

```typescript
// Direct BehaviorSubject - always returns a value
use$<T>(observable?: BehaviorSubject<T>): T

// Direct Observable - may return undefined if no value emitted yet
use$<T>(observable?: Observable<T>): T | undefined

// Factory function with dependencies - MOST COMMON
use$<T>(factory: () => Observable<T> | undefined, deps: any[]): T | undefined
```

## Usage Patterns

### Pattern 1: Factory Function

**This is the most common pattern.** Use when the observable depends on props, state, or context:

```tsx
import { use$ } from "@/hooks/use$";
import { useEventStore } from "@/hooks/useEventStore";
import { ProfileModel } from "applesauce-core/models";

function UserProfile({ pubkey }: { pubkey: string }) {
  const store = useEventStore();

  // Factory recreates observable when pubkey or store changes
  const profile = use$(
    () => store.model(ProfileModel, pubkey),
    [pubkey, store],
  );

  if (!profile) return <Skeleton />;

  return <div>{profile.name}</div>;
}
```

### Pattern 2: Direct Observable

Use for global observables that don't need to be recreated:

```tsx
import { use$ } from "@/hooks/use$";
import { BehaviorSubject } from "rxjs";

const theme$ = new BehaviorSubject<"light" | "dark">("light");

function ThemeDisplay() {
  const theme = use$(theme$);
  return <div>Theme: {theme}</div>;
}
```

### Pattern 3: Nested Cast Properties

Applesauce casts expose properties as **chainable observables** - observables that can be directly subscribed to without wrapping in a factory:

```tsx
import { use$ } from "@/hooks/use$";
import { Note } from "applesauce-common/casts";

function NoteCard({ note }: { note: Note }) {
  // Subscribe to chainable observables directly (no factory needed)
  const profile = use$(note.author.profile$);
  const reactions = use$(note.reactions$);
  const zaps = use$(note.zaps$);

  return (
    <div>
      <h3>{profile?.displayName ?? profile?.name ?? "Anonymous"}</h3>
      <p>{note.content}</p>
      <span>{reactions?.length ?? 0} reactions</span>
      <span>{zaps?.length ?? 0} zaps</span>
    </div>
  );
}
```

**Key Point:** Cast properties ending with `$` are chainable observables that update automatically when related events change.

### Pattern 4: Side Effects and Loaders

Use `use$` to trigger side effects like loading missing events:

```tsx
import { use$ } from "@/hooks/use$";
import { pool } from "@/services/pool";
import { onlyEvents, mapEventsToStore } from "applesauce-relay";

function ArticleComments({ article }: { article: Article }) {
  // Subscribe to comments for side effects (loading them into store)
  use$(() => {
    if (!article) return;
    return pool
      .relay("wss://relay.damus.io")
      .subscription({
        kinds: [1111],
        "#a": [`30023:${article.author.pubkey}:${article.identifier}`],
      })
      .pipe(onlyEvents(), mapEventsToStore(eventStore));
  }, [article?.id]);

  // Then query comments from the store
  const comments = use$(
    () => eventStore.model(CommentsModel, article.event),
    [article.id],
  );

  return <CommentsList comments={comments} />;
}
```

### Pattern 5: Chained Observables

Combine multiple observables with RxJS operators:

```tsx
import { use$ } from "@/hooks/use$";
import { combineLatest } from "rxjs";
import { map } from "rxjs/operators";

function ContactsWithRelays({ pubkey }: { pubkey: string }) {
  const store = useEventStore();

  const contacts = use$(() => {
    const user = store.castUser(pubkey);
    return user ? user.contacts$ : undefined;
  }, [pubkey, store]);

  // Combine each contact's outboxes
  const contactsWithOutboxes = use$(() => {
    if (!contacts) return undefined;

    return combineLatest(
      contacts.map((contact) =>
        contact.outboxes$.pipe(map((outboxes) => ({ contact, outboxes }))),
      ),
    );
  }, [contacts?.map((c) => c.pubkey).join(",")]);

  return <div>...</div>;
}
```

## Dependency Arrays: Critical Rules

The dependency array controls when the observable is recreated.

### ✅ DO: Include all variables used in factory

```tsx
const profile = use$(
  () => store.model(ProfileModel, pubkey),
  [pubkey, store], // Both used in factory
);
```

### ✅ DO: Serialize arrays and objects

```tsx
// For arrays - use .join()
const events = use$(
  () => pool.req(relays, filters),
  [relays.join(","), JSON.stringify(filters)],
);

// For optional arrays - use optional chaining
const data = use$(
  () => fetchData(contacts),
  [contacts?.map((c) => c.pubkey).join(",")],
);
```

### ❌ DON'T: Pass array/object references directly

```tsx
// WRONG - infinite re-subscriptions!
const events = use$(
  () => pool.req(relays, filters),
  [relays, filters], // References change every render
);
```

### ❌ DON'T: Omit dependencies

```tsx
// WRONG - stale data!
const profile = use$(
  () => store.model(ProfileModel, pubkey),
  [], // pubkey changes won't update!
);
```

## Loading States

`use$` returns `undefined` while waiting for the first value:

```tsx
function UserProfile({ pubkey }: { pubkey: string }) {
  const profile = use$(() => store.model(ProfileModel, pubkey), [pubkey]);

  // Always handle undefined
  if (!profile) {
    return <Skeleton />;
  }

  return <div>{profile.name}</div>;
}
```

**Exception:** BehaviorSubjects always have a current value:

```tsx
const theme$ = new BehaviorSubject("light");
const theme = use$(theme$); // Never undefined
```

## Common Mistakes to Avoid

### 1. Missing Dependencies

```tsx
// ❌ WRONG
const profile = use$(() => store.model(ProfileModel, pubkey), []);

// ✅ CORRECT
const profile = use$(() => store.model(ProfileModel, pubkey), [pubkey, store]);
```

### 2. Unstable Dependencies

```tsx
// ❌ WRONG
const events = use$(() => store.timeline(filters), [filters]);

// ✅ CORRECT
const events = use$(() => store.timeline(filters), [JSON.stringify(filters)]);
```

### 3. Conditional Hook Calls

```tsx
// ❌ WRONG - breaks rules of hooks
if (condition) {
  const data = use$(observable$);
}

// ✅ CORRECT
const data = use$(() => (condition ? observable$ : undefined), [condition]);
```

### 4. Not Handling Undefined

```tsx
// ❌ WRONG - runtime error
const profile = use$(() => store.model(ProfileModel, pubkey), [pubkey]);
return <div>{profile.name}</div>; // Error if undefined!

// ✅ CORRECT
const profile = use$(() => store.model(ProfileModel, pubkey), [pubkey]);
return <div>{profile?.name ?? "Loading..."}</div>;
```

## Performance Tips

### Avoid Creating New Arrays in Dependencies

```tsx
// ❌ Bad - creates new array every render
const pubkeys = items.map((i) => i.pubkey);
const data = use$(() => fetch(pubkeys), [pubkeys]);

// ✅ Good - stable string reference
const data = use$(
  () => fetch(items.map((i) => i.pubkey)),
  [items.map((i) => i.pubkey).join(",")],
);
```

### Memoize Complex Objects

```tsx
const stableKey = useMemo(
  () => JSON.stringify(complexConfig),
  [complexConfig.field1, complexConfig.field2],
);

const data = use$(() => fetchData(complexConfig), [stableKey]);
```

### Clone Arrays for Timeline Updates

**CRITICAL:** EventStore timelines return the same array reference. Clone the array to trigger React updates:

```tsx
import { map } from "rxjs";

// ✅ Good - clone array to trigger React updates
const notes = use$(
  () =>
    eventStore.timeline({ kinds: [1] }).pipe(map((timeline) => [...timeline])),
  [],
);

// ❌ Bad - React may not detect updates (same reference)
const notes = use$(() => eventStore.timeline({ kinds: [1] }), []);
```

### Avoid Creating Observables in Render

Don't create new observables during render - use the factory pattern:

```tsx
// ❌ Bad - creates new observable every render
function Profile({ pubkey }) {
  const profile = use$(eventStore.profile(pubkey));
  return <div>{profile?.name}</div>;
}

// ✅ Good - factory creates observable once, recreates on pubkey change
function Profile({ pubkey }) {
  const profile = use$(() => eventStore.profile(pubkey), [pubkey]);
  return <div>{profile?.name}</div>;
}
```

### Memoize Loaders

Always memoize timeline loaders to prevent recreation:

```tsx
import { useMemo, useEffect } from "react";
import { createTimelineLoader } from "applesauce-loaders/loaders";

function Timeline({ relays }) {
  const loader = useMemo(
    () =>
      createTimelineLoader(pool, {
        relays,
        filters: [{ kinds: [1], limit: 50 }],
      }),
    [relays.join(",")],
  );

  useEffect(() => {
    const sub = loader.timeline$.subscribe();
    return () => sub.unsubscribe();
  }, [loader]);

  const events = use$(
    () =>
      eventStore
        .timeline({ kinds: [1] })
        .pipe(map((timeline) => [...timeline])),
    [],
  );

  return <div>{events?.map(renderEvent)}</div>;
}
```

### Debounce High-Frequency Updates

Use RxJS operators to control update frequency:

```tsx
import { debounceTime } from "rxjs";

function LiveFeed({ relay }) {
  const events = use$(
    () =>
      pool
        .relay(relay)
        .subscription({ kinds: [1] })
        .pipe(
          onlyEvents(),
          debounceTime(500), // Update UI every 500ms max
          mapEventsToTimeline(),
        ),
    [relay],
  );

  return <div>{events?.length || 0} events</div>;
}
```

## Error Handling

Errors from observables are thrown and caught by React Error Boundaries:

```tsx
import { ErrorBoundary } from "react-error-boundary";

function App() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <ComponentWithObservable />
    </ErrorBoundary>
  );
}
```

## Additional Best Practices

### Conditional Subscriptions

Return `undefined` or `EMPTY` to skip subscriptions when conditions aren't met:

```tsx
import { EMPTY } from "rxjs";

function Timeline({ relay, isLive }) {
  const events = use$(
    () => (isLive ? pool.relay(relay).subscription({ kinds: [1] }) : EMPTY),
    [relay, isLive],
  );

  return <div>{events?.length || 0} events</div>;
}
```

### Handle Undefined vs Null

Remember that `use$` returns `undefined` until the observable emits:

```tsx
function Profile({ pubkey }: { pubkey: string }) {
  const profile = use$(() => eventStore.profile(pubkey), [pubkey]);

  // undefined = still loading
  if (profile === undefined) {
    return <Skeleton />;
  }

  // null or no profile data = not found
  if (!profile) {
    return <div>Profile not found</div>;
  }

  return <div>{profile.displayName}</div>;
}
```

### Use BehaviorSubject for Always-Available Values

For values that should always be available (like current user), use `BehaviorSubject`:

```tsx
import { BehaviorSubject } from "rxjs";

// BehaviorSubject always has a value
const user$ = new BehaviorSubject<User | null>(null);
const user = use$(user$); // user is User | null, never undefined

// Regular Observable might not have emitted yet
const user$ = new Subject<User>();
const user = use$(user$); // user is User | undefined
```

## Quick Reference

| Pattern             | When to Use                                   | Example                                       |
| ------------------- | --------------------------------------------- | --------------------------------------------- |
| Factory function    | Observable depends on props/state             | `use$(() => store.model(Model, id), [id])`    |
| Direct observable   | Global observable, no dependencies            | `use$(globalObservable$)`                     |
| Chainable props     | Cast properties like `profile$`, `reactions$` | `use$(note.author.profile$)`                  |
| Side effects        | Relay subscriptions, loaders                  | `use$(() => pool.subscription(...), [deps])`  |
| Chained observables | Combining multiple sources                    | `use$(() => combineLatest([...]), [deps])`    |
| Conditional         | Optional observable                           | `use$(() => cond ? obs$ : undefined, [cond])` |

## Working with EventStore and RelayPool

### EventStore Methods

Common EventStore methods that work with `use$`:

```tsx
import { use$ } from "@/hooks/use$";
import { useEventStore } from "@/hooks/useEventStore";
import { ProfileModel, CommentsModel, ZapsModel } from "applesauce-core/models";

function Examples({ pubkey, eventId, filters }) {
  const store = useEventStore();

  // Get a single event by ID
  const event = use$(() => store.event(eventId), [eventId, store]);

  // Get a user profile
  const profile = use$(
    () => store.model(ProfileModel, pubkey),
    [pubkey, store],
  );

  // Get comments for an event
  const comments = use$(
    () => store.model(CommentsModel, event),
    [event?.id, store],
  );

  // Get a timeline of events
  const timeline = use$(
    () => store.timeline(filters).pipe(map((t) => [...t])),
    [JSON.stringify(filters), store],
  );

  return <div>...</div>;
}
```

### RelayPool Subscriptions

Subscribe to relay subscriptions with `use$`:

```tsx
import { use$ } from "@/hooks/use$";
import { pool } from "@/services/pool";
import {
  onlyEvents,
  mapEventsToStore,
  mapEventsToTimeline,
} from "applesauce-relay";
import { castTimelineStream } from "applesauce-common/observable";
import { Note } from "applesauce-common/casts";

function LiveTimeline({ relay }) {
  const notes = use$(
    () =>
      pool
        .relay(relay)
        .subscription({ kinds: [1], limit: 50 })
        .pipe(
          onlyEvents(), // Filter out EOSE messages
          mapEventsToStore(eventStore), // Add to store
          mapEventsToTimeline(), // Sort into array
          castTimelineStream(Note, eventStore), // Cast to Note objects
        ),
    [relay],
  );

  return (
    <div>
      {notes?.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </div>
  );
}
```

### Casting Observables

Use `castEventStream` and `castTimelineStream` to cast events within RxJS pipelines:

```tsx
import {
  castEventStream,
  castTimelineStream,
} from "applesauce-common/observable";
import { Note, Article } from "applesauce-common/casts";

function Examples({ eventId, filters }) {
  const store = useEventStore();

  // Cast a single event observable
  const note = use$(
    () => store.event(eventId).pipe(castEventStream(Note, store)),
    [eventId, store],
  );

  // Cast a timeline observable
  const articles = use$(
    () =>
      store.timeline(filters).pipe(
        castTimelineStream(Article, store),
        map((timeline) => [...timeline]), // Clone for React updates
      ),
    [JSON.stringify(filters), store],
  );

  return <div>...</div>;
}
```

### Relay Information

Get relay metadata:

```tsx
import { use$ } from "@/hooks/use$";
import { pool } from "@/services/pool";

function RelayInfo({ relay }: { relay: string }) {
  const info = use$(() => pool.relay(relay).information$, [relay]);

  return (
    <div>
      <h3>{info?.name || relay}</h3>
      <img src={info?.icon} alt={relay} />
      <p>{info?.description}</p>
    </div>
  );
}
```

## Remember

1. **Always** use the factory function pattern when observable depends on props/state
2. **Always** include all used variables in the dependency array
3. **Always** serialize arrays and objects in dependencies (`.join()`, `JSON.stringify()`)
4. **Always** handle `undefined` return values (except for BehaviorSubjects)
5. **Always** clone timeline arrays with `map(t => [...t])` to trigger React updates
6. **Never** call `use$` conditionally
7. **Never** pass array/object references directly in dependencies
8. **Never** create observables in render - use factory pattern instead
