import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkError, SdkError } from '../node_modules/@microsoft/rayfin-lib/dist/index.js';
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
afterEach(() => vi.useRealTimers());
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
    vi.useFakeTimers();
    mocks.prepare.mockResolvedValue({ parts: ['AAAA'], byteLength: 3, width: 1, height: 1, chunkCount: 1, sha256: 'x'.repeat(64) });
    mocks.create.mockRejectedValueOnce(new SdkError('Request timed out after 30000ms'));
    mocks.execute.mockResolvedValue([{ id: 'existing', content: 'AAAA' }]);
    const upload = uploadTripPhoto('trip', 'owner', file);
    await vi.runAllTimersAsync();
    await upload;
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
  it('uploads 175 parts, including the last partial part, before finalizing', async () => {
    const parts = [...Array<string>(174).fill('A'.repeat(4000)), 'A'.repeat(3052)];
    mocks.prepare.mockResolvedValue({ parts, byteLength: 524288, width: 1600, height: 1200, chunkCount: 175, sha256: 'a'.repeat(64) });
    mocks.complete.mockImplementation(async () => {
      expect(mocks.create).toHaveBeenCalledTimes(175);
    });
    await uploadTripPhoto('trip', 'owner', file);
    const writes = mocks.create.mock.calls.map(([part]) => part);
    expect(writes.map(part => part.partIndex)).toEqual(Array.from({ length: 175 }, (_, index) => index));
    expect(new Set(writes.map(part => part.partKey)).size).toBe(175);
    expect(writes[174].content).toHaveLength(3052);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it.each(['begin', 'create', 'complete'] as const)('recovers a transient HTTP 500 at %s', async stage => {
    vi.useFakeTimers();
    mocks[stage].mockRejectedValueOnce(new NetworkError('HTTP Error 500', 500));
    const upload = uploadTripPhoto('trip', 'owner', file);
    await vi.runAllTimersAsync();
    await upload;
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.complete).toHaveBeenCalled();
  });
  it.each([
    ['begin', 'Starting photo upload failed'],
    ['create', 'Uploading photo part 1/2 failed'],
    ['complete', 'Verifying photo upload failed'],
  ] as const)('identifies persistent %s failures after bounded retries', async (stage, message) => {
    vi.useFakeTimers();
    mocks[stage].mockRejectedValue(new NetworkError('HTTP Error 500', 500));
    const assertion = expect(uploadTripPhoto('trip', 'owner', file)).rejects.toThrow(`${message}: HTTP Error 500`);
    await vi.runAllTimersAsync();
    await assertion;
    if (stage !== 'create') expect(mocks[stage]).toHaveBeenCalledTimes(3);
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
  it('reconciles an HTTP 500 after a middle chunk was committed without writing a duplicate', async () => {
    vi.useFakeTimers();
    const parts = [...Array<string>(154).fill('A'.repeat(4000)), 'AAAA'];
    mocks.prepare.mockResolvedValue({ parts, byteLength: 462003, width: 1200, height: 1600, chunkCount: parts.length, sha256: 'a'.repeat(64) });
    mocks.create.mockImplementation(async part => {
      if (part.partIndex === 100) throw new NetworkError('HTTP Error 500', 500);
    });
    mocks.execute.mockResolvedValue([{ id: 'already-written', content: parts[100] }]);
    const upload = uploadTripPhoto('trip', 'owner', file);
    await vi.runAllTimersAsync();
    await upload;
    expect(mocks.create).toHaveBeenCalledTimes(155);
    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(mocks.complete).toHaveBeenCalledOnce();
  });
  it.each([
    new NetworkError('Forbidden', 403),
    new SdkError('Unexpected error: invalid payload'),
  ])('does not retry permanent SDK failures: $message', async error => {
    mocks.begin.mockRejectedValue(error);
    await expect(uploadTripPhoto('trip', 'owner', file)).rejects.toThrow(error.message);
    expect(mocks.begin).toHaveBeenCalledOnce();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('retries completion with the same photo ID if its response times out', async () => {
    vi.useFakeTimers();
    mocks.complete.mockRejectedValueOnce(new SdkError('Request timed out after 250000ms'));
    const upload = uploadTripPhoto('trip', 'owner', file);
    await vi.runAllTimersAsync();
    await upload;
    expect(mocks.complete).toHaveBeenCalledTimes(2);
    expect(mocks.complete.mock.calls[0][0]).toEqual(mocks.complete.mock.calls[1][0]);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
