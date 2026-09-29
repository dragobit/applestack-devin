---
name: nostr-relay-pools
description: Query or publish to specific Nostr relays or curated relay groups using pool.relay(), pool.group(), pool.request(), and pool.subscription(), instead of the default app-wide reactive reads. Useful for debugging, testing, specialized relays, or geographically-targeted publishing.
---

# Targeted Nostr Relay Connections

This project exposes a single global `RelayPool` as `pool` from `@/services/nostr`. Most reads in the app are **reactive**, going through the `eventStore` (`use$(() => eventStore.timeline(filters), [deps])` / `eventStore.model(...)`), with the configured loaders fetching missing events from relays in the background. For most features that is exactly what you want.

Use this skill when you need **more granular control** — talking to a single relay, a curated group of relays, or debugging a specific relay's behavior with explicit one-shot or streaming requests.

## One-shot and streaming against the pool

The `pool` takes an explicit relay list per call:

```ts
import { pool } from "@/services/nostr";
import { lastValueFrom, toArray } from "rxjs";

// One-shot request. `pool.request` emits events only and completes on EOSE,
// so `toArray()` resolves with the full batch.
const events = await lastValueFrom(
  pool
    .request(["wss://relay.damus.io"], { kinds: [1], limit: 15 })
    .pipe(toArray()),
);

// Live subscription (stays open). `pool.subscription` emits NostrEvents only —
// EOSE is handled internally and is not pushed to subscribers.
const sub = pool
  .subscription(["wss://relay.damus.io"], { kinds: [1] })
  .subscribe((event) => {
    // `event` is a NostrEvent — add it to the store to make it reactive
    eventStore.add(event);
  });

// Always clean up streaming subscriptions on unmount.
sub.unsubscribe();
```

## Single Relay: `pool.relay(url)`

```ts
import { pool } from "@/services/nostr";
import { lastValueFrom, toArray } from "rxjs";

function useSpecificRelay() {
  // Connect to a specific relay
  const relay = pool.relay("wss://relay.damus.io");

  // Query from this relay only (one-shot — `request` emits events and
  // completes on EOSE, so `toArray()` resolves with the batch)
  const events = await lastValueFrom(
    relay.request({ kinds: [1], limit: 15 }).pipe(toArray()),
  );

  // Publish a signed event to this relay only
  await relay.publish(signedEvent);
}
```

**Good fits:**

- Testing a relay's behavior in isolation
- Debugging connectivity or rate-limiting issues
- Querying content that only lives on a specialized relay (paid relays, private relays, niche communities)
- Health checks / admin tooling

## Relay Group: `pool.group(urls)`

```ts
import { pool } from "@/services/nostr";
import { lastValueFrom, toArray } from "rxjs";

function useRelayGroup() {
  // Create a group of specific relays (automatically deduplicates events)
  const group = pool.group([
    "wss://relay.damus.io",
    "wss://relay.primal.net",
    "wss://nos.lol",
  ]);

  // Query from all relays in the group, deduplicated (one-shot)
  const events = await lastValueFrom(
    group.request({ kinds: [1], limit: 15 }).pipe(toArray()),
  );

  // Publish a signed event to all relays in the group
  const responses = await group.publish(signedEvent);
}
```

**Good fits:**

- Publishing to a curated set of trusted relays for a specific feature
- Community-scoped queries (e.g. a set of relays known to host a particular topic)
- Geographic/region-targeted delivery
- Load-balancing reads across a known-good subset

## API Consistency

The objects returned by `pool.relay(url)` and `pool.group([…])` expose the **same interface**:

- `.request(filters)` — a one-shot Observable that emits matching events (deduplicated for groups) and **completes on EOSE**. This is the method to use with `.pipe(toArray())` + `lastValueFrom` for a one-shot array.
- `.subscription(filters)` — a long-lived streaming subscription that does **not** complete on EOSE. The pool/group variants emit events only; a single `relay.subscription(...)` also emits an `"EOSE"` string once after the stored events. Always `unsubscribe()` when done.
- `.req(filters)` — the low-level REQ primitive. It emits raw messages including the `"EOSE"` string marker and **never completes** (it stays open). Use it only when you need the EOSE signal yourself; do **not** pipe it through `toArray()` — it would hang. Prefer `.request()` / `.subscription()`.
- `.publish(signedEvent)` — publish a signed event and resolve with the relay responses.

The top-level `pool` exposes the same methods but takes the relay list as the first argument: `pool.request(relays, filters)`, `pool.subscription(relays, filters)`, `pool.req(relays, filters)`, `pool.publish(relays, signedEvent)`.

## Choosing Between Reactive Reads, Group, and Single Relay

| Scenario                                           | Use                                 |
| -------------------------------------------------- | ----------------------------------- |
| Default app reads, best reach for publishing       | reactive `eventStore` + `publish()` |
| Trusted subset, community-specific publishing      | `pool.group([…])`                   |
| Single-relay debugging or specialized relay access | `pool.relay(url)`                   |

## Tips

- **Don't hard-code user-facing relay lists.** If a feature should publish to "the user's write relays" (NIP-65), read them from the user's mailboxes (e.g. a User cast's `outboxes$` / `mailboxes$`, or `eventStore.mailboxes(pubkey)`) instead of hard-coding URLs. For the app-wide default, use `publish()` from `@/services/nostr`.
- **Prefer the reactive store for UI.** Wrap reads in `use$(() => eventStore.timeline(filters), [deps])` so components re-render on new events. Reach for `pool.request` / `pool.relay` / `pool.group` only when you need an explicit, targeted round-trip.
- **Feed targeted results back into the store.** Events from `pool.request`/`pool.subscription` won't appear in reactive models unless you `eventStore.add(event)` them.
- **Handle unreachable relays.** Specific relays can be offline, rate-limited, or slow. Wrap calls in `try/catch` and unsubscribe from any abandoned observables.
- **Avoid leaking subscriptions.** When using `.subscription(...)` (or subscribing to `.req(...)`) for streaming, always call `subscription.unsubscribe()` on unmount.
