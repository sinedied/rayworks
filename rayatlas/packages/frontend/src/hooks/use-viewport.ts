import { useEffect, useState, type RefObject } from 'react';

/** Below this width the map docks on top and chapters scroll beneath it. */
export const COMPACT_MAX_WIDTH = 640;

export interface Viewport {
  width: number;
  height: number;
  compact: boolean;
}

function readViewport(): Viewport {
  const width = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const height = typeof window === 'undefined' ? 800 : window.innerHeight;
  return { width, height, compact: width <= COMPACT_MAX_WIDTH };
}

export function useViewport(): Viewport {
  const [viewport, setViewport] = useState(readViewport);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readViewport();
        setViewport((current) => (
          current.width === next.width && current.height === next.height ? current : next
        ));
      });
    };
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
    };
  }, []);
  return viewport;
}

/**
 * Index of the tracked element nearest a horizontal reading line, updated on scroll. An element
 * that straddles the line wins outright; otherwise the closest edge wins.
 */
export function nearestToLine(rects: ReadonlyArray<{ top: number; bottom: number } | null>, line: number): number {
  let best = 0;
  let bestDistance = Infinity;
  rects.forEach((rect, index) => {
    if (!rect) return;
    const distance = rect.top <= line && rect.bottom >= line
      ? 0
      : Math.min(Math.abs(rect.top - line), Math.abs(rect.bottom - line));
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

export function useActiveIndex(
  elements: RefObject<Array<HTMLElement | null>>,
  readingLine: () => number,
  enabled: boolean,
): number {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rects = elements.current.map((element) => element?.getBoundingClientRect() ?? null);
      setActive(nearestToLine(rects, readingLine()));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [elements, readingLine, enabled]);
  return active;
}

/** `value` once it has stopped changing for `delay` ms. */
export function useSettledValue<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (Object.is(value, settled)) return;
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, settled, delay]);
  return settled;
}
