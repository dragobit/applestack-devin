import { NoteContent } from "@/components/NoteContent";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";
import { useTimeline } from "@/hooks/useTimeline";
import { genUserName } from "@/lib/genUserName";
import type { Note } from "applesauce-common/casts";

const EXAMPLE_RELAYS = ["wss://relay.damus.io", "wss://nos.lol"];

export function TimelineFeed() {
  const notes = useTimeline(EXAMPLE_RELAYS, [{ kinds: [1], limit: 20 }]);

  if (!notes) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-muted-foreground">
          No notes loaded yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <TimelineNote key={note.id} note={note} />
      ))}
    </div>
  );
}

function TimelineNote({ note }: { note: Note }) {
  const profile = useProfile(note.event.pubkey);
  const name = profile?.displayName || profile?.name || genUserName(note.event.pubkey);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">
          {note.createdAt.toLocaleString()}
        </div>
      </CardHeader>
      <CardContent>
        <NoteContent event={note.event} />
      </CardContent>
    </Card>
  );
}
