# Custom Factories

This directory is for custom Applesauce v6 event factories.

Use the typed factories from `applesauce-common/factories` when one already exists, such as `NoteFactory`, `CommentFactory`, `ProfileFactory`, or `ReactionFactory`. For unsupported kinds, extend or compose `EventFactory` from `applesauce-core/factories`.

## Example Usage

```typescript
import { EventFactory, blankEventTemplate } from "applesauce-core/factories";

export function createCustomArticle(title: string, content: string) {
  return new EventFactory((resolve) => resolve(blankEventTemplate(30023)))
    .content(content)
    .modifyPublicTags((tags) => [
      ...tags,
      ["d", title.toLowerCase().replace(/\s+/g, "-")],
      ["title", title],
    ]);
}
```

## Creating Events

```typescript
import { accounts } from "@/services/accounts";
import { publish } from "@/services/nostr";
import { createCustomArticle } from "@/factories/custom";

const account = accounts.getActive();
if (!account) throw new Error("No active account");

const event = await createCustomArticle("My Title", "My content")
  .as(account.signer)
  .sign();

await publish(event);
```

## Built-In Factories

Applesauce provides built-in factories in `applesauce-common/factories`:

- `NoteFactory` - Kind 1 text notes
- `ReactionFactory` - Kind 7 reactions
- `CommentFactory` - Kind 1111 comments
- `ArticleFactory` - Kind 30023 long-form content
- `RepostFactory` - Kind 6/16 reposts

Check the Applesauce documentation for the full list.
