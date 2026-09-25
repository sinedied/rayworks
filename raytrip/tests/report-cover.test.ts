import { afterEach, describe, expect, it, vi } from 'vitest';
import jpeg from '../rayfin/functions/node_modules/jpeg-js';
import { mosaicLayout } from '../src/lib/photo-mosaic';
import { coverBlob } from '../src/lib/report-cover';
import { COVER_BYTE_LIMIT, COVER_PART_FIELDS, parseHeaderPhotoIds, readReportCover, reportCoverPayload } from '../rayfin/report-cover';
import { photoHash, splitPhoto } from '../rayfin/functions/src/photo-contract';
import { createTripPhotoCache } from '../src/hooks/useTripPhotos';
import type { TripPhoto } from '../rayfin/data/TripPhoto';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('BSP mosaic geometry', () => {
  it.each([0, 1, 2, 3, 4, 5, 6])('tiles %i photos deterministically without overlaps or uncovered area', count => {
    const images = Array.from({ length: count }, (_, i) => ({ width: i % 2 ? 600 : 400, height: i % 2 ? 400 : 600 }));
    for (const [width, height] of [[1200, 360], [358, 220]]) {
      const tiles = mosaicLayout(images, width, height);
      expect(tiles).toEqual(mosaicLayout(images, width, height));
      expect(tiles.map(t => t.index)).toEqual(images.map((_, i) => i));
      if (count) expect(tiles.reduce((sum, t) => sum + t.width * t.height, 0)).toBeCloseTo(width * height);
      for (const [i, a] of tiles.entries()) {
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.y).toBeGreaterThanOrEqual(0);
        expect(a.x + a.width).toBeLessThanOrEqual(width + 1e-6);
        expect(a.y + a.height).toBeLessThanOrEqual(height + 1e-6);
        for (const b of tiles.slice(i + 1)) {
          const overlapWidth = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const overlapHeight = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          expect(overlapWidth <= 1e-6 || overlapHeight <= 1e-6).toBe(true);
        }
      }
    }
  });
});

describe('report cover privacy contract', () => {
  it('defaults existing rows off and rejects invalid or duplicate selections', () => {
    expect(readReportCover({})).toBeNull();
    expect(readReportCover({ includePhotoHeader: false, headerImagePart01: 'bad' })).toBeNull();
    expect(parseHeaderPhotoIds(null)).toEqual([]);
    const id = '00000000-0000-4000-8000-000000000001';
    expect(parseHeaderPhotoIds(JSON.stringify([id]))).toEqual([id]);
    expect(() => parseHeaderPhotoIds(JSON.stringify([id, id]))).toThrow();
    expect(() => parseHeaderPhotoIds('not json')).toThrow();
    expect(() => parseHeaderPhotoIds(JSON.stringify(Array(7).fill(id)))).toThrow();
  });
  it('clears every byte and metadata field on opt-out', () => {
    const cleared = reportCoverPayload(null);
    expect(cleared.includePhotoHeader).toBe(false);
    for (const [key, value] of Object.entries(cleared)) {
      if (key !== 'includePhotoHeader') expect(value).toBeNull();
    }
    expect(COVER_PART_FIELDS.every(field => Object.hasOwn(cleared, field))).toBe(true);
  });
  it('round trips a flattened JPEG and detects corruption, missing parts and oversize', async () => {
    const bytes = jpeg.encode({ width: 40, height: 12, data: Buffer.alloc(40 * 12 * 4, 160) }, 65).data;
    const cover = { byteLength: bytes.length, width: 40, height: 12, sha256: await photoHash(bytes), parts: splitPhoto(bytes) };
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 40, height: 12, close }));
    expect(readReportCover(reportCoverPayload(cover))).toEqual(cover);
    const blob = await coverBlob(cover);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array(bytes));
    expect(close).toHaveBeenCalled();
    await expect(coverBlob({ ...cover, sha256: '0'.repeat(64) })).rejects.toThrow('integrity');
    expect(() => readReportCover({ ...reportCoverPayload(cover), headerImagePart01: null })).toThrow('incomplete');
    expect(() => reportCoverPayload({ ...cover, byteLength: COVER_BYTE_LIMIT + 1 })).toThrow();
  });
});

describe('private trip photo cache', () => {
  const photo: TripPhoto = { id: 'photo', owner_id: 'owner', trip_id: 'trip', contentType: 'image/jpeg', storageName: 'photo', createdAt: new Date() };
  it('shares a download between header/gallery and revokes it when the trip ends', async () => {
    const load = vi.fn().mockResolvedValue('blob:one');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const cache = createTripPhotoCache(load);
    const a = cache.acquire(photo);
    const b = cache.acquire(photo);
    expect(await a.promise).toBe('blob:one');
    expect(await b.promise).toBe('blob:one');
    expect(load).toHaveBeenCalledOnce();
    a.release(); b.release();
    cache.dispose();
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:one');
  });
  it('releases late results after disposal and does not reuse failed loads', async () => {
    let finish!: (url: string) => void;
    const load = vi.fn().mockRejectedValueOnce(new Error('failed')).mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve; }));
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const cache = createTripPhotoCache(load);
    const failed = cache.acquire(photo);
    await expect(failed.promise).rejects.toThrow('failed');
    failed.release();
    const late = cache.acquire(photo);
    cache.dispose();
    finish('blob:late');
    await expect(late.promise).rejects.toThrow('ended');
    expect(revoke).toHaveBeenCalledWith('blob:late');
  });
});
