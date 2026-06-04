---
name: edit-profile
description: Add a form that lets users edit their Nostr profile metadata (NIP-01 kind 0). Provides EditProfileForm with fields for name, display name, about, picture, banner, website, nip05, lightning addresses, a bot flag, and languages, with a live profile preview.
---

# Edit Profile Form

This skill provides `EditProfileForm`, a drop-in React component that lets a logged-in user update their Nostr profile metadata (NIP-01 kind 0). The form covers the common metadata fields, renders a live profile preview as the user types, and publishes the updated kind 0 event through the applesauce `UpdateProfile` action. Because the app's `EventStore` is reactive, every `useProfile`/`useMyProfile` consumer in the UI updates automatically once the new event is stored — no manual cache invalidation is needed.

**This component is not included in the project by default.** When the user wants profile editing, follow the setup instructions below to install the component.

## Files Provided by This Skill

| Skill file | Copy to |
|---|---|
| `files/components/EditProfileForm.tsx` | `src/components/EditProfileForm.tsx` |

## Setup Instructions

### 1. Dependencies

No extra npm packages are required. The component uses packages already present in the template:

- `react-hook-form` + `@hookform/resolvers` — form state and validation
- `zod` — a local metadata schema (defined in the component) for field validation
- `applesauce-core/helpers` — the `ProfileContent` type for the profile metadata shape
- `applesauce-react/hooks` — `useActiveAccount` for the logged-in account
- `applesauce-actions` (via `@/services/actions`) — the `UpdateProfile` action
- `lucide-react` — icons
- shadcn/ui — `Button`, `Input`, `Textarea`, `Checkbox`

### 2. Copy the Skill File Into `src/`

Copy `.agents/skills/edit-profile/files/components/EditProfileForm.tsx` into `src/components/EditProfileForm.tsx`. The component imports:

- `useActiveAccount` from `applesauce-react/hooks` — the active account (used to guard submission)
- `@/hooks/useProfile` (`useMyProfile`) — the current user's existing metadata, to pre-populate the form
- `@/services/actions` (`runner`, `Actions`) — runs `Actions.UpdateProfile` to publish the kind 0 event
- `@/hooks/useToast` — success/error feedback

All of these are standard in the template; no extra work is needed beyond copying the file.

## Usage

Place the component anywhere a logged-in user should be able to edit their profile. It renders the form itself, including its own container layout and a live preview:

```tsx
import { EditProfileForm } from '@/components/EditProfileForm';

export default function EditProfilePage() {
  return <EditProfileForm />;
}
```

The component takes no props. It reads the current user's existing metadata via `useMyProfile()` and pre-populates every field, so the user can tweak values without losing anything else on their profile. If no account is active, submission is blocked with a toast.

## Fields

| Field | NIP-01 key | Input | Notes |
|---|---|---|---|
| Display Name | `display_name` | text | Shown as the large title in the preview |
| Name | `name` | text | Short handle |
| About | `about` | textarea | Bio / description |
| Picture | `picture` | URL | Profile avatar; validated as a URL |
| Banner | `banner` | URL | Profile banner; validated as a URL |
| Website | `website` | URL | Any related web URL |
| NIP-05 | `nip05` | text | Email-like Nostr identifier (e.g. `alice@example.com`) |
| Lightning (LUD-16) | `lud16` | email | Lightning address |
| Lightning (LUD-06) | `lud06` | email | LNURL-pay address |
| Bot | `bot` | checkbox | Marks the account as automated |
| Languages | `languages` | comma-separated text | Stored as a string array |

Validation is enforced by a local `zod` schema (`zodResolver`); URL fields must be valid URLs and lightning fields must look like email addresses. Empty fields are stripped before publishing.

## How Saving Works

On submit, the form builds a `Partial<ProfileContent>` from the non-empty fields and calls:

```ts
import { runner, Actions } from '@/services/actions';

await runner.run(Actions.UpdateProfile, profileUpdate);
```

`Actions.UpdateProfile` merges the changes into the user's existing kind 0 metadata, signs the event with the active account, and publishes it. The applesauce `EventStore` then notifies every reactive subscriber, so profile displays across the app refresh automatically.

## Routing

The form is just a component. If you want a dedicated route for it, wire it up in `AppRouter.tsx`:

```tsx
// AppRouter.tsx
import EditProfilePage from './pages/EditProfilePage';

<Route path="/settings/profile" element={<EditProfilePage />} />
```

## Related Hooks

If you're building a profile page that *displays* metadata (as opposed to editing it), use:

- `useMyProfile()` — the logged-in user's profile metadata
- `useProfile(pubkey)` — any user's metadata by pubkey

Both return a reactive `ProfileContent | undefined` and are part of the core template.
