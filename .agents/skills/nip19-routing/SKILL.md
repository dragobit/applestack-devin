---
name: nip19-routing
description: Implement or populate the root-level NIP-19 router (/:nip19) that handles npub, nprofile, note, nevent, and naddr identifiers. Covers decoding, secure filter construction, and type-specific rendering for profiles, notes, events, and addressable events.
---

# NIP-19 Identifier Routing

NIP-19 defines the bech32-encoded identifiers used throughout Nostr (`npub1...`, `note1...`, `naddr1...`, etc.). This project routes all of them through a single root-level page at `/:nip19`, implemented by `src/pages/NIP19Page.tsx`.

Use this skill when the user wants to populate the `NIP19Page` sections with real views, add a new identifier type, or build links that point into the Nostr routing system.

## Identifier Reference

| Prefix       | Payload                                                          | Use when…                                                    |
|--------------|------------------------------------------------------------------|--------------------------------------------------------------|
| `npub1`      | 32-byte public key                                               | Simple user reference                                        |
| `nprofile1`  | Public key + optional relay hints + petname                      | User reference with relay context                            |
| `note1`      | 32-byte event ID (kind:1 text notes only, per NIP-10)            | Referencing a short text note/thread                         |
| `nevent1`    | Event ID + optional relay hints + author pubkey + kind           | Any event kind, or notes where you need relay/author context |
| `naddr1`     | `kind` + `pubkey` + `identifier` (`d` tag) + optional relay hints | Addressable events (kind 30000-39999): articles, products    |
| `nsec1`      | Private key                                                      | **Never display or route** — treat as a 404                  |
| `nrelay1`    | Relay URL                                                        | Deprecated                                                   |

### `note1` vs `nevent1`

- `note1` carries only an event ID, and is canonically tied to kind:1 text notes.
- `nevent1` can reference **any** kind and can carry relay hints + author pubkey. Prefer `nevent1` for non-kind-1 events or when you want to ship relay hints with a link.

### `npub1` vs `nprofile1`

- `npub1` is just a pubkey.
- `nprofile1` adds relay hints and a petname. Prefer it for shareable profile links where discoverability matters.

## Routing Rules

1. **All NIP-19 identifiers are handled at the URL root**: `/:nip19` in `AppRouter.tsx`. Never nest them under paths like `/note/:id` or `/profile/:npub`.
2. **Invalid, vacant, or unsupported identifiers** (including `nsec1` and `nrelay1`) render the 404 page. The `NIP19Page` boilerplate already handles this.
3. **Addressable event URLs must include the author**. `naddr1` already encodes `pubkey` + `kind` + `identifier`, which is exactly what a secure query filter needs. If you ever design an alternative URL, use the shape `/:npub/:dtag`, never `/:dtag` alone — otherwise anyone can publish a conflicting event with the same `d` tag.

## Decoding and Filtering

Nostr relay filters only accept hex strings. Always decode the NIP-19 identifier **before** building a filter, and turn the decoded payload — never the raw bech32 string — into the filter.

```ts
import { nip19 } from 'nostr-tools';
import type { Filter } from 'applesauce-core/helpers';

/** Build a secure relay filter from a NIP-19 identifier. */
function filtersFor(value: string): Filter[] {
  const decoded = nip19.decode(value); // throws on invalid input

  switch (decoded.type) {
    case 'npub':
      return [{ kinds: [0], authors: [decoded.data], limit: 1 }];

    case 'nprofile':
      return [{ kinds: [0], authors: [decoded.data.pubkey], limit: 1 }];

    case 'note':
      return [{ ids: [decoded.data], kinds: [1], limit: 1 }];

    case 'nevent':
      return [{ ids: [decoded.data.id], limit: 1 }];

    case 'naddr': {
      const { kind, pubkey, identifier } = decoded.data;
      return [{
        kinds: [kind],
        authors: [pubkey],        // critical: prevents d-tag spoofing
        '#d': [identifier],
        limit: 1,
      }];
    }

    default:
      // nsec, nrelay, unknown → 404
      throw new Error('Unsupported Nostr identifier');
  }
}
```

### Reading the events (the applesauce way)

This template reads through the global `EventStore`, not one-off relay queries. Build the filter, render **reactively** from the store, and let the configured loaders (`@/services/nostr`) fetch anything missing in the background. Loaders are cold observables — you must `.subscribe()` to fire them.

For replaceable/addressable events (kind 0 profiles, `naddr`), use the store accessors plus a loader:

```tsx
import { useEffect } from 'react';
import { use$ } from '@/hooks/use$';
import { eventStore, addressLoader } from '@/services/nostr';

function Profile({ pubkey }: { pubkey: string }) {
  // Reactive read from the store
  const profile = use$(() => eventStore.profile(pubkey), [pubkey]);

  // Fire the loader once to fetch it if it isn't cached yet
  useEffect(() => {
    const sub = addressLoader({ kind: 0, pubkey }).subscribe();
    return () => sub.unsubscribe();
  }, [pubkey]);

  if (!profile) return null; // loading / not found
  return <ProfileHeader profile={profile} />;
}
```

For single events by id (`note`, `nevent`), read with `eventStore.event(...)` and fetch with `eventLoader`, passing along any relay/author hints the pointer carried:

```tsx
import { eventStore, eventLoader } from '@/services/nostr';

const event = use$(() => eventStore.event(id), [id]);
useEffect(() => {
  const sub = eventLoader({ id, relays, author }).subscribe();
  return () => sub.unsubscribe();
}, [id]);
```

For feeds/timelines, render from `eventStore.timeline(filtersFor(value))` (see the `nostr-infinite-scroll` skill). When you genuinely need an imperative one-shot fetch (no reactive UI), use the pool directly:

```ts
import { pool } from '@/services/nostr';
import { extraRelays } from '@/services/settings';
import { lastValueFrom, toArray } from 'rxjs';

const events = await lastValueFrom(
  pool.request(extraRelays.getValue(), filtersFor(value)).pipe(toArray()),
);
```

### Common mistakes

```ts
// ❌ Passing bech32 straight into a filter
{ ids: [naddr] }

// ❌ Addressable lookup without the author — anyone can spoof the d-tag
{ kinds: [30023], '#d': [slug] }

// ✅ Decode first, then include the author in the filter
const { kind, pubkey, identifier } = nip19.decode(naddr).data;
{ kinds: [kind], authors: [pubkey], '#d': [identifier] }
```

## Populating `NIP19Page`

`src/pages/NIP19Page.tsx` already:

- Decodes `params.nip19` with `nip19.decode`.
- Branches on `decoded.type` with a section for each supported identifier.
- Redirects invalid / unsupported identifiers to the 404 page.
- Provides a responsive container wrapper.

To turn it into a real router, replace each placeholder section with a concrete component:

| `decoded.type`        | Typical view                                                  |
|-----------------------|---------------------------------------------------------------|
| `npub` / `nprofile`   | Profile page: header from kind 0, feed of the user's events   |
| `note`                | Single kind:1 text note with thread + replies                 |
| `nevent`              | Generic event renderer; branch on `kind` for specialized UIs  |
| `naddr`               | Addressable-event view (article, product, community, etc.)    |

Inside each branch, pass the decoded payload (not the raw bech32 string) to a child component. That keeps filter construction colocated with the fetching hook and removes any chance of a re-decode mismatch.

## Linking to NIP-19 Routes

When building links elsewhere in the app:

```tsx
import { nip19 } from 'nostr-tools';
import { Link } from 'react-router-dom';

// To a profile
<Link to={`/${nip19.npubEncode(pubkey)}`}>Profile</Link>

// To an addressable event (article, product, …)
<Link to={`/${nip19.naddrEncode({ kind, pubkey, identifier, relays })}`}>
  Open
</Link>

// To a specific event of any kind, with relay hints
<Link to={`/${nip19.neventEncode({ id, relays, author, kind })}`}>Open</Link>
```

Always encode with the **most specific** identifier you have context for (`nprofile` > `npub`, `nevent` > `note`, `naddr` for addressable). The extra metadata makes links more robust across relays.

## Security Recap

- Decode **before** querying.
- For addressable events, always include `authors: [pubkey]` in the filter — the `d` tag alone is not a trust boundary.
- Treat `nsec1` and any unknown/invalid identifier as 404. Never render, log, or echo a decoded `nsec`.
