import { usePolledFetch } from "@/hooks/usePolledFetch";
import { fetchTxDetail, fetchBtcPrice } from "@/lib/bitcoin";

/**
 * Fetch full transaction details for a Bitcoin txid via the mempool.space API.
 * Also fetches the current BTC/USD price for display.
 */
export function useBitcoinTx(txid: string) {
  const {
    data: tx,
    isLoading,
    error,
  } = usePolledFetch(`bitcoin-tx-detail:${txid}`, () => fetchTxDetail(txid), {
    enabled: !!txid,
  });

  const { data: btcPrice } = usePolledFetch("btc-price", fetchBtcPrice, {
    refetchInterval: 60_000,
  });

  return { tx, btcPrice, isLoading, error };
}
