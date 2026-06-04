import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useActiveAccount } from 'applesauce-react/hooks';
import { usePostComment } from '@/hooks/usePostComment';
import { LoginArea } from '@/components/auth/LoginArea';
import type { NostrEvent } from 'nostr-tools';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommentFormProps {
  root: NostrEvent | URL | `#${string}`;
  /** The parent comment when replying to another comment */
  reply?: NostrEvent;
  onSuccess?: () => void;
  placeholder?: string;
  compact?: boolean;
}

export function CommentForm({
  root,
  reply,
  onSuccess,
  placeholder = "Write a comment...",
  compact = false,
}: CommentFormProps) {
  const [content, setContent] = useState('');
  const account = useActiveAccount();
  const { postComment, isPending } = usePostComment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() || !account) return;

    try {
      await postComment({ content: content.trim(), root, reply });
      setContent('');
      onSuccess?.();
    } catch {
      // postComment surfaces the error; keep the draft so the user can retry.
    }
  };

  if (!account) {
    return (
      <div className={cn("rounded-2xl border border-dashed bg-muted/30", compact ? "p-4" : "p-6")}>
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2 text-muted-foreground">
            <MessageSquare className="h-5 w-5" />
            <span>Sign in to {reply ? 'reply' : 'comment'}</span>
          </div>
          <LoginArea />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className={cn("rounded-2xl resize-none", compact ? "min-h-[80px]" : "min-h-[100px]")}
        disabled={isPending}
      />
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!content.trim() || isPending}
          size={compact ? "sm" : "default"}
          className="rounded-full px-6"
        >
          {isPending ? 'Posting…' : 'Post'}
        </Button>
      </div>
    </form>
  );
}
