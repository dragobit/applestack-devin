---
name: relay-management
description: Add a UI for users to view, add, remove, and configure their NIP-65 relay list with per-relay read/write permissions. Reads the list reactively from the EventStore via MailboxesModel and publishes kind 10002 updates through the applesauce ActionRunner.
---

# Relay List Manager (NIP-65)

This skill provides `RelayListManager`, a drop-in settings UI that lets the user inspect and edit their NIP-65 relay list. Each row has a URL plus read/write switches, with an add/remove flow. All edits run through the applesauce `ActionRunner`, which builds and publishes an updated kind 10002 (Relay List Metadata) event for the active account.

**The underlying NIP-65 relay state lives in the global `EventStore`** (`src/services/nostr.ts`). The component reads it reactively with `eventStore.model(MailboxesModel, pubkey)`, so it always reflects the latest kind 10002 event — including the one it just published. There is no separate React context or local mirror to keep in sync.

**This component is not included in the project by default.** When the user wants a relay settings screen, follow the setup instructions below to install the component.

## How It Maps to NIP-65

The applesauce `MailboxesModel` parses a user's kind 10002 event into `{ inboxes, outboxes }`:

- **inboxes** — relays marked `read` in NIP-65 (where others reach the user)
- **outboxes** — relays marked `write` in NIP-65 (where the user publishes)

The component derives a per-relay `read`/`write` view from these two lists. A relay in both lists shows both switches on.

## Files Provided by This Skill

| Skill file | Copy to |
|---|---|
| `files/components/RelayListManager.tsx` | `src/components/RelayListManager.tsx` |

## Setup Instructions

### 1. Dependencies

No extra npm packages are required. Everything the component uses is already in the template:

- `applesauce-react/hooks` — `useActiveAccount`
- `applesauce-core/models` — `MailboxesModel`
- `applesauce-core/helpers` — `ensureWebSocketURL`
- `applesauce-actions` — relay-list actions (re-exported as `Actions` from `@/services/actions`)
- `lucide-react` — icons (`Plus`, `X`, `Wifi`, `Settings`)
- shadcn/ui — `Button`, `Input`, `Label`, `Switch`, `Popover`

### 2. Copy the Skill File Into `src/`

Copy `.agents/skills/relay-management/files/components/RelayListManager.tsx` into `src/components/RelayListManager.tsx`. The component imports:

- `@/hooks/use$` — subscribes to the `MailboxesModel` observable
- `@/hooks/useToast` — user feedback
- `@/services/nostr` — the global `eventStore`
- `@/services/actions` — the global `runner` (an `ActionRunner` bound to `accounts.signer`) and the `Actions` namespace
- `useActiveAccount` from `applesauce-react/hooks` — the logged-in account

All of these are standard in the template; no extra work is needed beyond copying the file.

This mirrors how the existing relay UI in `src/` works (`RelayListInput`, `RelayItem`, `NewRelayForm`, `RelayAvatar`), which read relay state through `use$` and the global `pool`/`eventStore` rather than a context.

## Usage

Drop the component anywhere you want a relay settings panel — typically a dedicated settings page:

```tsx
import { RelayListManager } from '@/components/RelayListManager';

export default function SettingsPage() {
  return (
    <div className="container mx-auto max-w-2xl py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section>
        <h2 className="text-lg font-medium mb-3">Relays</h2>
        <RelayListManager />
      </section>
    </div>
  );
}
```

The component takes no props. It reads the active account's relay list directly from the global `EventStore` and publishes changes through the global `ActionRunner`.

## Behavior

- **Read path (reactive):** `use$(() => eventStore.model(MailboxesModel, account.pubkey), [account?.pubkey])` returns `{ inboxes, outboxes }`, which the component flattens into read/write rows. The model re-emits whenever a new kind 10002 event is added to the store, so the list updates the moment a change is published.
- **Write path (actions):** every edit calls `runner.run(...)` with the matching relay-list action. The `ActionRunner` loads the current kind 10002 event, applies the change, signs with the active account's signer, and publishes the new event (which is also added back to the `EventStore`). The actions used are:
  - Add relay → `Actions.AddOutboxRelay` + `Actions.AddInboxRelay` (new relays default to read + write)
  - Remove relay → `Actions.RemoveOutboxRelay` and/or `Actions.RemoveInboxRelay`
  - Toggle Read → `Actions.AddInboxRelay` / `Actions.RemoveInboxRelay`
  - Toggle Write → `Actions.AddOutboxRelay` / `Actions.RemoveOutboxRelay`
- **URL normalization:** input URLs are normalized with `ensureWebSocketURL` (a bare hostname becomes `wss://hostname`) before being added; invalid URLs are rejected with a toast.
- **Login gating:** when no account is active, the form is disabled and the list prompts the user to log in. The actions require a signer, so all edits are no-ops without an active account.

## NIP-65 Recap

NIP-65 defines kind 10002 ("Relay List Metadata") as a replaceable event containing `r` tags for each relay, optionally annotated with `read` / `write` markers:

```
["r", "wss://relay.damus.io"]              // both read and write
["r", "wss://relay.example.com", "read"]   // read-only  (inbox)
["r", "wss://writer.example.com", "write"] // write-only (outbox)
```

`MailboxesModel` parses these tags into `inboxes` (read) and `outboxes` (write); the applesauce relay-list actions (`AddInboxRelay`, `AddOutboxRelay`, `RemoveInboxRelay`, `RemoveOutboxRelay`, `CreateMailboxes`) build the inverse — they modify the existing event (or create one if none exists) and publish it.

## Related

- **`src/services/nostr.ts`** — exports the global `eventStore`, `pool`, and `publish`.
- **`src/services/actions.ts`** — exports `runner` (the `ActionRunner` bound to `accounts.signer`) and the `Actions` namespace.
- **`src/services/settings.ts`** — persists the app's default query/lookup relay lists (`extraRelays`, `lookupRelays`) to `localStorage` via the `persist` helper. These are the *app-level* connection relays, separate from the *user's* published NIP-65 list that this component manages.
- **Existing relay UI** (`src/components/RelayListInput.tsx`, `RelayItem.tsx`, `NewRelayForm.tsx`, `RelayAvatar.tsx`) — the in-template patterns this component mirrors for reading relay state via `use$` and the global pool/store.
