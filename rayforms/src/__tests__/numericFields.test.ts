import { describe, expect, it } from 'vitest';
import { getEntityMetadata } from '@microsoft/rayfin-core';
import { FormField } from '../../rayfin/data/FormField';

import {
  defaultRatingSettings,
  ratingChoiceCount,
  readNumericSettings,
  serializeNumericSettings,
  validateNumericAnswer,
  validateNumericSettings,
} from '../lib/numericFields';

describe('numeric settings', () => {
  it('declares additive nullable settings and the expanded enum in entity metadata', () => {
    const metadata = getEntityMetadata(FormField);
    expect(metadata.fields.numericSettings).toMatchObject({ isOptional: true, max: 4000 });
    expect(metadata.fields.kind.enum).toContain('rating');
  });
  it('keeps legacy number fields unbounded', () => {
    for (const stored of [undefined, null, '']) {
      expect(readNumericSettings('number', stored)).toEqual({ settings: {}, error: null });
    }
  });

  it('round-trips decimal bounds, zero, and cleared settings', () => {
    const settings = { min: -2.5, max: 0 };
    expect(readNumericSettings('number', serializeNumericSettings('number', settings)))
      .toEqual({ settings, error: null });
    expect(serializeNumericSettings('number', {})).toBe('');
    expect(serializeNumericSettings('shortText', settings)).toBe('');
    expect(serializeNumericSettings('number', { min: 0, interval: 2, minLabel: 'old' }))
      .toBe('{"min":0}');
  });

  it('validates inclusive number bounds without requiring both', () => {
    expect(validateNumericSettings('number', { min: 0 })).toBeNull();
    expect(validateNumericSettings('number', { max: -1 })).toBeNull();
    expect(validateNumericSettings('number', { min: 1, max: 1 })).toBeNull();
    expect(validateNumericSettings('number', { min: 2, max: 1 })).toBeTruthy();
    expect(validateNumericSettings('number', { min: NaN })).toBeTruthy();
    expect(validateNumericSettings('number', { max: Infinity })).toBeTruthy();
  });

  it('defaults ratings to 1/5/1 and counts selectable values', () => {
    expect(defaultRatingSettings()).toEqual({ min: 1, max: 5, interval: 1 });
    for (const [min, max, interval, count] of [
      [1, 5, 1, 5], [0, 4, 1, 5], [0, 5, 1, 6], [10, 50, 10, 5], [1, 11, 2, 6],
    ]) {
      expect(ratingChoiceCount({ min, max, interval })).toBe(count);
    }
  });

  it.each([
    {},
    { min: 1, max: 5 },
    { min: 1, max: 1, interval: 1 },
    { min: 5, max: 1, interval: 1 },
    { min: 1, max: 5, interval: 0 },
    { min: 1, max: 5, interval: -1 },
    { min: 1, max: 5, interval: 0.5 },
    { min: 0.5, max: 5, interval: 1 },
    { min: 1, max: 5, interval: 3 },
    { min: -Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER, interval: 1 },
    { min: 1, max: 5, interval: 1, maxLabel: 'x'.repeat(501) },
    { min: 1, max: 5, interval: 1, minLabel: '\u0001'.repeat(500), maxLabel: '\u0001'.repeat(500) },
  ])('rejects invalid rating settings %j', (settings) => {
    expect(validateNumericSettings('rating', settings)).toBeTruthy();
    expect(() => serializeNumericSettings('rating', settings)).toThrow();
  });

  it('rejects corrupt or missing persisted rating settings', () => {
    for (const stored of ['', '{', 'null', '[]', '{"min":"1"}', '{"min":null}', '{"extra":3}']) {
      expect(readNumericSettings('rating', stored).error).toBeTruthy();
    }
    expect(readNumericSettings('number', '{').error).toBeTruthy();
  });

  it('trims endpoint text without changing numeric values', () => {
    expect(JSON.parse(serializeNumericSettings('rating', {
      ...defaultRatingSettings(), minLabel: ' Not useful ', maxLabel: ' ',
    }))).toEqual({ min: 1, max: 5, interval: 1, minLabel: 'Not useful' });
  });
});

describe('numeric answers', () => {
  it('allows blanks, decimals, and inclusive endpoints for numbers', () => {
    const settings = { min: -2.5, max: 3.5 };
    for (const value of ['', ' ', '-2.5', '0', '1.25', '3.5']) {
      expect(validateNumericAnswer('number', settings, value)).toBeNull();
    }
    for (const value of ['-2.51', '3.51', 'NaN', 'Infinity', '1e309', 'oops']) {
      expect(validateNumericAnswer('number', settings, value)).toBeTruthy();
    }
  });

  it('enforces the rating grid without treating blank as zero', () => {
    const settings = { min: 1, max: 11, interval: 2 };
    for (const value of ['', '1', '3', '11']) {
      expect(validateNumericAnswer('rating', settings, value)).toBeNull();
    }
    for (const value of ['0', '2', '3.5', '12']) {
      expect(validateNumericAnswer('rating', settings, value)).toBeTruthy();
    }
  });
});
