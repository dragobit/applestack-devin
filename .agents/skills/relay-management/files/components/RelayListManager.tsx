import { useMemo, useState } from "react";
import { Plus, Wifi, X, Settings } from "lucide-react";
import { useActiveAccount } from "applesauce-react/hooks";
import { MailboxesModel } from "applesauce-core/models";
import { ensureWebSocketURL } from "applesauce-core/helpers";
import { Actions, runner } from "@/services/actions";
import { eventStore } from "@/services/nostr";
import { use$ } from "@/hooks/use$";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface RelayRow {
  url: string;
  /** Listed as an inbox relay (NIP-65 "read") */
  read: boolean;
  /** Listed as an outbox relay (NIP-65 "write") */
  write: boolean;
}

/**
 * Build the per-relay read/write view from a NIP-65 mailboxes model result.
 * `inboxes` are "read" relays and `outboxes` are "write" relays; a relay that
 * appears in both is marked read + write.
 */
function toRelayRows(
  mailboxes: { inboxes: string[]; outboxes: string[] } | undefined,
): RelayRow[] {
  const inboxes = mailboxes?.inboxes ?? [];
  const outboxes = mailboxes?.outboxes ?? [];
  const urls = Array.from(new Set([...inboxes, ...outboxes]));

  return urls.map((url) => ({
    url,
    read: inboxes.includes(url),
    write: outboxes.includes(url),
  }));
}

function renderRelayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "wss:") {
      return parsed.pathname === "/" ? parsed.host : parsed.host + parsed.pathname;
    }
    return parsed.href;
  } catch {
    return url;
  }
}

export function RelayListManager() {
  const account = useActiveAccount();
  const { toast } = useToast();

  // Reactively read the active user's NIP-65 (kind 10002) relay list from the
  // EventStore. Models auto-update when a new kind 10002 event is added, so the
  // UI reflects writes immediately after `runner.run(...)` publishes.
  const mailboxes = use$(
    () => (account ? eventStore.model(MailboxesModel, account.pubkey) : undefined),
    [account?.pubkey],
  );

  const relays = useMemo(() => toRelayRows(mailboxes), [mailboxes]);

  const [newRelayUrl, setNewRelayUrl] = useState("");

  const normalizeRelayUrl = (url: string): string | null => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    try {
      return ensureWebSocketURL(trimmed);
    } catch {
      return null;
    }
  };

  const requireAccount = (): boolean => {
    if (account) return true;
    toast({
      title: "Not logged in",
      description: "Log in to manage your relay list.",
      variant: "destructive",
    });
    return false;
  };

  const handleAddRelay = async () => {
    if (!requireAccount()) return;

    const normalized = normalizeRelayUrl(newRelayUrl);
    if (!normalized) {
      toast({
        title: "Invalid relay URL",
        description: "Please enter a valid relay URL (e.g., wss://relay.example.com)",
        variant: "destructive",
      });
      return;
    }

    if (relays.some((r) => r.url === normalized)) {
      toast({
        title: "Relay already exists",
        description: "This relay is already in your list.",
        variant: "destructive",
      });
      return;
    }

    setNewRelayUrl("");

    // New relays default to read + write (added as both an inbox and outbox relay).
    try {
      await runner.run(Actions.AddOutboxRelay, normalized);
      await runner.run(Actions.AddInboxRelay, normalized);
      toast({
        title: "Relay added",
        description: "Your relay list has been published to Nostr.",
      });
    } catch (error) {
      console.error("Failed to add relay:", error);
      toast({
        title: "Failed to add relay",
        description: "There was an error publishing your relay list.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveRelay = async (relay: RelayRow) => {
    if (!requireAccount()) return;

    try {
      // Remove from whichever lists the relay currently belongs to.
      if (relay.write) await runner.run(Actions.RemoveOutboxRelay, relay.url);
      if (relay.read) await runner.run(Actions.RemoveInboxRelay, relay.url);
      toast({
        title: "Relay removed",
        description: "Your relay list has been published to Nostr.",
      });
    } catch (error) {
      console.error("Failed to remove relay:", error);
      toast({
        title: "Failed to remove relay",
        description: "There was an error publishing your relay list.",
        variant: "destructive",
      });
    }
  };

  const handleToggleRead = async (relay: RelayRow) => {
    if (!requireAccount()) return;
    try {
      if (relay.read) await runner.run(Actions.RemoveInboxRelay, relay.url);
      else await runner.run(Actions.AddInboxRelay, relay.url);
    } catch (error) {
      console.error("Failed to update read flag:", error);
      toast({
        title: "Failed to update relay",
        description: "There was an error publishing your relay list.",
        variant: "destructive",
      });
    }
  };

  const handleToggleWrite = async (relay: RelayRow) => {
    if (!requireAccount()) return;
    try {
      if (relay.write) await runner.run(Actions.RemoveOutboxRelay, relay.url);
      else await runner.run(Actions.AddOutboxRelay, relay.url);
    } catch (error) {
      console.error("Failed to update write flag:", error);
      toast({
        title: "Failed to update relay",
        description: "There was an error publishing your relay list.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Relay List */}
      <div className="space-y-2">
        {relays.length === 0 ? (
          <div className="text-muted-foreground text-sm text-center py-6 border border-dashed rounded-md">
            {account
              ? "No relays in your list yet. Add one below."
              : "Log in to view and manage your relay list."}
          </div>
        ) : (
          relays.map((relay) => (
            <div
              key={relay.url}
              className="flex items-center gap-3 p-3 rounded-md border bg-muted/20"
            >
              <Wifi className="h-4 w-4 text-muted-foreground shrink-0" />
              <span
                className="font-mono text-sm flex-1 truncate"
                title={relay.url}
              >
                {renderRelayUrl(relay.url)}
              </span>

              {/* Settings Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48" align="end">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor={`read-${relay.url}`}
                        className="text-sm cursor-pointer"
                      >
                        Read
                      </Label>
                      <Switch
                        id={`read-${relay.url}`}
                        checked={relay.read}
                        onCheckedChange={() => handleToggleRead(relay)}
                        className="data-[state=checked]:bg-green-500 scale-75"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor={`write-${relay.url}`}
                        className="text-sm cursor-pointer"
                      >
                        Write
                      </Label>
                      <Switch
                        id={`write-${relay.url}`}
                        checked={relay.write}
                        onCheckedChange={() => handleToggleWrite(relay)}
                        className="data-[state=checked]:bg-blue-500 scale-75"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Remove Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveRelay(relay)}
                className="size-5 text-muted-foreground hover:text-destructive hover:bg-transparent shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Add Relay Form */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="new-relay-url" className="sr-only">
            Relay URL
          </Label>
          <Input
            id="new-relay-url"
            placeholder="Enter relay URL (e.g., wss://relay.example.com)"
            value={newRelayUrl}
            onChange={(e) => setNewRelayUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddRelay();
            }}
            disabled={!account}
          />
        </div>
        <Button
          onClick={handleAddRelay}
          disabled={!account || !newRelayUrl.trim()}
          variant="outline"
          size="sm"
          className="h-10 shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Relay
        </Button>
      </div>

      {!account && (
        <p className="text-xs text-muted-foreground">
          Log in to sync your relay list with Nostr
        </p>
      )}
    </div>
  );
}
