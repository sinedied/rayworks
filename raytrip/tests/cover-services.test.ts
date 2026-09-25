import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import jpeg from '../rayfin/functions/node_modules/jpeg-js';
import { photoHash, splitPhoto } from '../rayfin/functions/src/photo-contract';
import { reportCoverPayload } from '../rayfin/report-cover';

const mocks = vi.hoisted(() => ({ photos: vi.fn(), updateTrip: vi.fn(), updateReport: vi.fn() }));
vi.mock('../src/services/photos', () => ({
  listTripPhotos: mocks.photos, uploadTripPhoto: vi.fn(), getTripPhotoUrl: vi.fn(), deleteTripPhoto: vi.fn(),
}));
vi.mock('../src/services/rayfinClient', () => ({
  getRayfinClient: () => ({ data: { Trip: { update: mocks.updateTrip }, TripReport: { update: mocks.updateReport } } }),
}));
import { saveTripHeaderPhotos, saveTripReport, finalizeTripReport, reopenTripReport } from '../src/services/trips';

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllGlobals());

it('validates selected photos and stores only their IDs on the private trip', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  mocks.photos.mockResolvedValue([{ id, trip_id: 'trip', storageBackend: 'sql-v1', uploadState: 'ready' }]);
  await saveTripHeaderPhotos('trip', [id]);
  expect(mocks.updateTrip).toHaveBeenCalledWith({ id: 'trip' }, { headerPhotoIds: JSON.stringify([id]), updatedAt: expect.any(Date) });
  mocks.photos.mockResolvedValue([{ id, trip_id: 'other', storageBackend: 'sql-v1', uploadState: 'ready' }]);
  await expect(saveTripHeaderPhotos('trip', [id])).rejects.toThrow('unavailable');
  expect(mocks.updateTrip).toHaveBeenCalledTimes(1);
  await saveTripHeaderPhotos('trip', []);
  expect(mocks.updateTrip).toHaveBeenLastCalledWith({ id: 'trip' }, { headerPhotoIds: '[]', updatedAt: expect.any(Date) });
});

it('publishes the content and complete image together and clears every part when disabled', async () => {
  const bytes = jpeg.encode({ width: 2, height: 1, data: Buffer.alloc(8, 255) }, 70).data;
  const cover = { width: 2, height: 1, byteLength: bytes.length, sha256: await photoHash(bytes), parts: splitPhoto(bytes) };
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 2, height: 1, close: vi.fn() }));
  await finalizeTripReport('report', 'Content', cover);
  expect(mocks.updateReport).toHaveBeenCalledExactlyOnceWith({ id: 'report' }, {
    content: 'Content', status: 'finalized', finalizedAt: expect.any(Date), ...reportCoverPayload(cover),
  });
  await saveTripReport('report', 'Content', null);
  expect(mocks.updateReport).toHaveBeenLastCalledWith({ id: 'report' }, { content: 'Content', ...reportCoverPayload(null) });
  await reopenTripReport('report');
  expect(mocks.updateReport).toHaveBeenLastCalledWith({ id: 'report' }, { status: 'draft', finalizedAt: null });
});

it('does not save an invalid cover or silently drop an enabled image', async () => {
  await expect(finalizeTripReport('report', 'Content', { byteLength: 32769, width: 1200, height: 360, sha256: '0'.repeat(64), parts: [] })).rejects.toThrow();
  expect(mocks.updateReport).not.toHaveBeenCalled();
});
