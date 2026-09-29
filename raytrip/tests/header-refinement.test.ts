import { describe, expect, it } from 'vitest';
import { resolveHeaderPhotos } from '../src/lib/header-photos';
import { formatTripDateRange, snapshotTripDates } from '../rayfin/functions/src/report-dates';
import type { TripPhoto } from '../rayfin/data/TripPhoto';

function photo(index: number, overrides: Partial<TripPhoto> = {}): TripPhoto {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    trip_id: 'trip', owner_id: 'owner', storageBackend: 'sql-v1', uploadState: 'ready',
    createdAt: new Date(Date.UTC(2026, 2, 11, 0, index)), storageName: `${index}.jpg`, contentType: 'image/jpeg',
    ...overrides,
  };
}

describe('automatic header photos', () => {
  it.each([0, 1, 5, 6, 8])('uses the earliest ready uploads from %i photos without mutating gallery order', count => {
    const images = Array.from({ length: count }, (_, i) => photo(i + 1)).reverse();
    const before = [...images];
    const selection = resolveHeaderPhotos('trip', null, images);
    expect(selection.automatic).toBe(true);
    expect(selection.ids).toEqual([...images].reverse().slice(0, 6).map(p => p.id));
    expect(images).toEqual(before);
    expect(selection.missing).toBe(false);
  });
  it('uses ID as a stable tie-breaker and ignores unfinished, legacy and other-trip photos', () => {
    const a = photo(1);
    const b = photo(2, { createdAt: a.createdAt });
    const images = [b, a, photo(3, { uploadState: 'uploading' }), photo(4, { uploadState: 'deleting' }),
      photo(5, { storageBackend: undefined }), photo(6, { trip_id: 'other' })];
    expect(resolveHeaderPhotos('trip', undefined, images).ids).toEqual([a.id, b.id]);
  });
  it('fills empty slots on upload and replaces deleted defaults, not custom picks', () => {
    const images = Array.from({ length: 7 }, (_, i) => photo(i + 1));
    const original = resolveHeaderPhotos('trip', null, images.slice(0, 6));
    expect(resolveHeaderPhotos('trip', null, images).ids).toEqual(original.ids);
    expect(resolveHeaderPhotos('trip', null, images.slice(1)).ids).toEqual(images.slice(1).map(p => p.id));
    const custom = resolveHeaderPhotos('trip', JSON.stringify([images[0].id]), images.slice(1));
    expect(custom.photos).toEqual([]);
    expect(custom.missing).toBe(true);
    expect(custom.automatic).toBe(false);
  });
  it('preserves a custom order and explicitly empty custom selection', () => {
    const images = [photo(1), photo(2), photo(3)];
    expect(resolveHeaderPhotos('trip', JSON.stringify([images[2].id, images[0].id]), images).photos).toEqual([images[2], images[0]]);
    expect(resolveHeaderPhotos('trip', '[]', images)).toEqual({ ids: [], photos: [], automatic: false, missing: false });
  });
  it('reports invalid selection or upload dates instead of silently resetting the header', () => {
    expect(() => resolveHeaderPhotos('trip', '', [photo(1)])).toThrow('invalid');
    expect(() => resolveHeaderPhotos('trip', 'bad json', [photo(1)])).toThrow('invalid');
    expect(() => resolveHeaderPhotos('trip', null, [photo(1, { createdAt: new Date('invalid') })])).toThrow('upload date');
    expect(resolveHeaderPhotos('trip', '[]', [photo(1, { createdAt: new Date('invalid') })]).photos).toEqual([]);
  });
});

describe('report trip dates', () => {
  it('formats single-day and multi-day trips without generated/finalized labels', () => {
    expect(formatTripDateRange('2026-03-11', '2026-03-11')).toBe('Mar 11, 2026');
    expect(formatTripDateRange('2026-03-11', '2026-03-13')).toBe('Mar 11, 2026 – Mar 13, 2026');
    expect(formatTripDateRange('2026-12-31', '2027-01-02')).toBe('Dec 31, 2026 – Jan 2, 2027');
  });
  it('preserves date-only UTC days independently of browser timezone', () => {
    expect(formatTripDateRange(new Date('2026-03-11T00:00:00Z'), new Date('2026-03-11T00:00:00Z'))).toBe('Mar 11, 2026');
    expect(snapshotTripDates({ startDate: '2026-03-11T18:00:00Z', endDate: '2026-03-13T19:00:00Z' }))
      .toEqual({ tripStartDate: new Date('2026-03-11'), tripEndDate: new Date('2026-03-13') });
  });
  it('leaves legacy missing dates absent and reports malformed date ranges', () => {
    expect(formatTripDateRange(null, undefined)).toBeNull();
    expect(formatTripDateRange('invalid', '2026-03-11')).toBe('Trip dates unavailable');
    expect(() => snapshotTripDates({ startDate: '2026-03-13', endDate: '2026-03-11' })).toThrow('trip dates');
  });
});
