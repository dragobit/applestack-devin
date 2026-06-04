import { ZapDialog } from "@/components/ZapDialog";
import { useZaps } from "@/hooks/useZaps";
import { useWallet } from "@/hooks/useWallet";
import { useProfile } from "@/hooks/useProfile";
import { useActiveAccount } from "applesauce-react/hooks";
import { Zap } from "lucide-react";
import type { NostrEvent } from "nostr-tools";

interface ZapButtonProps {
  target: NostrEvent;
  className?: string;
  showCount?: boolean;
  zapData?: { count: number; totalSats: number; isLoading?: boolean };
}

export function ZapButton({
  target,
  className = "text-xs ml-1",
  showCount = true,
  zapData: externalZapData,
}: ZapButtonProps) {
  const account = useActiveAccount();
  const profile = useProfile(target?.pubkey);
  const { webln, activeNWC } = useWallet();

  // Only fetch data if not provided externally
  const { totalSats: fetchedTotalSats, isLoading } = useZaps(
    externalZapData ? [] : (target ?? []), // Empty array prevents fetching if external data provided
    webln,
    activeNWC,
  );

  // Don't show zap button if user is not logged in, is the author, or author has no lightning address
  if (!account || !target || account.pubkey === target.pubkey || (!profile?.lud16 && !profile?.lud06)) {
    return null;
  }

  // Use external data if provided, otherwise use fetched data
  const totalSats = externalZapData?.totalSats ?? fetchedTotalSats;
  const showLoading = externalZapData?.isLoading || isLoading;

  return (
    <ZapDialog target={target}>
      <div className={`flex items-center gap-1 ${className}`}>
        <Zap className="h-4 w-4" />
        <span className="text-xs">
          {showLoading ? "..." : showCount && totalSats > 0 ? `${totalSats.toLocaleString()}` : "Zap"}
        </span>
      </div>
    </ZapDialog>
  );
}
