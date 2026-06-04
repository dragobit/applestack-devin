import { useComments } from '@/hooks/useComments';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NostrEvent } from 'nostr-tools';
import { CommentForm } from './CommentForm';
import { Comment } from './Comment';

interface CommentsSectionProps {
  root: NostrEvent | URL | `#${string}`;
  emptyStateMessage?: string;
  emptyStateSubtitle?: string;
  className?: string;
  limit?: number;
}

export function CommentsSection({
  root,
  emptyStateMessage = "No comments yet",
  emptyStateSubtitle = "Be the first to share your thoughts!",
  className,
  limit = 500,
}: CommentsSectionProps) {
  const { data: commentsData, isLoading } = useComments(root, limit);
  const comments = commentsData?.topLevelComments || [];

  return (
    <div className={cn("space-y-6", className)}>
      <CommentForm root={root} />

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">{emptyStateMessage}</p>
          <p className="text-sm">{emptyStateSubtitle}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <Comment
              key={comment.id}
              root={root}
              comment={comment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
