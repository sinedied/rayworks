// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useViewPreferences, VIEW_PREFERENCES_KEY } from './useViewPreferences';

let root: Root;
let container: HTMLDivElement;

function Harness() {
  const view = useViewPreferences();
  return <><output>{JSON.stringify(view.preferences)}</output><p>{view.notice}</p>
    <button onClick={() => view.setSplitRatio(0.6)}>Resize</button>
    <button onClick={() => view.setNotesFontSize(32)}>Zoom</button></>;
}
const value = () => JSON.parse(container.querySelector('output')!.textContent!);
async function mount() { await act(async () => root.render(<Harness />)); }
async function click(index: number) { await act(async () => container.querySelectorAll('button')[index].click()); }

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('browser view preferences', () => {
  it('uses exact defaults without writing on mount and persists only separate viewing settings', async () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await mount();
    expect(value()).toEqual({ splitRatio: 1 / 3, notesFontSize: 16 });
    expect(write).not.toHaveBeenCalled();
    await click(0);
    await click(1);
    expect(JSON.parse(localStorage.getItem(VIEW_PREFERENCES_KEY)!)).toEqual({ version: 1, splitRatio: 0.6, notesFontSize: 32 });
    expect(localStorage.getItem('raydeck.sample-deck.v1')).toBeNull();
    await act(async () => root.render(null));
    await mount();
    expect(value()).toEqual({ splitRatio: 0.6, notesFontSize: 32 });
  });

  it.each([
    '{bad', 'null', '[]', '{"version":2,"splitRatio":0.5,"notesFontSize":16}',
    '{"version":1,"splitRatio":1e400,"notesFontSize":16}',
    '{"version":1,"splitRatio":0.9,"notesFontSize":16}',
    '{"version":1,"splitRatio":0.1,"notesFontSize":16}',
    '{"version":1,"splitRatio":0.5,"notesFontSize":15}',
    '{"version":1,"splitRatio":0.5,"notesFontSize":50}',
    '{"version":1,"splitRatio":0.5,"notesFontSize":12}',
    '{"version":1,"splitRatio":0.5,"notesFontSize":"16"}',
  ])('reports and preserves invalid storage: %s', async (stored) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(VIEW_PREFERENCES_KEY, stored);
    await mount();
    expect(value()).toEqual({ splitRatio: 1 / 3, notesFontSize: 16 });
    expect(container.querySelector('p')?.textContent).toContain('Could not read view preferences');
    expect(localStorage.getItem(VIEW_PREFERENCES_KEY)).toBe(stored);
    await click(1);
    expect(JSON.parse(localStorage.getItem(VIEW_PREFERENCES_KEY)!)).toEqual({ version: 1, splitRatio: 1 / 3, notesFontSize: 32 });
    expect(container.querySelector('p')?.textContent).toBe('');
  });

  it('reports denied reads and does not write defaults', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await mount();
    expect(container.querySelector('p')?.textContent).toContain('Could not read view preferences');
    expect(write).not.toHaveBeenCalled();
  });

  it('keeps preferences usable in memory when writes fail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    await mount();
    await click(0);
    await click(1);
    expect(value()).toEqual({ splitRatio: 0.6, notesFontSize: 32 });
    expect(container.querySelector('p')?.textContent).toContain('could not be remembered');
  });
});
