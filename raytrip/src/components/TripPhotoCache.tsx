import { useEffect, useRef, type ReactNode } from 'react';
import { getTripPhotoUrl } from '@/services/trips';
import { PhotoCacheContext, createTripPhotoCache } from '@/hooks/useTripPhotos';

export function TripPhotoCacheProvider({ children }: { children: ReactNode }) {
  const ref = useRef<ReturnType<typeof createTripPhotoCache> | null>(null);
  if (!ref.current) ref.current = createTripPhotoCache(getTripPhotoUrl);
  const cache = ref.current;
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => { if (!mounted.current) cache.dispose(); });
    };
  }, [cache]);
  return <PhotoCacheContext.Provider value={cache}>{children}</PhotoCacheContext.Provider>;
}
