# Custom Operations

This directory contains custom event operations for your application.

Operations are composable functions that modify event templates. In Applesauce v6, use factory methods like `.content(...)` and `.modifyPublicTags(...)` for most custom event creation.

## Example Usage

```typescript
import type { EventOperation } from "applesauce-core/factories";

/**
 * Add mention tags (p-tags) for multiple users
 */
export function addMentions(pubkeys: string[]): EventOperation {
  return (draft) => ({
    ...draft,
    tags: [
      ...draft.tags,
      ...pubkeys.map((pubkey) => ["p", pubkey, "", "mention"]),
    ],
  });
}

/**
 * Add a content warning tag
 */
export function addContentWarning(reason?: string): EventOperation {
  return (draft) => ({
    ...draft,
    tags: [...draft.tags, reason ? ["content-warning", reason] : ["content-warning"]],
  });
}
```

## Using Operations

```typescript
import { NoteFactory } from "applesauce-common/factories";
import { accounts } from "@/services/accounts";
import { publish } from "@/services/nostr";
import { addMentions, addContentWarning } from "@/operations/custom";

const account = accounts.getActive();
if (!account) throw new Error("No active account");

const event = await NoteFactory.create("Hello @alice and @bob!")
  .chain(addMentions([alicePubkey, bobPubkey]))
  .chain(addContentWarning("NSFW"))
  .as(account.signer)
  .sign();

await publish(event);
```

## Available Built-in Operations

Applesauce provides built-in operations in `applesauce-core/operations` and `applesauce-common/operations`:

- `modifyPublicTags(...)` - Modify public tags
- `modifyHiddenTags(...)` - Modify hidden tags
- `setDeleteEventTags(...)` - Set tags for delete events
- `setCommentTags(...)` - Set tags for comments
- And more...

Check the applesauce documentation for the full list.
