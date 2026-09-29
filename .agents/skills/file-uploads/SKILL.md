---
name: file-uploads
description: Upload files (images, media, attachments) from the browser to a Blossom server signed with the active account's signer, and attach them to Nostr events with NIP-94 imeta tags.
---

# File Uploads on Nostr

Use a Blossom upload helper whenever a feature needs to accept a user-provided file (avatars, banners, post attachments, etc.). Uploads are signed by the active account's signer and return NIP-94-compatible metadata (url, sha256, mime type, dimensions, blurhash, …).

The project's relay pool and helpers live in `@/services/nostr` (the global `pool`, `eventStore`, and `publish()`); the active account comes from `useActiveAccount()`. Blossom uploads use the `blossom-client-sdk` actions, authorized with `account.signer.signEvent`.

## Uploading a file

Wrap the Blossom upload in a small hook so components can `await` it and drive loading UI with local state. The signed upload-auth event is created from `account.signer.signEvent`; the upload returns a blob descriptor with the URL and metadata you turn into NIP-94 tags.

```tsx
import { useCallback, useState } from "react";
import { useActiveAccount } from "applesauce-react/hooks";
import { multiServerUpload } from "blossom-client-sdk/actions/multi-server";
import { createUploadAuth } from "blossom-client-sdk/auth";

// Reasonable default; in a real app read the user's Blossom servers
// (see "Choosing servers" below) instead of hard-coding.
const DEFAULT_BLOSSOM_SERVERS = [new URL("https://blossom.primal.net")];

export function useUploadFile() {
  const account = useActiveAccount();
  const [isPending, setIsPending] = useState(false);

  const uploadFile = useCallback(
    async (file: File, servers: URL[] = DEFAULT_BLOSSOM_SERVERS) => {
      if (!account) throw new Error("Must be logged in to upload");

      setIsPending(true);
      try {
        const results = await multiServerUpload(servers, file, {
          // Each server gets a freshly signed NIP-24242 upload-auth event.
          onAuth: (_server, sha256, type) =>
            createUploadAuth(
              (draft) => account.signer.signEvent(draft),
              sha256,
              { type },
            ),
        });

        const blob = Array.from(results.values())[0];
        if (!blob)
          throw new Error("No upload result returned from blossom server");

        // Build NIP-94-compatible tags. The first tag is the `url` tag.
        const tags: string[][] = [
          ["url", blob.url],
          ["x", blob.sha256],
        ];
        if (blob.type) tags.push(["m", blob.type]);
        if (blob.size) tags.push(["size", String(blob.size)]);

        return tags;
      } finally {
        setIsPending(false);
      }
    },
    [account],
  );

  return { uploadFile, isPending };
}
```

Use `isPending` to drive loading UI and `uploadFile` in `async`/`await` flows:

```tsx
function MyComponent() {
  const { uploadFile, isPending: isUploading } = useUploadFile();

  const handleUpload = async (file: File) => {
    try {
      // Returns an array of NIP-94-compatible tags.
      // The first tag is the `url` tag; its second element is the file URL.
      const tags = await uploadFile(file);
      const url = tags[0][1];
      // ...use the url
    } catch (error) {
      // ...handle errors (show a toast, etc.)
    }
  };

  // ...rest of component
}
```

For a full worked example (multi-server upload, media optimization, building a kind 1063 `FileMetadata` event with `FileMetadataFactory`, and publishing to outbox relays), see the applesauce `file/publisher` and `blossom/server-manager` examples.

## Attaching Files to Events

Publish events with the project's `usePublish` hook (`publishEvent`), which signs with the active account and adds the event to the store before publishing.

### Kind 0 (profile metadata)

Use the plain URL in the relevant JSON field:

```ts
const tags = await uploadFile(file);
const url = tags[0][1];

await publishEvent({
  kind: 0,
  content: JSON.stringify({ ...existingMetadata, picture: url }),
  tags: [],
});
```

### Kind 1 (text notes) and other content events

Append the URL to `content`, and add one `imeta` tag per file. `imeta` carries the NIP-94 metadata (mime type, dimensions, blurhash, etc.) that the uploader returned:

```ts
const tags = await uploadFile(file); // e.g. [["url", "https://..."], ["x", "<sha256>"], ["m", "image/png"], ...]
const url = tags[0][1];

// Flatten the NIP-94 tags into a single imeta tag value.
const imeta = tags.map(([name, value]) => `${name} ${value}`);

await publishEvent({
  kind: 1,
  content: `Check this out ${url}`,
  tags: [["imeta", ...imeta]],
});
```

Repeat the pattern (one `imeta` tag per file) for multiple attachments.

## Common Patterns

- **Avatar / banner pickers:** wrap an `<input type="file" accept="image/*">` and call `uploadFile` on change; on success, update the relevant profile field and publish a kind 0 event.
- **Post composers:** call `uploadFile` for each selected file before publishing the note, then build `imeta` tags alongside `content`.
- **Progress UI:** use `isPending` from the hook to disable the submit button and show a spinner or skeleton.
- **Error handling:** wrap `uploadFile` in `try/catch` and surface failures via `useToast` — network and Blossom-server errors are common and should never break the UI.

## Choosing servers

Don't hard-code a single Blossom server for production. Read the user's configured Blossom servers from the event store (a User cast exposes `blossomServers$`, e.g. `use$(() => user.blossomServers$, [user.pubkey])`), and fall back to a sensible default when the list is empty. Passing multiple servers to `multiServerUpload` mirrors the blob across them and lets you populate NIP-94 `fallback` URLs.

## Constraints

- Uploads require a logged-in user (Blossom auth is signed by the active account's signer). Guard uploads behind `useActiveAccount()`.
- Don't store or display raw `File` objects after upload — always use the returned URL.
- Large files may take time; `await` the upload to completion before publishing an event that references the URL.
