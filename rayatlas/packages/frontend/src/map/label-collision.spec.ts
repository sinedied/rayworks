import { describe, expect, it } from 'vitest';

import { LABEL_SIDES, labelOffset, placeLabels, type LabelCandidate } from './label-collision';

const box = (id: string, priority: number, x: number, y = 10): LabelCandidate => ({
  id,
  priority,
  options: [
    { side: 'right', x, y, width: 80, height: 20 },
    { side: 'left', x: x - 100, y, width: 80, height: 20 },
  ],
});

describe('placeLabels', () => {
  const viewport = { width: 400, height: 200 };

  it('keeps the higher priority label and moves or drops the other', () => {
    const placed = placeLabels([box('low', 1, 150), box('high', 9, 160)], viewport);
    expect(placed.get('high')).toBe('right');
    expect(placed.get('low')).toBe('left');
  });

  it('hides labels with no free, in-bounds option', () => {
    const placed = placeLabels([box('a', 5, 30), box('b', 1, 40)], viewport);
    expect(placed.get('a')).toBe('right');
    expect(placed.has('b')).toBe(false);
  });

  it('avoids obstacles such as marker dots', () => {
    const placed = placeLabels([box('a', 5, 200)], viewport, [{ x: 210, y: 12, width: 10, height: 10 }]);
    expect(placed.get('a')).toBe('left');
  });

  it('offsets labels around the dot, including edge-hugging sides', () => {
    expect(LABEL_SIDES.slice(0, 4)).toEqual(['right', 'left', 'below', 'above']);
    expect(labelOffset('right', 5, 8, 100, 30)).toEqual({ x: 13, y: -15 });
    expect(labelOffset('left', 5, 8, 100, 30)).toEqual({ x: -113, y: -15 });
    expect(labelOffset('above', 5, 8, 100, 30)).toEqual({ x: -50, y: -43 });
    expect(labelOffset('above-left', 5, 8, 100, 30)).toEqual({ x: -95, y: -43 });
    expect(labelOffset('below-right', 5, 8, 100, 30)).toEqual({ x: -5, y: 13 });
  });
});
