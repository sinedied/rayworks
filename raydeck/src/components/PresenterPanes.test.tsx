// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clampSplit, splitBounds } from '@/presentation/layout';

import { PresenterPanes } from './PresenterPanes';

let root: Root;
let container: HTMLDivElement;
let width: number;
let resize: () => void;
let commit: ReturnType<typeof vi.fn<(ratio: number) => void>>;
const separator = () => container.querySelector<HTMLElement>('[role="separator"]')!;
const ratio = () => Number(separator().getAttribute('aria-valuenow')) / 100;

function Harness() {
  const [preferred, setPreferred] = useState(1 / 3);
  return <PresenterPanes ratio={preferred} currentId="current" sidebarId="sidebar"
    current={<div id="current" />} sidebar={<div id="sidebar" />}
    onRatioChange={(value) => { commit(value); setPreferred(value); }} />;
}
async function pointer(type: string, x: number, pointerId = 1) {
  await act(async () => separator().dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, pointerId, button: 0 })));
}
async function key(key: string) {
  await act(async () => separator().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key })));
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  width = 1224;
  resize = () => {};
  commit = vi.fn<(ratio: number) => void>();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
    return this.classList.contains('presenter-grid') ? width : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function () {
    return this.classList.contains('presenter-divider') ? 24 : 0;
  });
  Object.defineProperties(HTMLElement.prototype, {
    setPointerCapture: { configurable: true, value: vi.fn() },
    hasPointerCapture: { configurable: true, value: () => true },
    releasePointerCapture: { configurable: true, value: vi.fn() },
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('presenter pane sizing', () => {
  it('starts at exactly one third and exposes keyboard sizing bounds', async () => {
    await act(async () => root.render(<Harness />));
    expect(ratio()).toBeCloseTo(1 / 3, 12);
    expect(separator().getAttribute('aria-controls')).toBe('current sidebar');
    await key('ArrowRight');
    expect(ratio()).toBeCloseTo(1 / 3 + 0.02, 12);
    await key('ArrowLeft');
    expect(ratio()).toBeCloseTo(1 / 3, 12);
    await key('Home');
    expect(ratio()).toBe(0.15);
    await key('End');
    expect(ratio()).toBe(0.85);
  });

  it('resizes during a drag but commits only on release', async () => {
    await act(async () => root.render(<Harness />));
    await pointer('pointerdown', 400);
    await pointer('pointermove', 600);
    expect(ratio()).toBeCloseTo(0.5);
    expect(commit).not.toHaveBeenCalled();
    await pointer('pointerup', 600);
    expect(commit).toHaveBeenCalledExactlyOnceWith(0.5);
    expect(container.querySelector('.is-resizing')).toBeNull();
  });

  it.each(['pointercancel', 'lostpointercapture', 'Escape'])('cancels %s without saving the unfinished drag', async (reason) => {
    await act(async () => root.render(<Harness />));
    await pointer('pointerdown', 400);
    await pointer('pointermove', 600);
    if (reason === 'Escape') await key(reason);
    else await pointer(reason, 600);
    expect(ratio()).toBeCloseTo(1 / 3);
    expect(commit).not.toHaveBeenCalled();
    expect(container.querySelector('.is-resizing')).toBeNull();
  });

  it('clamps responsive dimensions without replacing the saved preference', async () => {
    await act(async () => root.render(<Harness />));
    await key('End');
    expect(ratio()).toBe(0.85);
    commit.mockClear();
    width = 374;
    await act(async () => resize());
    expect(ratio()).toBeCloseTo(1 - 180 / 350);
    expect(commit).not.toHaveBeenCalled();
    await pointer('pointerdown', 150);
    await pointer('pointerup', 150);
    expect(commit).not.toHaveBeenCalled();
    width = 1224;
    await act(async () => resize());
    expect(ratio()).toBe(0.85);
    expect(commit).not.toHaveBeenCalled();
  });

  it('keeps minimums coherent even below the combined compact pane widths', () => {
    for (const available of [260, 330, 700, 1200, 1400]) {
      const bounds = splitBounds(available);
      expect(bounds.min).toBeLessThanOrEqual(bounds.max + Number.EPSILON);
      expect(clampSplit(0, available)).toBeCloseTo(bounds.min);
      expect(clampSplit(1, available)).toBeCloseTo(bounds.max);
    }
  });
});
