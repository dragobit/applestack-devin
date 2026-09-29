import { useCallback, useMemo } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useToast } from "@/hooks/useToast";
import { pool } from "@/services/nostr";
import { WalletConnect } from "applesauce-wallet-connect";
import { parseWalletConnectURI } from "applesauce-wallet-connect/helpers";
import { assertInvoiceAmount } from "@/lib/bolt11";

export interface NWCConnection {
  connectionString: string;
  alias?: string;
  isConnected: boolean;
}

export interface NWCInfo {
  alias?: string;
  color?: string;
  pubkey?: string;
  network?: string;
  methods?: string[];
  notifications?: string[];
}

/**
 * Create a WalletConnect client for a connection string, backed by the global relay pool.
 * The pool is passed so the client can subscribe/publish through the app's relay connections.
 */
function createWallet(connectionString: string): WalletConnect {
  return WalletConnect.fromConnectURI(connectionString, { pool });
}

export function useNWCInternal() {
  const { toast } = useToast();
  const [connections, setConnections] = useLocalStorage<NWCConnection[]>(
    "nwc-connections",
    [],
  );
  const [activeConnection, setActiveConnection] = useLocalStorage<
    string | null
  >("nwc-active-connection", null);

  // Static info we can derive from the connection string itself (no network round-trip required)
  const connectionInfo = useMemo<Record<string, NWCInfo>>(() => {
    const info: Record<string, NWCInfo> = {};
    for (const connection of connections) {
      info[connection.connectionString] = {
        alias: connection.alias,
        methods: ["pay_invoice"],
      };
    }
    return info;
  }, [connections]);

  // Add a new connection
  const addConnection = async (
    uri: string,
    alias?: string,
  ): Promise<boolean> => {
    // Validate the connection string by parsing it
    try {
      parseWalletConnectURI(uri);
    } catch {
      toast({
        title: "Invalid NWC URI",
        description: "Please check the connection string and try again.",
        variant: "destructive",
      });
      return false;
    }

    const existingConnection = connections.find(
      (c) => c.connectionString === uri,
    );
    if (existingConnection) {
      toast({
        title: "Connection already exists",
        description: "This wallet is already connected.",
        variant: "destructive",
      });
      return false;
    }

    try {
      // Create the client to confirm the URI is usable
      createWallet(uri);

      const connection: NWCConnection = {
        connectionString: uri,
        alias: alias || "NWC Wallet",
        isConnected: true,
      };

      const newConnections = [...connections, connection];
      setConnections(newConnections);

      if (connections.length === 0 || !activeConnection)
        setActiveConnection(uri);

      toast({
        title: "Wallet connected",
        description: `Successfully connected to ${connection.alias}.`,
      });

      return true;
    } catch (error) {
      console.error("NWC connection failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      toast({
        title: "Connection failed",
        description: `Could not connect to the wallet: ${errorMessage}`,
        variant: "destructive",
      });
      return false;
    }
  };

  // Remove a connection
  const removeConnection = (connectionString: string) => {
    const filtered = connections.filter(
      (c) => c.connectionString !== connectionString,
    );
    setConnections(filtered);

    if (activeConnection === connectionString) {
      const newActive =
        filtered.length > 0 ? filtered[0].connectionString : null;
      setActiveConnection(newActive);
    }

    toast({
      title: "Wallet disconnected",
      description: "The wallet connection has been removed.",
    });
  };

  // Get the active connection
  const getActiveConnection = useCallback((): NWCConnection | null => {
    if (!activeConnection && connections.length > 0) {
      setActiveConnection(connections[0].connectionString);
      return connections[0];
    }

    if (!activeConnection) return null;

    const found = connections.find(
      (c) => c.connectionString === activeConnection,
    );
    return found || null;
  }, [activeConnection, connections, setActiveConnection]);

  // Send a payment using a WalletConnect client created from the connection string
  const sendPayment = useCallback(
    async (
      connection: NWCConnection,
      invoice: string,
      /**
       * Amount in millisatoshis the user approved. The wallet is handed only
       * the invoice, so this is the last point at which the sum the user
       * agreed to and the sum the invoice charges can be compared — without
       * it, whoever issued the invoice decides how much leaves the wallet.
       */
      expectedAmountMsat: number,
    ): Promise<{ preimage: string }> => {
      if (!connection.connectionString) {
        throw new Error("Invalid connection: missing connection string");
      }

      assertInvoiceAmount(invoice, expectedAmountMsat);

      let wallet: WalletConnect;
      try {
        wallet = createWallet(connection.connectionString);
      } catch (error) {
        console.error("Failed to create NWC client:", error);
        throw new Error(
          `Failed to create NWC client: ${error instanceof Error ? error.message : "Unknown error"}`,
          { cause: error },
        );
      }

      try {
        // WalletConnect.payInvoice handles the encrypted NIP-47 request/response over the relay pool,
        // including its own request timeout (configurable via the `timeout` option on the client).
        const response = await wallet.payInvoice(invoice);
        return { preimage: response.preimage };
      } catch (error) {
        console.error("NWC payment failed:", error);

        if (error instanceof Error) {
          if (error.message.includes("timeout")) {
            throw new Error("Payment timed out. Please try again.", {
              cause: error,
            });
          } else if (error.message.includes("insufficient")) {
            throw new Error("Insufficient balance in connected wallet.", {
              cause: error,
            });
          } else if (error.message.includes("invalid")) {
            throw new Error(
              "Invalid invoice or connection. Please check your wallet.",
              { cause: error },
            );
          } else {
            throw new Error(`Payment failed: ${error.message}`, {
              cause: error,
            });
          }
        }

        throw new Error("Payment failed with unknown error", { cause: error });
      }
    },
    [],
  );

  return {
    connections,
    activeConnection,
    connectionInfo,
    addConnection,
    removeConnection,
    setActiveConnection,
    getActiveConnection,
    sendPayment,
  };
}
