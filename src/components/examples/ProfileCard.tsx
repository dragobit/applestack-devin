import { nip19 } from "nostr-tools";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";
import { genUserName } from "@/lib/genUserName";

interface ProfileCardProps {
  pubkey: string;
}

export function ProfileCard({ pubkey }: ProfileCardProps) {
  const profile = useProfile(pubkey);
  const name = profile?.displayName || profile?.name || genUserName(pubkey);
  const npub = nip19.npubEncode(pubkey);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4 space-y-0">
        <Avatar className="h-14 w-14">
          <AvatarImage src={profile?.picture} alt={name} />
          <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-1">
          <CardTitle className="truncate text-lg">
            {profile ? name : <Skeleton className="h-5 w-32" />}
          </CardTitle>
          <p className="truncate text-xs text-muted-foreground">{npub}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {profile?.about ? (
          <p className="whitespace-pre-wrap text-sm">{profile.about}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No profile description loaded.
          </p>
        )}
        {profile?.nip05 && (
          <p className="text-sm text-muted-foreground">NIP-05: {profile.nip05}</p>
        )}
        {(profile?.lud16 || profile?.lud06) && (
          <p className="text-sm text-muted-foreground">
            Lightning: {profile.lud16 || profile.lud06}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
