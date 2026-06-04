import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal async-data hook replacing `@tanstack/react-query`'s `useQuery` for
 * NON-Nostr HTTP fetches (e.g. mempool.space / CoinGecko block-explorer APIs).
 *
 * applesauce + `use$` covers reactive Nostr data; for plain HTTP we use this
 * tiny `useState` + `useEffect` + `AbortController` helper instead of pulling
 * in react-query. It supports:
 *
 * - `enabled`  — skip fetching until truthy (mirrors react-query's `enabled`).
 * - `refetchInterval` — re-run the fetch on an interval while mounted.
 * - `refetch()` — manual re-fetch trigger.
 *
 * The fetch function receives an `AbortSignal`; in-flight requests are aborted
 * on unmount or when dependencies change.
 */
export interface PolledFetchOptions {
  /** Skip fetching until truthy. Defaults to `true`. */
  enabled?: boolean;
  /** Re-run the fetch every N milliseconds while mounted. */
  refetchInterval?: number;
}

export interface PolledFetchResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePolledFetch<T>(
  /** Stable cache key — changing it resets state and re-fetches. */
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: PolledFetchOptions = {},
): PolledFetchResult<T> {
  const { enabled = true, refetchInterval } = options;

  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Keep the latest fetcher in a ref so the effect doesn't re-run when an
  // inline function identity changes on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Bumping this triggers a manual refetch.
  const [nonce, setNonce] = useState(0);
  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || !key) {
      setData(undefined);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      try {
        const result = await fetcherRef.current(controller.signal);
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();

    let interval: ReturnType<typeof setInterval> | undefined;
    if (refetchInterval && refetchInterval > 0) {
      interval = setInterval(run, refetchInterval);
    }

    return () => {
      cancelled = true;
      controller.abort();
      if (interval) clearInterval(interval);
    };
  }, [key, enabled, refetchInterval, nonce]);

  return { data, isLoading, error, refetch };
}
