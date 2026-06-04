import { useCallback, useState } from "react";
import { runner, Actions } from "@/services/actions";
import type { CommentPointer } from "applesauce-common/helpers";
import type { ExternalIdentifiers } from "applesauce-common/helpers/external-id";
import type { NostrEvent } from "nostr-tools";

interface PostCommentParams {
  /** The root being commented on */
  root: NostrEvent | URL | `#${string}`;
  /** Optional parent comment when replying to another comment */
  reply?: NostrEvent;
  content: string;
}

/**
 * Convert a URL or hashtag root into a NIP-22 external comment pointer.
 *
 * The action's `CommentFactory` understands `NostrEvent` and `CommentPointer`
 * parents directly, so external roots (web URLs, hashtags, and other NIP-73
 * identifiers) are mapped to a {@link CommentPointer} of type `"external"`.
 */
function externalPointer(root: URL | `#${string}`): CommentPointer {
  if (typeof root === "string") {
    // Hashtag (NIP-73 "#" kind)
    return {
      type: "external",
      kind: "#",
      identifier: root as ExternalIdentifiers["#"],
    };
  }

  const identifier = root.toString();
  // Web URLs use the "web" kind; every other protocol uses its scheme as kind.
  const kind =
    root.protocol === "http:" || root.protocol === "https:"
      ? "web"
      : root.protocol.replace(/:$/, "");

  return {
    type: "external",
    kind: kind as keyof ExternalIdentifiers,
    identifier: identifier as ExternalIdentifiers[keyof ExternalIdentifiers],
  };
}

/** Post a NIP-22 (kind 1111) comment on an event, URL, or hashtag. */
export function usePostComment() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const postComment = useCallback(
    async ({ root, reply, content }: PostCommentParams): Promise<void> => {
      setIsPending(true);
      setError(null);

      try {
        // The parent is the comment we reply to, or the root itself for a
        // top-level comment. URL/hashtag roots become external pointers.
        const parent: NostrEvent | CommentPointer =
          reply ?? (root instanceof URL || typeof root === "string"
            ? externalPointer(root)
            : root);

        // CreateComment builds, signs, and publishes the kind 1111 event,
        // adding it to the EventStore so reactive views update immediately.
        await runner.run(Actions.CreateComment, parent, content);
      } catch (err) {
        const e = err instanceof Error ? err : new Error("Failed to post comment");
        setError(e);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [],
  );

  return {
    postComment,
    mutateAsync: postComment,
    isPending,
    isLoading: isPending,
    error,
  };
}
