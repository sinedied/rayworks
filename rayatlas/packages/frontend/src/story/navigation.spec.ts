import { describe, expect, it } from 'vitest';

import { isEditableTarget, navigationActionForKey, navigationReducer, type NavigationState } from './navigation';

describe('navigationReducer', () => {
  const start: NavigationState = { index: 0, count: 10 };

  it('steps forward and back within bounds', () => {
    const next = navigationReducer(start, { type: 'next' });
    expect(next.index).toBe(1);
    expect(navigationReducer(next, { type: 'previous' }).index).toBe(0);
    expect(navigationReducer(start, { type: 'previous' })).toBe(start);
    const last = navigationReducer(start, { type: 'last' });
    expect(last.index).toBe(9);
    expect(navigationReducer(last, { type: 'next' })).toBe(last);
    expect(navigationReducer(last, { type: 'first' }).index).toBe(0);
  });

  it('clamps jumps and resizes', () => {
    expect(navigationReducer(start, { type: 'go', index: 4.7 }).index).toBe(4);
    expect(navigationReducer(start, { type: 'go', index: 99 }).index).toBe(9);
    expect(navigationReducer(start, { type: 'go', index: Number.NaN })).toBe(start);
    expect(navigationReducer({ index: 8, count: 10 }, { type: 'resize', count: 5 })).toEqual({ index: 4, count: 5 });
    expect(navigationReducer(start, { type: 'resize', count: 0 })).toEqual({ index: 0, count: 0 });
  });
});

describe('navigationActionForKey', () => {
  it('maps presentation keys', () => {
    expect(navigationActionForKey('ArrowRight')).toEqual({ type: 'next' });
    expect(navigationActionForKey('PageDown')).toEqual({ type: 'next' });
    expect(navigationActionForKey(' ')).toEqual({ type: 'next' });
    expect(navigationActionForKey(' ', true)).toEqual({ type: 'previous' });
    expect(navigationActionForKey('ArrowLeft')).toEqual({ type: 'previous' });
    expect(navigationActionForKey('PageUp')).toEqual({ type: 'previous' });
    expect(navigationActionForKey('Home')).toEqual({ type: 'first' });
    expect(navigationActionForKey('End')).toEqual({ type: 'last' });
    expect(navigationActionForKey('a')).toBeNull();
  });

  it('recognizes editable targets', () => {
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
