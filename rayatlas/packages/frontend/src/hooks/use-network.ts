import type { NetworkData } from '@rayfin-app/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  configuredNetworkDataSource,
  loadNetwork,
  type NetworkDataSource,
} from '@/services/network.service';

export type NetworkStatus = 'loading' | 'ready' | 'error';

export interface UseNetworkResult {
  /** Last successfully loaded network; kept when a later refresh fails. */
  network: NetworkData | null;
  /**
   * `loading` until the first load settles, `ready` once data is available,
   * and `error` only when no data could be loaded at all.
   */
  status: NetworkStatus;
  /** Message from the most recent failed load, cleared on the next attempt. */
  error: string | null;
  /** True while reloading over already-loaded data. */
  isRefreshing: boolean;
  source: NetworkDataSource;
  retry: () => void;
}

interface NetworkState {
  network: NetworkData | null;
  status: NetworkStatus;
  error: string | null;
  isRefreshing: boolean;
}

export function useNetwork(): UseNetworkResult {
  const [source] = useState(configuredNetworkDataSource);
  const [state, setState] = useState<NetworkState>({
    network: null,
    status: 'loading',
    error: null,
    isRefreshing: false,
  });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setState((current) => ({
      ...current,
      status: current.network ? 'ready' : 'loading',
      isRefreshing: current.network !== null,
      error: null,
    }));

    try {
      const network = await loadNetwork(source);
      if (requestId.current !== currentRequest) return;
      setState({ network, status: 'ready', error: null, isRefreshing: false });
    } catch (error) {
      if (requestId.current !== currentRequest) return;
      setState((current) => ({
        ...current,
        status: current.network ? 'ready' : 'error',
        isRefreshing: false,
        error:
          error instanceof Error && error.message
            ? error.message
            : 'The story map data could not be loaded.',
      }));
    }
  }, [source]);

  useEffect(() => {
    void load();
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  return { ...state, source, retry };
}
