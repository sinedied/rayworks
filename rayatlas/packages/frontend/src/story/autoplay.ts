import { useEffect, useRef } from 'react';

import type { StoryScene } from './scenes';

export const MIN_READING_MS = 4000;
export const MAX_READING_MS = 14000;
export const MS_PER_WORD = 280;

export function countWords(...texts: Array<string | null | undefined>): number {
  return texts.join(' ').split(/\s+/).filter(Boolean).length;
}

/**
 * How long autoplay stays on a scene: the camera flight plus time to read its caption, clamped so
 * short captions still breathe and long ones never stall the room.
 */
export function sceneDwellMs(scene: Pick<StoryScene, 'duration'>, words: number): number {
  const reading = Math.min(MAX_READING_MS, Math.max(MIN_READING_MS, words * MS_PER_WORD));
  return Math.round(Math.max(0, scene.duration) + reading);
}

export interface AutoplayOptions {
  playing: boolean;
  index: number;
  count: number;
  dwellMs: number;
  onAdvance: () => void;
  /** Called after dwelling on the last scene; autoplay should stop. */
  onFinish: () => void;
}

/** Advances one scene after `dwellMs` while playing. Restarts the dwell whenever the scene changes. */
export function useAutoplay({ playing, index, count, dwellMs, onAdvance, onFinish }: AutoplayOptions) {
  const callbacks = useRef({ onAdvance, onFinish });
  useEffect(() => {
    callbacks.current = { onAdvance, onFinish };
  });

  useEffect(() => {
    if (!playing || count <= 0) return;
    const isLast = index >= count - 1;
    const timer = setTimeout(() => {
      if (isLast) callbacks.current.onFinish();
      else callbacks.current.onAdvance();
    }, dwellMs);
    return () => clearTimeout(timer);
  }, [playing, index, count, dwellMs]);
}
