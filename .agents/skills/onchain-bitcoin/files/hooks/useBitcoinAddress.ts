import { usePolledFetch } from "@/hooks/usePolledFetch";
import { fetchAddressDetail, fetchBtcPrice } from "@/lib/bitcoin";

/**
 * Fetch full address details (balance + recent txs) via the mempool.space API.
 * Also fetches the current BTC/USD price for display.
 */
export function useBitcoinAddress(address: string) {
  const {
    data: addressDetail,
    isLoading,
    error,
    refetch,
  } = usePolledFetch(
    `bitcoin-address-detail:${address}`,
    () => fetchAddressDetail(address),
    { enabled: !!address, refetchInterval: 30_000 },
  );

  const { data: btcPrice } = usePolledFetch("btc-price", fetchBtcPrice, {
    refetchInterval: 60_000,
  });

  return { addressDetail, btcPrice, isLoading, error, refetch };
}
