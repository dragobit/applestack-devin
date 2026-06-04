import { useState, useMemo, useEffect, useCallback } from "react";
import { useActiveAccount } from "applesauce-react/hooks";
import { useUser } from "@/hooks/useUser";
import { use$ } from "@/hooks/use$";
import { useToast } from "@/hooks/useToast";
import { useNWC } from "@/hooks/useNWCContext";
import type { NWCConnection } from "@/hooks/useNWC";
import { eventStore, zapsLoader } from "@/services/nostr";
import { extraRelays } from "@/services/settings";
import { EventZapsModel } from "applesauce-common/models";
import { ZapRequestFactory } from "applesauce-common/factories";
import { getZapAmount, parseLNURLOrAddress } from "applesauce-common/helpers";
import type { NostrEvent } from "nostr-tools";
import type { WebLNProvider } from "@webbtc/webln-types";

export function useZaps(
  target: NostrEvent | NostrEvent[],
  webln: WebLNProvider | null,
  _nwcConnection: NWCConnection | null,
  onZapSuccess?: () => void,
) {
  const { toast } = useToast();
  const account = useActiveAccount();

  // Handle the case where an empty array is passed (from ZapButton when external data is provided)
  const actualTarget = Array.isArray(target) ? (target.length > 0 ? target[0] : null) : target;

  // Reactive profile of the author for LNURL lookup
  const author = useUser(actualTarget?.pubkey);
  const authorProfile = use$(() => author?.profile$, [author?.pubkey]);

  const { sendPayment, getActiveConnection } = useNWC();
  const [isZapping, setIsZapping] = useState(false);
  const [invoice, setInvoice] = useState<string | null>(null);

  // Cleanup state when component unmounts
  useEffect(() => {
    return () => {
      setIsZapping(false);
      setInvoice(null);
    };
  }, []);

  // Trigger the zaps loader for this target (cold observable, subscribe to start fetching)
  useEffect(() => {
    if (!actualTarget) return;
    const sub = zapsLoader(actualTarget).subscribe();
    return () => sub.unsubscribe();
  }, [actualTarget]);

  // Reactively read zap receipts (kind 9735) for this event from the EventStore
  const zapEvents = use$(
    () => (actualTarget ? eventStore.model(EventZapsModel, actualTarget) : undefined),
    [actualTarget?.id],
  );

  // Process zap events into simple counts and totals
  const { zapCount, totalSats, zaps } = useMemo(() => {
    if (!zapEvents || !Array.isArray(zapEvents) || !actualTarget) {
      return { zapCount: 0, totalSats: 0, zaps: [] as NostrEvent[] };
    }

    let count = 0;
    let sats = 0;

    for (const zap of zapEvents) {
      count++;
      // getZapAmount returns the amount in millisats (parsed from the bolt11 invoice / amount tag)
      const msats = getZapAmount(zap);
      if (typeof msats === "number") sats += Math.floor(msats / 1000);
    }

    return { zapCount: count, totalSats: sats, zaps: zapEvents as NostrEvent[] };
  }, [zapEvents, actualTarget]);

  const zap = async (amount: number, comment: string) => {
    if (amount <= 0) {
      return;
    }

    setIsZapping(true);
    setInvoice(null); // Clear any previous invoice at the start

    if (!account) {
      toast({
        title: "Login required",
        description: "You must be logged in to send a zap.",
        variant: "destructive",
      });
      setIsZapping(false);
      return;
    }

    if (!actualTarget) {
      toast({
        title: "Event not found",
        description: "Could not find the event to zap.",
        variant: "destructive",
      });
      setIsZapping(false);
      return;
    }

    try {
      const lud16 = authorProfile?.lud16;
      const lud06 = authorProfile?.lud06;
      if (!lud16 && !lud06) {
        toast({
          title: "Lightning address not found",
          description: "The author does not have a lightning address configured.",
          variant: "destructive",
        });
        setIsZapping(false);
        return;
      }

      // Resolve the LNURL pay endpoint from the author's lightning address
      const lnurlUrl = parseLNURLOrAddress((lud16 || lud06) as string);
      if (!lnurlUrl) {
        toast({
          title: "Zap endpoint not found",
          description: "Could not find a zap endpoint for the author.",
          variant: "destructive",
        });
        setIsZapping(false);
        return;
      }

      const zapAmount = amount * 1000; // convert to millisats
      const relays = extraRelays.getValue();

      // Build and sign the zap request (kind 9734). ZapRequestFactory.event sets the
      // correct e/a/k/p tags based on the target event's kind, including 'a' tags for
      // addressable events (30000-39999).
      const zapRequest = await ZapRequestFactory.event(actualTarget, zapAmount, relays)
        .message(comment)
        .sign(account.signer);

      try {
        // Fetch the LNURL callback to get the invoice for this zap request
        const callback = new URL(lnurlUrl.toString());
        callback.searchParams.set("amount", String(zapAmount));
        callback.searchParams.set("nostr", JSON.stringify(zapRequest));

        const res = await fetch(callback.toString());
        const responseData = await res.json();

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${responseData.reason || "Unknown error"}`);
        }
        if (responseData.status === "ERROR") {
          throw new Error(responseData.reason || "Lightning service returned an error");
        }

        const newInvoice = responseData.pr;
        if (!newInvoice || typeof newInvoice !== "string") {
          throw new Error("Lightning service did not return a valid invoice");
        }

        // Get the current active NWC connection dynamically
        const currentNWCConnection = getActiveConnection();

        // Try NWC first if available and properly connected
        if (currentNWCConnection && currentNWCConnection.connectionString && currentNWCConnection.isConnected) {
          try {
            await sendPayment(currentNWCConnection, newInvoice);

            setIsZapping(false);
            setInvoice(null);

            toast({
              title: "Zap successful!",
              description: `You sent ${amount} sats via NWC to the author.`,
            });

            // The zaps loader / relay subscription will pick up the new receipt automatically.
            onZapSuccess?.();
            return;
          } catch (nwcError) {
            console.error("NWC payment failed, falling back:", nwcError);

            const errorMessage = nwcError instanceof Error ? nwcError.message : "Unknown NWC error";
            toast({
              title: "NWC payment failed",
              description: `${errorMessage}. Falling back to other payment methods...`,
              variant: "destructive",
            });
          }
        }

        if (webln) {
          // Try WebLN next
          try {
            let webLnProvider = webln;
            if (webln.enable && typeof webln.enable === "function") {
              const enabledProvider = await webln.enable();
              const provider = enabledProvider as WebLNProvider | undefined;
              if (provider) {
                webLnProvider = provider;
              }
            }

            await webLnProvider.sendPayment(newInvoice);

            setIsZapping(false);
            setInvoice(null);

            toast({
              title: "Zap successful!",
              description: `You sent ${amount} sats to the author.`,
            });

            onZapSuccess?.();
          } catch (weblnError) {
            console.error("WebLN payment failed, falling back:", weblnError);

            const errorMessage = weblnError instanceof Error ? weblnError.message : "Unknown WebLN error";
            toast({
              title: "WebLN payment failed",
              description: `${errorMessage}. Falling back to other payment methods...`,
              variant: "destructive",
            });

            setInvoice(newInvoice);
            setIsZapping(false);
          }
        } else {
          // Default - show QR code and manual Lightning URI
          setInvoice(newInvoice);
          setIsZapping(false);
        }
      } catch (err) {
        console.error("Zap error:", err);
        toast({
          title: "Zap failed",
          description: (err as Error).message,
          variant: "destructive",
        });
        setIsZapping(false);
      }
    } catch (err) {
      console.error("Zap error:", err);
      toast({
        title: "Zap failed",
        description: (err as Error).message,
        variant: "destructive",
      });
      setIsZapping(false);
    }
  };

  const resetInvoice = useCallback(() => {
    setInvoice(null);
  }, []);

  return {
    zaps,
    zapCount,
    totalSats,
    isLoading: zapEvents === undefined,
    zap,
    isZapping,
    invoice,
    setInvoice,
    resetInvoice,
  };
}
