import { UserDataFunctions, type RayfinContext } from '@microsoft/fabric-user-data-functions';
import jpeg from 'jpeg-js';
import type { UniversalAppSchema } from '../../data/schema.js';
import {
  assemblePhoto, PHOTO_BACKEND, PHOTO_MAX_CHUNKS, validateManifest,
} from './photo-contract.js';

const udf = new UserDataFunctions();
type Context = RayfinContext<UniversalAppSchema>;

function validateId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid photo or trip identifier.');
}

async function readPhoto(photoId: string, ctx: Context) {
  validateId(photoId);
  const rows = await ctx.getDataClient().TripPhoto.select([
    'id', 'owner_id', 'trip_id', 'tripDay_id', 'storageBackend', 'uploadState',
    'byteLength', 'width', 'height', 'chunkCount', 'sha256', 'contentType',
  ]).where({ id: { eq: photoId } }).first(1).execute();
  return rows[0];
}

udf.func('beginTripPhotoUpload', async (
  photoId: string, tripId: string, dayId: string, fileName: string, caption: string,
  byteLength: number, width: number, height: number, chunkCount: number, sha256: string,
  ctx: RayfinContext<UniversalAppSchema>
): Promise<{ photoId: string; ownerId: string }> => {
  validateId(photoId);
  validateId(tripId);
  const manifest = validateManifest({ byteLength, width, height, chunkCount, sha256 });
  if (fileName.length > 255 || caption.length > 500) throw new Error('Filename or caption is too long.');
  const data = ctx.getDataClient();
  const trips = await data.Trip.select(['id', 'owner_id']).where({ id: { eq: tripId } }).first(1).execute();
  const trip = trips[0];
  if (!trip) throw new Error('Trip not found or you do not own it.');
  if (dayId) {
    validateId(dayId);
    const days = await data.TripDay.select(['id', 'trip_id', 'owner_id'])
      .where({ id: { eq: dayId } }).first(1).execute();
    if (!days[0] || days[0].trip_id !== tripId || days[0].owner_id !== trip.owner_id) {
      throw new Error('The selected day does not belong to your trip.');
    }
  }
  const existing = await readPhoto(photoId, ctx);
  if (existing) {
    if (existing.storageBackend !== PHOTO_BACKEND || existing.uploadState !== 'uploading'
      || existing.trip_id !== tripId || (existing.tripDay_id || '') !== dayId
      || existing.sha256 !== sha256 || existing.byteLength !== byteLength
      || existing.width !== width || existing.height !== height || existing.chunkCount !== chunkCount) {
      throw new Error('The upload identifier is already in use. Start a new upload.');
    }
    return { photoId, ownerId: existing.owner_id };
  }
  await data.TripPhoto.create({
    id: photoId, storageName: `${photoId}.jpg`, contentType: 'image/jpeg',
    caption: caption || undefined, fileName, createdAt: new Date(),
    trip_id: tripId, tripDay_id: dayId || undefined, owner_id: trip.owner_id,
    storageBackend: PHOTO_BACKEND, uploadState: 'uploading', ...manifest,
  });
  return { photoId, ownerId: trip.owner_id };
}, []);

udf.func('completeTripPhotoUpload', async (
  photoId: string, ctx: RayfinContext<UniversalAppSchema>
): Promise<{ photoId: string }> => {
  const photo = await readPhoto(photoId, ctx);
  if (!photo || photo.storageBackend !== PHOTO_BACKEND) throw new Error('SQL photo not found or you do not own it.');
  if (photo.uploadState !== 'uploading' && photo.uploadState !== 'ready') throw new Error('This photo is being deleted.');
  const manifest = validateManifest(photo);
  const data = ctx.getDataClient();
  const parts: { partIndex: number; content: string }[] = [];
  let cursor: string | undefined;
  do {
    const query = data.TripPhotoChunk.select(['id', 'partIndex', 'content'])
      .where({ photo_id: { eq: photoId } }).orderBy({ partIndex: 'asc', id: 'asc' }).first(100);
    const page = await (cursor ? query.after(cursor) : query).executePaginated();
    parts.push(...page.items);
    if (parts.length > PHOTO_MAX_CHUNKS) throw new Error('Too many photo parts.');
    if (page.hasNextPage && (!page.endCursor || cursor === page.endCursor)) throw new Error('Could not read all photo parts.');
    cursor = page.hasNextPage ? page.endCursor : undefined;
  } while (cursor);
  const bytes = await assemblePhoto(manifest, parts);
  let decoded: { width: number; height: number };
  try {
    decoded = jpeg.decode(bytes, { useTArray: true, tolerantDecoding: false, maxResolutionInMP: 3, maxMemoryUsageInMB: 64 });
  } catch {
    throw new Error('The stored image is not a valid bounded JPEG.');
  }
  if (photo.contentType !== 'image/jpeg' || decoded.width !== manifest.width || decoded.height !== manifest.height) {
    throw new Error('Photo dimensions or content type do not match the stored image.');
  }
  const current = await readPhoto(photoId, ctx);
  if (!current || current.uploadState === 'deleting') throw new Error('Photo was removed while uploading.');
  await data.TripPhoto.update({ id: photoId }, { uploadState: 'ready' });
  return { photoId };
}, []);

udf.func('deleteTripPhoto', async (
  photoId: string, ctx: RayfinContext<UniversalAppSchema>
): Promise<{ photoId: string; deleted: boolean }> => {
  const photo = await readPhoto(photoId, ctx);
  if (!photo) {
    console.log('Photo cleanup: no caller-visible metadata remains.', photoId);
    return { photoId, deleted: true };
  }
  const data = ctx.getDataClient();
  await data.TripPhoto.update({ id: photoId }, { uploadState: 'deleting' });
  for (;;) {
    const parts = await data.TripPhotoChunk.select(['id']).where({ photo_id: { eq: photoId } }).first(100).execute();
    if (!parts.length) break;
    for (let i = 0; i < parts.length; i += 4) {
      const results = await Promise.allSettled(parts.slice(i, i + 4).map(part => data.TripPhotoChunk.delete({ id: part.id })));
      const failure = results.find(result => result.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
    }
  }
  await data.TripPhoto.delete({ id: photoId });
  return { photoId, deleted: true };
}, []);
