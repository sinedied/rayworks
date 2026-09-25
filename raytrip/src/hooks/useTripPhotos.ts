import { createContext, useContext, useEffect, useState } from 'react';
import type { TripPhoto } from '../../rayfin/data/TripPhoto';

interface Entry {
  users: number;
  promise: Promise<string>;
  url?: string;
}

export function createTripPhotoCache(load: (photo: TripPhoto) => Promise<string>) {
  const entries = new Map<string, Entry>();
  let disposed = false;
  function remove(key: string, entry: Entry) {
    if (entry.url) { URL.revokeObjectURL(entry.url); entry.url = undefined; }
    if (entries.get(key) === entry) entries.delete(key);
  }
  function evict() {
    for (const [key, entry] of entries) {
      if (entries.size <= 12) break;
      if (!entry.users) remove(key, entry);
    }
  }
  return {
    acquire(photo: TripPhoto) {
      if (disposed) throw new Error('This photo session has ended.');
      const key = `${photo.owner_id}:${photo.id}:${photo.sha256 || ''}`;
      let entry = entries.get(key);
      if (!entry) {
        const created: Entry = { users: 0, promise: Promise.resolve('') };
        created.promise = load(photo).then(url => {
          if (disposed || entries.get(key) !== created) {
            URL.revokeObjectURL(url);
            throw new Error('This photo session has ended.');
          }
          created.url = url;
          return url;
        }).catch(error => {
          remove(key, created);
          throw error;
        });
        entry = created;
        entries.set(key, entry);
      }
      entry.users++;
      const held = entry;
      let released = false;
      evict();
      return {
        promise: entry.promise,
        release() {
          if (released) return;
          released = true;
          held.users--;
          if (disposed) remove(key, held);
          else evict();
        },
      };
    },
    dispose() {
      disposed = true;
      for (const [key, entry] of entries) remove(key, entry);
    },
  };
}

export const PhotoCacheContext = createContext<ReturnType<typeof createTripPhotoCache> | null>(null);

export function useTripPhotoCache() {
  const cache = useContext(PhotoCacheContext);
  if (!cache) throw new Error('Private photo rendering requires a trip-scoped cache.');
  return cache;
}

export function useTripPhoto(photo: TripPhoto, enabled = true, attempt = 0) {
  const cache = useTripPhotoCache();
  const [state, setState] = useState<{ url: string | null; error: string }>({ url: null, error: '' });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ url: null, error: '' });
    const lease = cache.acquire(photo);
    lease.promise.then(url => {
      if (active) setState({ url, error: '' });
    }).catch(error => {
      if (active) setState({ url: null, error: error instanceof Error ? error.message : 'Could not load the photo.' });
    });
    return () => { active = false; lease.release(); };
  }, [cache, photo, enabled, attempt]);
  return enabled ? state : { url: null, error: '' };
}
