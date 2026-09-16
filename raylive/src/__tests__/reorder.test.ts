import { describe, expect, it } from 'vitest';

import { moveItem, moveItemById } from '@/lib/reorder';

describe('moveItem', () => {
  const items = ['a', 'b', 'c', 'd'];

  it('moves an item down', () => {
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item up', () => {
    expect(moveItem(items, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('does not mutate the original list', () => {
    moveItem(items, 0, 3);
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });

  it('is a no-op for the same index', () => {
    expect(moveItem(items, 1, 1)).toEqual(items);
  });

  it('is a no-op out of bounds', () => {
    expect(moveItem(items, -1, 2)).toEqual(items);
    expect(moveItem(items, 0, 9)).toEqual(items);
    expect(moveItem(items, 9, 0)).toEqual(items);
  });

  it('keeps every item exactly once', () => {
    const result = moveItem(items, 2, 0);

    expect([...result].sort()).toEqual([...items].sort());
    expect(result).toHaveLength(items.length);
  });
});

describe('moveItemById', () => {
  const ids = ['x', 'y', 'z'];

  it('drops the active item onto the target position', () => {
    expect(moveItemById(ids, 'z', 'x')).toEqual(['z', 'x', 'y']);
  });

  it('ignores unknown ids', () => {
    expect(moveItemById(ids, 'nope', 'x')).toEqual(ids);
    expect(moveItemById(ids, 'x', 'nope')).toEqual(ids);
  });
});
