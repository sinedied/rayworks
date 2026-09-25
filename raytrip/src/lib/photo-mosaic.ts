export interface MosaicImage { width: number; height: number }
export interface MosaicTile { index: number; x: number; y: number; width: number; height: number }

export function mosaicLayout(images: readonly MosaicImage[], width: number, height: number): MosaicTile[] {
  if (images.length > 6 || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
    || images.some(image => !Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width <= 0 || image.height <= 0)) {
    throw new Error('Invalid photo mosaic dimensions or photo count.');
  }
  if (!images.length) return [];
  function partition(start: number, count: number, x: number, y: number, w: number, h: number): { score: number; tiles: MosaicTile[] } {
    if (count === 1) {
      return {
        score: Math.abs(Math.log((w / h) / (images[start].width / images[start].height))),
        tiles: [{ index: start, x, y, width: w, height: h }],
      };
    }
    let best: { score: number; tiles: MosaicTile[] } | undefined;
    for (let split = 1; split < count; split++) {
      for (const vertical of [true, false]) {
        const ratio = split / count;
        const a = partition(start, split, x, y, vertical ? w * ratio : w, vertical ? h : h * ratio);
        const b = partition(start + split, count - split,
          vertical ? x + w * ratio : x, vertical ? y : y + h * ratio,
          vertical ? w * (1 - ratio) : w, vertical ? h : h * (1 - ratio));
        const candidate = { score: a.score + b.score, tiles: [...a.tiles, ...b.tiles] };
        if (!best || candidate.score < best.score) best = candidate;
      }
    }
    if (!best) throw new Error('Could not arrange the photo mosaic.');
    return best;
  }
  return partition(0, images.length, 0, 0, width, height).tiles;
}
