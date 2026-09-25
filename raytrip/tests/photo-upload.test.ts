import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  prepare: vi.fn(), begin: vi.fn(), complete: vi.fn(), remove: vi.fn(), create: vi.fn(), execute: vi.fn(),
}));
vi.mock('../src/lib/photo-image', () => ({ preparePhoto: mocks.prepare }));
vi.mock('../src/services/rayfinClient', () => ({
  getRayfinClient: () => {
    const builder = { where: () => builder, first: () => builder, execute: mocks.execute };
    return {
      functions: { beginTripPhotoUpload: { invoke: mocks.begin }, completeTripPhotoUpload: { invoke: mocks.complete }, deleteTripPhoto: { invoke: mocks.remove } },
      data: { TripPhotoChunk: { create: mocks.create, select: () => builder } },
    };
  },
}));
import { uploadTripPhoto } from '../src/services/photos';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.prepare.mockResolvedValue({ parts: ['AAAA', 'BBBB'], byteLength: 6, width: 1, height: 1, chunkCount: 2, sha256: 'x'.repeat(64) });
  mocks.begin.mockImplementation(async input => ({ photoId: input.photoId, ownerId: 'owner' }));
  mocks.remove.mockResolvedValue({ deleted: true });
  mocks.execute.mockResolvedValue([]);
});
const file = new File(['photo'], 'phone.png', { type: 'image/png' });
describe('upload recovery', () => {
  it('completes only after chunk writes finish and uses scalar foreign keys once', async () => {
    await uploadTripPhoto('trip', 'owner', file);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('photo');
    expect(mocks.complete).toHaveBeenCalledOnce();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('cleans up a partial upload and never reports success', async () => {
    mocks.create.mockRejectedValueOnce(new Error('Write failed'));
    await expect(uploadTripPhoto('trip', 'owner', file)).rejects.toThrow('Incomplete photo data was removed');
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it('surfaces cleanup errors and leaves a recoverable record', async () => {
    mocks.create.mockRejectedValueOnce(new Error('Write failed'));
    mocks.remove.mockRejectedValueOnce(new Error('Cleanup offline'));
    await expect(uploadTripPhoto('trip', 'owner', file)).rejects.toThrow('Cleanup also failed');
  });
  it('reconciles a timed-out chunk write instead of creating it again', async () => {
    mocks.prepare.mockResolvedValue({ parts: ['AAAA'], byteLength: 3, width: 1, height: 1, chunkCount: 1, sha256: 'x'.repeat(64) });
    mocks.create.mockRejectedValueOnce(Object.assign(new Error('Timeout'), { name: 'NetworkError' }));
    mocks.execute.mockResolvedValue([{ id: 'existing', content: 'AAAA' }]);
    await uploadTripPhoto('trip', 'owner', file);
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.complete).toHaveBeenCalledOnce();
  });
  it('cancellation stops scheduling and cleans up after in-flight requests settle', async () => {
    const controller = new AbortController();
    mocks.create.mockImplementation(async () => { controller.abort(); });
    await expect(uploadTripPhoto('trip', 'owner', file, undefined, undefined, { signal: controller.signal })).rejects.toThrow('removed');
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it('does not contact the backend when preparation fails', async () => {
    mocks.prepare.mockRejectedValue(new Error('Source too large'));
    await expect(uploadTripPhoto('trip', 'owner', file)).rejects.toThrow('Source too large');
    expect(mocks.begin).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
