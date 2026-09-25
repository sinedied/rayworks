import type { TripPhoto } from '../../rayfin/data/TripPhoto';
import {
  assemblePhoto, PHOTO_BACKEND, PHOTO_MAX_CHUNKS, validateManifest,
} from '../../rayfin/functions/src/photo-contract';
import { preparePhoto } from '@/lib/photo-image';
import { getRayfinClient } from './rayfinClient';

export interface PhotoUploadOptions {
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

function retryable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('status' in error && typeof error.status === 'number') {
    return [408, 429, 500, 502, 503, 504].includes(error.status);
  }
  return 'name' in error && error.name === 'NetworkError';
}

async function retry<T>(action: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try { return await action(); }
    catch (error) {
      if (attempt === 2 || !retryable(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}

export async function listTripPhotos(tripId: string): Promise<TripPhoto[]> {
  const photos: TripPhoto[] = [];
  let cursor: string | undefined;
  do {
    const query = getRayfinClient().data.TripPhoto.select([
      'id', 'storageName', 'contentType', 'caption', 'createdAt', 'trip_id', 'tripDay_id', 'owner_id',
      'storageBackend', 'uploadState', 'fileName', 'byteLength', 'width', 'height', 'chunkCount', 'sha256',
    ]).where({ trip_id: { eq: tripId } }).orderBy({ createdAt: 'desc', id: 'asc' }).first(100);
    const page = await (cursor ? query.after(cursor) : query).executePaginated();
    photos.push(...page.items);
    if (page.hasNextPage && (!page.endCursor || cursor === page.endCursor)) throw new Error('Could not load all photos.');
    cursor = page.hasNextPage ? page.endCursor : undefined;
  } while (cursor);
  return photos;
}

export async function deleteTripPhoto(photo: Pick<TripPhoto, 'id'>): Promise<void> {
  const result = await retry(() => getRayfinClient().functions.deleteTripPhoto.invoke({ photoId: photo.id }));
  if (!result.deleted) throw new Error('Photo removal did not finish. Retry removal.');
}

export async function uploadTripPhoto(
  tripId: string, ownerId: string, file: File, caption?: string, tripDayId?: string,
  options: PhotoUploadOptions = {}
): Promise<void> {
  options.onProgress?.('Preparing an optimized photo…');
  const prepared = await preparePhoto(file, options.signal);
  options.signal?.throwIfAborted();
  const client = getRayfinClient();
  const photoId = crypto.randomUUID();
  const { parts, ...manifest } = prepared;
  try {
    const upload = await retry(() => client.functions.beginTripPhotoUpload.invoke({
      photoId, tripId, dayId: tripDayId || '', fileName: file.name.slice(0, 255),
      caption: caption?.trim() || '', ...manifest,
    }), options.signal);
    if (upload.ownerId !== ownerId || upload.photoId !== photoId) throw new Error('The upload session does not match your signed-in account.');

    let next = 0;
    let completed = 0;
    let stopped = false;
    const worker = async () => {
      try {
        while (!stopped && next < parts.length) {
          options.signal?.throwIfAborted();
          const partIndex = next++;
          const partKey = `${photoId}:${partIndex}`;
          const content = parts[partIndex];
          let attempted = false;
          await retry(async () => {
            if (attempted) {
              const existing = await client.data.TripPhotoChunk.select(['id', 'content'])
                .where({ partKey: { eq: partKey } }).first(1).execute();
              if (existing[0]) {
                if (existing[0].content !== content) throw new Error('A photo part conflicts with this upload.');
                return;
              }
            }
            attempted = true;
            await client.data.TripPhotoChunk.create({
              photo_id: photoId, partIndex, partKey, content, owner_id: upload.ownerId,
            });
          }, options.signal);
          completed++;
          options.onProgress?.(`Uploading photo: ${Math.round(completed / parts.length * 100)}%`);
        }
      } catch (error) { stopped = true; throw error; }
    };
    const results = await Promise.allSettled(Array.from({ length: Math.min(4, parts.length) }, worker));
    const failure = results.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    options.signal?.throwIfAborted();
    options.onProgress?.('Verifying and saving photo…');
    await retry(() => client.functions.completeTripPhotoUpload.invoke({ photoId }), options.signal);
    options.onProgress?.('Photo saved.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Photo upload failed.';
    try { await deleteTripPhoto({ id: photoId }); }
    catch (cleanup) {
      throw new Error(`${message} Cleanup also failed: ${cleanup instanceof Error ? cleanup.message : 'unavailable'}. Reload the trip and retry removal of the incomplete upload.`);
    }
    throw new Error(`${message} Incomplete photo data was removed.`);
  }
}

let activeDownloads = 0;
const waitingDownloads: (() => void)[] = [];

export async function getTripPhotoUrl(photo: TripPhoto): Promise<string> {
  if (photo.storageBackend !== PHOTO_BACKEND) throw new Error('This legacy photo used native storage, which is unavailable on Fabric. Please re-upload the image.');
  if (photo.uploadState !== 'ready') throw new Error('This photo upload is incomplete.');
  if (activeDownloads >= 2) await new Promise<void>(resolve => waitingDownloads.push(resolve));
  else activeDownloads++;
  try {
    const manifest = validateManifest(photo);
    const parts: { partIndex: number; content: string }[] = [];
    let cursor: string | undefined;
    do {
      const query = getRayfinClient().data.TripPhotoChunk.select(['id', 'partIndex', 'content'])
        .where({ photo_id: { eq: photo.id } }).orderBy({ partIndex: 'asc', id: 'asc' }).first(100);
      const page = await retry(() => (cursor ? query.after(cursor) : query).executePaginated());
      parts.push(...page.items);
      if (parts.length > PHOTO_MAX_CHUNKS) throw new Error('Too many photo parts.');
      if (page.hasNextPage && (!page.endCursor || cursor === page.endCursor)) throw new Error('Could not load the complete photo.');
      cursor = page.hasNextPage ? page.endCursor : undefined;
    } while (cursor);
    const bytes = await assemblePhoto(manifest, parts);
    return URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: 'image/jpeg' }));
  } finally {
    const next = waitingDownloads.shift();
    if (next) next();
    else activeDownloads--;
  }
}
