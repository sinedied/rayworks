// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { SAMPLE_DECK } from '@/deck/sampleDeck';

vi.mock('@/components/Chart', () => ({
  Chart: () => <div data-testid="chart" />,
}));

const STORAGE_KEY = 'raydeck.sample-deck.v1';
let container: HTMLDivElement;
let root: Root;
let fullscreen: Element | null;
let copyText: ReturnType<typeof vi.fn>;
let enterFullscreen: ReturnType<typeof vi.fn>;
let exitFullscreen: ReturnType<typeof vi.fn>;

function getButton(label: string) {
  const button = [...container.querySelectorAll('button')].find((element) => (
    element.getAttribute('aria-label') === label || element.textContent?.trim() === label
  ));
  if (!button) throw new Error(`Missing button: ${label}`);
  return button;
}

async function click(button: HTMLButtonElement) {
  await act(async () => button.click());
}

async function mount() {
  await act(async () => root.render(<App />));
}

async function startPresentation() {
  await click(getButton('Present'));
  await click(getButton('Start presentation'));
}

async function edit(field: string, value: string) {
  const input = container.querySelector<HTMLTextAreaElement>(`textarea[aria-label="Edit slide ${field}"]`);
  if (!input) throw new Error(`Missing input: ${field}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  document.documentElement.className = '';
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  });
  copyText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copyText } });
  fullscreen = null;
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen });
  enterFullscreen = vi.fn(() => {
    fullscreen = container.querySelector('.deck-app');
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });
  exitFullscreen = vi.fn(() => {
    fullscreen = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: enterFullscreen });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen });
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

describe('local save and prompt menu', () => {
  it('saves edits, shows the success state, and disables export for unchanged text', async () => {
    await mount();
    const trigger = getButton('Saved locally. Open save menu');
    expect(trigger.querySelector('svg path')?.getAttribute('d')).toBe('m5 12 4 4L19 6');
    await click(trigger);
    expect(getButton('Copy changes as prompt').getAttribute('aria-disabled')).toBe('true');
    await click(getButton('Copy changes as prompt'));
    expect(copyText).not.toHaveBeenCalled();
    await click(trigger);
    await edit('title', 'Updated title\non two lines');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].title).toBe('Updated title\non two lines');
    await click(trigger);
    await click(getButton('Copy changes as prompt'));
    expect(copyText).toHaveBeenCalledTimes(1);
    expect(copyText.mock.calls[0][0]).toContain('Updated title\\non two lines');
    expect(getButton('Prompt copied')).toBeTruthy();
    await click(trigger);
    await edit('title', SAMPLE_DECK[0].title);
    await click(trigger);
    expect(getButton('Copy changes as prompt').getAttribute('aria-disabled')).toBe('true');
  });

  it('opens by keyboard, returns focus on Escape, and dismisses outside clicks', async () => {
    await mount();
    const trigger = getButton('Saved locally. Open save menu');
    trigger.focus();
    await act(async () => trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(document.activeElement).toBe(getButton('Copy changes as prompt'));
    await act(async () => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    await click(trigger);
    await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('restores compatible drafts and resets them', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_DECK.map((slide, index) => (
      index ? slide : { ...slide, title: 'Saved earlier' }
    ))));
    await mount();
    expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Edit slide title"]')?.value).toBe('Saved earlier');
    await click(getButton('Reset sample deck'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].title).toBe(SAMPLE_DECK[0].title);
  });

  it.each(['{broken', '', 'null', '[]'])('preserves unreadable draft %j until explicit reset', async (stored) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEY, stored);
    await mount();
    expect(getButton('Not saved locally. Open save menu')).toBeTruthy();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('not been overwritten');
    await edit('title', 'Still editable');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(stored);
    await click(getButton('Not saved locally. Open save menu'));
    await click(getButton('Copy changes as prompt'));
    expect(copyText.mock.calls[0][0]).toContain('Still editable');
    await click(getButton('Reset sample deck'));
    expect(getButton('Saved locally. Open save menu')).toBeTruthy();
  });

  it('reports denied storage reads without attempting to overwrite the draft', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await mount();
    expect(getButton('Not saved locally. Open save menu')).toBeTruthy();
    expect(write).not.toHaveBeenCalled();
  });

  it('reports failed writes and reset, retaining edits for export', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
    await mount();
    await edit('body', 'Unsaved but exportable');
    expect(getButton('Not saved locally. Open save menu')).toBeTruthy();
    await click(getButton('Not saved locally. Open save menu'));
    await click(getButton('Copy changes as prompt'));
    expect(copyText.mock.calls[0][0]).toContain('Unsaved but exportable');
    await click(getButton('Reset sample deck'));
    expect(getButton('Not saved locally. Open save menu')).toBeTruthy();
  });

  it.each(['denied', 'unavailable'])('provides a selectable prompt when clipboard is %s', async (failure) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    if (failure === 'denied') copyText.mockRejectedValue(new Error('Denied'));
    else Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    await mount();
    await edit('title', 'Copy this manually');
    await click(getButton('Saved locally. Open save menu'));
    await click(getButton('Copy changes as prompt'));
    const manual = container.querySelector<HTMLTextAreaElement>('[aria-label="Changes prompt for manual copying"]')!;
    expect(manual.value).toContain('Copy this manually');
    expect(manual.selectionEnd).toBe(manual.value.length);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Clipboard access failed');
  });
});

describe('presentation', () => {
  it('requests native fullscreen, retains text/slide, and exits back to the trigger', async () => {
    await mount();
    await click(getButton('Slide 02: Growth is accelerating without sacrificing efficiency.'));
    await edit('title', 'Updated second slide');
    await startPresentation();
    expect(enterFullscreen).toHaveBeenCalledTimes(1);
    expect(document.fullscreenElement).toBe(container.querySelector('.deck-app'));
    expect(container.querySelector('.stage-shell [data-field="title"]')?.textContent).toBe('Updated second slide');
    expect(container.querySelector('.stage-shell textarea')).toBeNull();
    await click(getButton('Exit'));
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.is-presenting')).toBeNull();
    expect(document.activeElement).toBe(getButton('Present'));
    expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Edit slide title"]')?.value).toBe('Updated second slide');
  });

  it('restores the editor when the browser leaves fullscreen', async () => {
    await mount();
    await startPresentation();
    await act(async () => {
      fullscreen = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(container.querySelector('.is-presenting')).toBeNull();
    await startPresentation();
    expect(enterFullscreen).toHaveBeenCalledTimes(2);
  });

  it.each(['blocked', 'unavailable'])('shows an explicit fallback when fullscreen is %s', async (failure) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    if (failure === 'blocked') enterFullscreen.mockRejectedValue(new Error('Denied'));
    else Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: undefined });
    await mount();
    await startPresentation();
    expect(container.querySelector('.is-presenting')).not.toBeNull();
    expect(container.querySelector('.presentation-notice')?.textContent).toContain('Presenting in this window instead');
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(container.querySelector('.is-presenting')).toBeNull();
  });

  it('reports fullscreen exit errors without claiming to leave fullscreen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    exitFullscreen.mockRejectedValue(new Error('Denied'));
    await mount();
    await startPresentation();
    await click(getButton('Exit'));
    expect(container.querySelector('.is-presenting')).not.toBeNull();
    expect(container.querySelector('.presentation-notice')?.textContent).toContain('Could not leave fullscreen');
  });

  it('cancels a pending entry when Exit is clicked before fullscreen resolves', async () => {
    let finishEntry: (() => void) | undefined;
    enterFullscreen.mockImplementation(() => new Promise<void>((resolve) => {
      finishEntry = () => {
        fullscreen = container.querySelector('.deck-app');
        document.dispatchEvent(new Event('fullscreenchange'));
        resolve();
      };
    }));
    await mount();
    await startPresentation();
    await click(getButton('Exit'));
    await act(async () => finishEntry?.());
    expect(container.querySelector('.is-presenting')).toBeNull();
    expect(document.fullscreenElement).toBeNull();
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it('does not navigate slides while editing or activating menu items', async () => {
    await mount();
    const textarea = container.querySelector('textarea')!;
    await act(async () => textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(container.querySelector('.stage-shell article')?.getAttribute('data-slide-id')).toBe('opening');
    await click(getButton('Saved locally. Open save menu'));
    await act(async () => getButton('Copy changes as prompt').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    expect(container.querySelector('.stage-shell article')?.getAttribute('data-slide-id')).toBe('opening');
  });
});
