import { describe, expect, it, vi } from 'vitest';
import jpeg from '../rayfin/functions/node_modules/jpeg-js';
import { photoHash, splitPhoto } from '../rayfin/functions/src/photo-contract';

const registrations = vi.hoisted(() => vi.fn());
vi.mock('../rayfin/functions/node_modules/@microsoft/fabric-user-data-functions/dist/index.js', () => ({
  UserDataFunctions: class { func = registrations; },
}));
await import('../rayfin/functions/src/photo-functions');
const begin = registrations.mock.calls.find(call => call[0] === 'beginTripPhotoUpload')![1];
const complete = registrations.mock.calls.find(call => call[0] === 'completeTripPhotoUpload')![1];
const remove = registrations.mock.calls.find(call => call[0] === 'deleteTripPhoto')![1];
const photoId = '00000000-0000-4000-8000-000000000001';
const tripId = '00000000-0000-4000-8000-000000000002';
const dayId = '00000000-0000-4000-8000-000000000003';

function query() {
  const execute = vi.fn().mockResolvedValue([]);
  const executePaginated = vi.fn().mockResolvedValue({ items: [], hasNextPage: false });
  const builder = {
    where: vi.fn(() => builder), first: vi.fn(() => builder), orderBy: vi.fn(() => builder),
    after: vi.fn(() => builder), execute, executePaginated,
  };
  return { select: vi.fn(() => builder), create: vi.fn(), update: vi.fn(), delete: vi.fn(), builder };
}

async function setup(input?: { bytes: Uint8Array; width: number; height: number }) {
  const width = input?.width ?? 4;
  const height = input?.height ?? 4;
  const bytes = input?.bytes ?? jpeg.encode({ width, height, data: Buffer.alloc(width * height * 4, 200) }, 80).data;
  const chunks = splitPhoto(bytes).map((content, partIndex) => ({ id: String(partIndex), content, partIndex }));
  const photo = { id: photoId, trip_id: tripId, owner_id: 'owner', storageBackend: 'sql-v1', uploadState: 'uploading',
    byteLength: bytes.length, width, height, chunkCount: chunks.length, sha256: await photoHash(bytes), contentType: 'image/jpeg' };
  const data = { Trip: query(), TripDay: query(), TripPhoto: query(), TripPhotoChunk: query() };
  data.Trip.builder.execute.mockResolvedValue([{ id: tripId, owner_id: 'owner' }]);
  data.TripPhoto.builder.execute.mockResolvedValue([photo]);
  data.TripPhotoChunk.builder.executePaginated.mockResolvedValue({ items: chunks, hasNextPage: false });
  const ctx = { getDataClient: () => data };
  const args = [photoId, tripId, '', 'phone.jpg', 'Caption', photo.byteLength, photo.width, photo.height, photo.chunkCount, photo.sha256, ctx];
  return { ctx, data, photo, chunks, args };
}

describe('SQL photo functions', () => {
  it('stamps ownership from the authorized trip and rejects an unrelated day', async () => {
    const s = await setup();
    s.data.TripPhoto.builder.execute.mockResolvedValue([]);
    await expect(begin(...s.args)).resolves.toEqual({ photoId, ownerId: 'owner' });
    expect(s.data.TripPhoto.create).toHaveBeenCalledWith(expect.objectContaining({ owner_id: 'owner', uploadState: 'uploading', trip_id: tripId }));
    s.args[2] = dayId;
    s.data.TripDay.builder.execute.mockResolvedValue([{ id: dayId, trip_id: 'wrong-trip', owner_id: 'owner' }]);
    await expect(begin(...s.args)).rejects.toThrow('does not belong');
  });
  it('denies parent access when RLS returns no trip', async () => {
    const s = await setup();
    s.data.Trip.builder.execute.mockResolvedValue([]);
    await expect(begin(...s.args)).rejects.toThrow('do not own');
    expect(s.data.TripPhoto.create).not.toHaveBeenCalled();
  });
  it('validates JPEG before publishing and permits completing a valid upload again', async () => {
    const s = await setup();
    await expect(complete(photoId, s.ctx)).resolves.toEqual({ photoId });
    expect(s.data.TripPhoto.update).toHaveBeenCalledWith({ id: photoId }, { uploadState: 'ready' });
    s.photo.uploadState = 'ready';
    await expect(complete(photoId, s.ctx)).resolves.toEqual({ photoId });
  });
  it('does not mark incomplete, corrupt, or inaccessible photos ready', async () => {
    const s = await setup();
    s.data.TripPhotoChunk.builder.executePaginated.mockResolvedValue({ items: [], hasNextPage: false });
    await expect(complete(photoId, s.ctx)).rejects.toThrow('incomplete');
    expect(s.data.TripPhoto.update).not.toHaveBeenCalled();
    s.data.TripPhoto.builder.execute.mockResolvedValue([]);
    await expect(complete(photoId, s.ctx)).rejects.toThrow('do not own');
  });
  it('reads every chunk page and validates a realistic high-detail JPEG', async () => {
    const width = 1200;
    const height = 1600;
    const pixels = Buffer.alloc(width * height * 4);
    let seed = 1;
    for (let i = 0; i < pixels.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      pixels[i] = seed & 255; pixels[i + 1] = (seed >>> 8) & 255; pixels[i + 2] = (seed >>> 16) & 255; pixels[i + 3] = 255;
    }
    const bytes = jpeg.encode({ width, height, data: pixels }, 15).data;
    const s = await setup({ bytes, width, height });
    expect(s.chunks.length).toBeGreaterThan(100);
    expect(bytes.length).toBeLessThanOrEqual(524288);
    s.data.TripPhotoChunk.builder.executePaginated
      .mockResolvedValueOnce({ items: s.chunks.slice(0, 100), hasNextPage: true, endCursor: 'next-page' })
      .mockResolvedValueOnce({ items: s.chunks.slice(100), hasNextPage: false });
    await expect(complete(photoId, s.ctx)).resolves.toEqual({ photoId });
    expect(s.data.TripPhotoChunk.builder.after).toHaveBeenCalledWith('next-page');
    expect(s.data.TripPhotoChunk.builder.executePaginated).toHaveBeenCalledTimes(2);
    expect(s.data.TripPhoto.update).toHaveBeenCalledWith({ id: photoId }, { uploadState: 'ready' });
  });
  it('removes all chunk pages before deleting the metadata', async () => {
    const s = await setup();
    s.data.TripPhotoChunk.builder.execute.mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => ({ id: String(i) })))
      .mockResolvedValueOnce([{ id: 'last' }]).mockResolvedValueOnce([]);
    await remove(photoId, s.ctx);
    expect(s.data.TripPhoto.update).toHaveBeenCalledWith({ id: photoId }, { uploadState: 'deleting' });
    expect(s.data.TripPhotoChunk.delete).toHaveBeenCalledTimes(101);
    expect(s.data.TripPhoto.delete).toHaveBeenCalledOnce();
    expect(s.data.TripPhotoChunk.builder.after).not.toHaveBeenCalled();
  });
  it('retains metadata when cleanup fails so removal can be retried', async () => {
    const s = await setup();
    s.data.TripPhotoChunk.builder.execute.mockResolvedValue([{ id: 'part' }]);
    s.data.TripPhotoChunk.delete.mockRejectedValue(new Error('Offline'));
    await expect(remove(photoId, s.ctx)).rejects.toThrow('Offline');
    expect(s.data.TripPhoto.delete).not.toHaveBeenCalled();
  });
});
