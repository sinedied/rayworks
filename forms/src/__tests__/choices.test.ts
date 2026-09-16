import { describe, it, expect } from 'vitest';

import { parseStringArray } from '../lib/choices';

describe('parseStringArray', () => {
  it('parses a JSON-encoded string array', () => {
    expect(parseStringArray('["Red","Blue"]')).toEqual(['Red', 'Blue']);
  });

  it('returns an empty array for empty input', () => {
    expect(parseStringArray(undefined)).toEqual([]);
    expect(parseStringArray(null)).toEqual([]);
    expect(parseStringArray('')).toEqual([]);
  });

  it('does not throw on malformed JSON', () => {
    expect(parseStringArray('not json')).toEqual([]);
    expect(parseStringArray('{"a":1}')).toEqual([]);
  });

  it('drops non-string members', () => {
    expect(parseStringArray('["Red",1,null,"Blue"]')).toEqual(['Red', 'Blue']);
  });
});
