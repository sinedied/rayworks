export const MIN_SPLIT_RATIO = 0.15;
export const MAX_SPLIT_RATIO = 0.85;

export function splitBounds(availableWidth: number) {
  if (availableWidth <= 0) return { min: MIN_SPLIT_RATIO, max: MAX_SPLIT_RATIO };
  // Keep room for the slide label and the notes zoom toolbar on compact screens.
  const compactScale = Math.min(1, availableWidth / (96 + 180));
  return {
    min: Math.max(MIN_SPLIT_RATIO, 96 * compactScale / availableWidth),
    max: Math.min(MAX_SPLIT_RATIO, 1 - 180 * compactScale / availableWidth),
  };
}

export function clampSplit(ratio: number, availableWidth: number) {
  const { min, max } = splitBounds(availableWidth);
  return Math.min(max, Math.max(min, ratio));
}
