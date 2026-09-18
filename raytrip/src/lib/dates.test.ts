import { describe, expect, it } from 'vitest';

import { formatDate, toDateInputValue, toValidDate } from './dates';

describe('date helpers', () => {
  it('formats valid backend date values', () => {
    expect(formatDate('2026-09-18')).toBe('Sep 18, 2026');
    expect(
      formatDate('2026-09-18T00:00:00.000Z', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    ).toBe('Sep 18, 2026');
    expect(toDateInputValue('2026-09-18T00:00:00.000Z')).toBe('2026-09-18');
  });

  it('uses safe fallbacks for absent or malformed values', () => {
    expect(toValidDate(undefined)).toBeNull();
    expect(toValidDate('not-a-date')).toBeNull();
    expect(formatDate(undefined)).toBe('Date unavailable');
    expect(formatDate('not-a-date')).toBe('Date unavailable');
    expect(toDateInputValue('not-a-date')).toBe('');
  });
});
