import type { TripPhoto } from '../../rayfin/data/TripPhoto';
import { HEADER_PHOTO_LIMIT, parseHeaderPhotoIds } from '../../rayfin/report-cover';

export function resolveHeaderPhotos(tripId: string, selection: string | null | undefined, photos: readonly TripPhoto[]) {
  const ready = photos.filter(photo =>
    photo.trip_id === tripId && photo.storageBackend === 'sql-v1' && photo.uploadState === 'ready'
  );
  const automatic = selection == null;
  let ids: string[];
  if (automatic) {
    const dated = ready.map(photo => {
      const timestamp = new Date(photo.createdAt).getTime();
      if (!Number.isFinite(timestamp)) {
        throw new Error('A photo has an invalid upload date. Choose header photos manually.');
      }
      return { photo, timestamp };
    });
    dated.sort((a, b) => a.timestamp - b.timestamp || a.photo.id.localeCompare(b.photo.id));
    ids = dated.slice(0, HEADER_PHOTO_LIMIT).map(item => item.photo.id);
  } else {
    ids = parseHeaderPhotoIds(selection);
  }
  const chosen = ids.flatMap(id => ready.filter(photo => photo.id === id));
  return { ids, photos: chosen, automatic, missing: chosen.length !== ids.length };
}
