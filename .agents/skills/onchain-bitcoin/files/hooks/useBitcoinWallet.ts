import { useMemo } from "react";
import { useActiveAccount } from "applesauce-react/hooks";

import { usePolledFetch } from "@/hooks/usePolledFetch";
import {
  nostrPubkeyToBitcoinAddress,
  fetchAddressData,
  fetchBtcPrice,
  fetchTransactions,
} from "@/lib/bitcoin";

/**
 * Hook that derives a Bitcoin Taproot address from the current user's Nostr
 * pubkey and fetches the on-chain balance from the mempool.space API.
 *
 * Balance auto-refreshes every 30 seconds while the component is mounted.
 * BTC/USD price refreshes every 60 seconds.
 */
export function useBitcoinWallet() {
  const account = useActiveAccount();

  const bitcoinAddress = useMemo(() => {
    if (!account) return "";
    return nostrPubkeyToBitcoinAddress(account.pubkey);
  }, [account]);

  const {
    data: addressData,
    isLoading,
    error,
    refetch,
  } = usePolledFetch(
    `bitcoin-balance:${bitcoinAddress}`,
    () => fetchAddressData(bitcoinAddress),
    { enabled: !!bitcoinAddress, refetchInterval: 30_000 },
  );

  const { data: btcPrice } = usePolledFetch("btc-price", fetchBtcPrice, {
    refetchInterval: 60_000,
  });

  const { data: transactions, isLoading: isLoadingTxs } = usePolledFetch(
    `bitcoin-txs:${bitcoinAddress}`,
    () => fetchTransactions(bitcoinAddress),
    { enabled: !!bitcoinAddress, refetchInterval: 30_000 },
  );

  return {
    /** The derived bc1p... Taproot address. */
    bitcoinAddress,
    /** Balance and transaction data (undefined while loading). */
    addressData,
    /** Current BTC price in USD. */
    btcPrice,
    /** Transaction history for the address. */
    transactions,
    /** Whether the initial balance fetch is in progress. */
    isLoading,
    /** Whether transactions are still loading. */
    isLoadingTxs,
    /** Error from the balance query, if any. */
    error,
    /** Manually trigger a balance refresh. */
    refetch,
    /** The current user's hex pubkey (convenience). */
    pubkey: account?.pubkey ?? "",
  };
}
