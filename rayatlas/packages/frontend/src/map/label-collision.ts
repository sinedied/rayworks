/**
 * Where a label sits relative to its marker. `above-left` and friends hug the dot's edge and
 * extend in that direction, for markers too close to a screen edge to center a label.
 */
export type LabelSide =
  | 'right' | 'left' | 'below' | 'above'
  | 'below-left' | 'above-left' | 'below-right' | 'above-right';

/** Label sides in preference order. */
export const LABEL_SIDES: readonly LabelSide[] = [
  'right', 'left', 'below', 'above', 'below-left', 'above-left', 'below-right', 'above-right',
];

/** Top-left corner of a `width` × `height` label on `side` of a dot of radius `half`, relative to the dot center. */
export function labelOffset(side: LabelSide, half: number, gap: number, width: number, height: number) {
  const [vertical, horizontal] = side.includes('-') ? side.split('-') : [side, ''];
  if (vertical === 'right') return { x: half + gap, y: -height / 2 };
  if (vertical === 'left') return { x: -half - gap - width, y: -height / 2 };
  const y = vertical === 'below' ? half + gap : -half - gap - height;
  const x = horizontal === 'left' ? half - width : horizontal === 'right' ? -half : -width / 2;
  return { x, y };
}

export interface LabelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A marker label with the screen rectangles (CSS pixels) it could occupy, in preference order. */
export interface LabelCandidate {
  id: string;
  /** Higher priority labels are placed first. */
  priority: number;
  options: Array<LabelRect & { side: LabelSide }>;
}

function overlaps(a: LabelRect, b: LabelRect, gap: number): boolean {
  return a.x < b.x + b.width + gap
    && b.x < a.x + a.width + gap
    && a.y < b.y + b.height + gap
    && b.y < a.y + a.height + gap;
}

/**
 * Greedy label placement: highest priority first, each label takes its first option that stays
 * inside the viewport and clear of labels and `obstacles` (e.g. marker dots) already placed.
 * Labels with no free option are hidden. Ties keep input order, so results are stable.
 */
export function placeLabels(
  candidates: readonly LabelCandidate[],
  viewport: { width: number; height: number },
  obstacles: readonly LabelRect[] = [],
  gap = 4,
): Map<string, LabelSide> {
  const ordered = candidates
    .map((candidate, order) => ({ candidate, order }))
    .sort((a, b) => b.candidate.priority - a.candidate.priority || a.order - b.order);
  const placed: LabelRect[] = [];
  const result = new Map<string, LabelSide>();
  for (const { candidate } of ordered) {
    const option = candidate.options.find((rect) =>
      rect.x >= 0 && rect.y >= 0
      && rect.x + rect.width <= viewport.width && rect.y + rect.height <= viewport.height
      && !placed.some((other) => overlaps(rect, other, gap))
      && !obstacles.some((other) => overlaps(rect, other, 0)));
    if (!option) continue;
    placed.push(option);
    result.set(candidate.id, option.side);
  }
  return result;
}
