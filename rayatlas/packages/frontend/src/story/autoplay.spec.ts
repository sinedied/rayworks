import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { countWords, MAX_READING_MS, MIN_READING_MS, sceneDwellMs, useAutoplay, type AutoplayOptions } from './autoplay';

describe('sceneDwellMs', () => {
  it('adds clamped reading time to the flight', () => {
    expect(sceneDwellMs({ duration: 4000 }, 0)).toBe(4000 + MIN_READING_MS);
    expect(sceneDwellMs({ duration: 4000 }, 30)).toBe(4000 + 30 * 280);
    expect(sceneDwellMs({ duration: 6000 }, 500)).toBe(6000 + MAX_READING_MS);
    expect(sceneDwellMs({ duration: -10 }, 0)).toBe(MIN_READING_MS);
  });

  it('counts words across texts', () => {
    expect(countWords('From ridge', ' to  cup ', null)).toBe(4);
  });
});

describe('useAutoplay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (initial: Partial<AutoplayOptions>) => {
    const onAdvance = vi.fn();
    const onFinish = vi.fn();
    const hook = renderHook((props: AutoplayOptions) => useAutoplay(props), {
      initialProps: { playing: true, index: 0, count: 3, dwellMs: 1000, onAdvance, onFinish, ...initial },
    });
    return { ...hook, onAdvance, onFinish };
  };

  it('advances after the dwell and restarts the timer on each scene', () => {
    const { rerender, onAdvance, onFinish } = setup({});
    act(() => { vi.advanceTimersByTime(999); });
    expect(onAdvance).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onAdvance).toHaveBeenCalledTimes(1);

    rerender({ playing: true, index: 1, count: 3, dwellMs: 2000, onAdvance, onFinish });
    act(() => { vi.advanceTimersByTime(1500); });
    expect(onAdvance).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(500); });
    expect(onAdvance).toHaveBeenCalledTimes(2);
  });

  it('stops when paused and finishes on the last scene', () => {
    const { rerender, onAdvance, onFinish } = setup({ playing: false });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onAdvance).not.toHaveBeenCalled();

    rerender({ playing: true, index: 2, count: 3, dwellMs: 1000, onAdvance, onFinish });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onAdvance).not.toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending advance when playback pauses mid-dwell', () => {
    const { rerender, onAdvance, onFinish } = setup({});
    act(() => { vi.advanceTimersByTime(600); });
    rerender({ playing: false, index: 0, count: 3, dwellMs: 1000, onAdvance, onFinish });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onAdvance).not.toHaveBeenCalled();
  });
});
