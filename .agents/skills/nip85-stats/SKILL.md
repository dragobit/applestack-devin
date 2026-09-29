---
name: nip85-stats
description: Fetch pre-computed engagement stats (follower count, post count, reply count, reaction count, zap amounts, etc.) for users, events, and addressable events via a NIP-85 Trusted Assertion provider. Provides useNip85UserStats, useNip85EventStats, and useNip85AddrStats hooks backed by a configurable provider pubkey in AppConfig.
---

# NIP-85 Trusted Assertion Stats

[NIP-85](https://github.com/nostr-protocol/nips/blob/master/85.md) defines "Trusted Assertions" — events published by a service provider that carry pre-computed stats (follower counts, reaction counts, zap totals, etc.) for users and events. Clients that would otherwise need to load thousands of events to compute these numbers can instead query a single addressable event from a trusted provider.

This skill adds three hooks — `useNip85UserStats`, `useNip85EventStats`, `useNip85AddrStats` — and a configurable `nip85StatsPubkey` setting (a persisted `BehaviorSubject` in `src/services/settings.ts`) so you can swap providers.

## Kinds Used

| Kind  | Subject                      | `d` tag value             |
| ----- | ---------------------------- | ------------------------- |
| 30382 | User                         | user pubkey (hex)         |
| 30383 | Event (regular, kind 1 etc.) | event id (hex)            |
| 30384 | Addressable event            | `<kind>:<pubkey>:<d-tag>` |

Each hook loads one addressable event via the repo's `addressLoader` and reads it reactively from the global `eventStore` with `eventStore.replaceable({ kind, pubkey: statsPubkey, identifier })`. **Constraining the address pointer to the trusted provider `pubkey` is required** — without it, anyone could publish a fake assertion with the same `d` tag and the client would accept it.

## Files Provided by This Skill

| Skill file                     | Copy to                      |
| ------------------------------ | ---------------------------- |
| `files/hooks/useNip85Stats.ts` | `src/hooks/useNip85Stats.ts` |

## Setup Instructions

### 1. Copy the Hooks File

Copy `.agents/skills/nip85-stats/files/hooks/useNip85Stats.ts` into `src/hooks/useNip85Stats.ts`. It uses applesauce only — `use$` / `useEventStore` from the repo hooks, the global `addressLoader` from `@/services/nostr`, and `extraRelays` + a new `nip85StatsPubkey` subject from `@/services/settings`. It uses no external query or Nostr framework beyond applesauce.

### 2. Add the `nip85StatsPubkey` Setting

In `src/services/settings.ts`, add a persisted `BehaviorSubject` alongside `extraRelays` / `lookupRelays`. Pick a provider pubkey (the ditto.pub provider below is a reasonable default), or use `""` to ship with stats disabled:

```typescript
import { BehaviorSubject } from "rxjs";

/**
 * Hex pubkey of the NIP-85 Trusted Assertion provider. Empty string = disabled.
 */
export const nip85StatsPubkey = new BehaviorSubject<string>(
  "5f68e85ee174102ca8978eef302129f081f03456c884185d5ec1c1224ab633ea",
);

// Persist the provider pubkey to localStorage
persist(nip85StatsPubkey, "nip85StatsPubkey");
```

`persist` is already exported from `src/services/settings.ts`, so it loads any saved value on startup and writes changes back. Because it's a `BehaviorSubject`, the hooks subscribe with `use$` and re-render automatically whenever the provider changes.

That's the entire setup — there is no `AppConfig`, Zod schema, or `TestApp` config to touch in this repo.

## Usage

### User stats (kind 30382)

```tsx
import { useNip85UserStats } from "@/hooks/useNip85Stats";

function FollowerCount({ pubkey }: { pubkey: string }) {
  const stats = useNip85UserStats(pubkey);
  if (!stats) return null; // no provider configured or no assertion yet
  return <span>{stats.followers.toLocaleString()} followers</span>;
}
```

### Event stats (kind 30383)

```tsx
import { useNip85EventStats } from "@/hooks/useNip85Stats";

function NoteStats({ eventId }: { eventId: string }) {
  const stats = useNip85EventStats(eventId);
  if (!stats) return null;
  return (
    <div className="flex gap-3 text-sm text-muted-foreground">
      <span>{stats.reactionCount} reactions</span>
      <span>{stats.repostCount} reposts</span>
      <span>{stats.commentCount} comments</span>
      <span>{stats.zapAmount} sats</span>
    </div>
  );
}
```

### Addressable event stats (kind 30384)

The `addr` argument is the full NIP-01 event address `<kind>:<pubkey>:<d-tag>`:

```tsx
import { useNip85AddrStats } from "@/hooks/useNip85Stats";

function ArticleStats({
  kind,
  pubkey,
  identifier,
}: {
  kind: number;
  pubkey: string;
  identifier: string;
}) {
  const stats = useNip85AddrStats(`${kind}:${pubkey}:${identifier}`);
  if (!stats) return null;
  return <span>{stats.reactionCount} reactions</span>;
}
```

## Behavior Notes

- **Graceful degradation:** The hooks return `null` (not an error) when `nip85StatsPubkey` is empty or the provider has no assertion for the subject. Always render defensively — NIP-85 is an optimization, not a source of truth.
- **Reactive, no blocking:** Each hook subscribes to the global `eventStore` with `use$` and triggers a one-time `addressLoader` call in an effect. The loader is a cold observable that completes once data arrives; loader errors are swallowed so a slow/failing stats relay never throws into the UI.
- **Deduped & cached by the EventStore:** The `addressLoader` batches and deduplicates in-flight requests and checks the local nostrdb cache first. Once an assertion is in the `eventStore`, every component reading the same `(kind, pubkey, identifier)` shares it; swapping `nip85StatsPubkey` re-subscribes to a different address pointer automatically.
- **Missing tags = 0:** A tag absent from the assertion is reported as `0` rather than `undefined`, matching NIP-85's "no data" semantics.
- **Not the source of truth:** For interactive features (did _this_ user like _this_ post?) you still need to query the underlying reaction/zap/repost events. NIP-85 only provides aggregate counts.

## Extending the Stats

The hooks expose a small subset of the tags defined in NIP-85. To surface more (e.g. `zap_amt_sent`, `rank`, `first_created_at`), extend the return types and pull additional tags via `getIntTag`:

```typescript
export interface Nip85UserStats {
  followers: number;
  postCount: number;
  rank: number; // new
  zapAmtReceived: number; // new
}

// inside the parseUserStats helper
return {
  followers: getIntTag(tags, "followers"),
  postCount: getIntTag(tags, "post_cnt"),
  rank: getIntTag(tags, "rank"),
  zapAmtReceived: getIntTag(tags, "zap_amt_recd"),
};
```

See the full tag table in [NIP-85](https://github.com/nostr-protocol/nips/blob/master/85.md).

## Exposing a Provider Picker (Optional)

If you want the user to change providers at runtime, bind an input to the `nip85StatsPubkey` subject. Read it reactively with `use$` and push validated values back with `.next()` — `persist` saves them automatically:

```tsx
import { use$ } from "@/hooks/use$";
import { nip85StatsPubkey } from "@/services/settings";

function StatsProviderInput() {
  const value = use$(nip85StatsPubkey) ?? "";
  return (
    <input
      value={value}
      onChange={(e) => {
        const v = e.target.value.trim().toLowerCase();
        if (v === "" || /^[0-9a-f]{64}$/.test(v)) {
          nip85StatsPubkey.next(v);
        }
      }}
      placeholder="64-char hex pubkey (blank to disable)"
    />
  );
}
```

## Related NIPs

- [NIP-85](https://github.com/nostr-protocol/nips/blob/master/85.md) — Trusted Assertions (this skill)
- [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md) — Addressable event addressing (`<kind>:<pubkey>:<d-tag>`)
- [NIP-57](https://github.com/nostr-protocol/nips/blob/master/57.md) — Zaps (the underlying events `zap_amount` / `zap_cnt` aggregate)
