import { useCallback, useEffect, useState } from 'react';

import { loadPlaces, type Place, type PlaceIndex } from '@/lib/places';

export type PlaceIndexStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Lazily loads the bundled city index once `enabled` turns true. `retry` re-attempts after a
 * failed load (the loader forgets failures, so a later call fetches the chunk again).
 */
export function usePlaceIndex(enabled: boolean) {
  const [index, setIndex] = useState<PlaceIndex | null>(null);
  const [status, setStatus] = useState<PlaceIndexStatus>('idle');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || index) return;
    let cancelled = false;
    setStatus('loading');
    loadPlaces().then(
      (loaded) => {
        if (cancelled) return;
        setIndex(loaded);
        setStatus('ready');
      },
      () => {
        if (!cancelled) setStatus('error');
      }
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, index, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { index, status, retry };
}

/** Resolves a GeoNames id to its bundled place; `undefined` while loading or when unknown. */
export function usePlace(placeId: string | null | undefined): Place | undefined {
  const { index } = usePlaceIndex(!!placeId);
  return placeId ? index?.get(placeId) : undefined;
}
