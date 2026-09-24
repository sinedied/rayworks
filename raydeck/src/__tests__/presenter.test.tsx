// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { AudienceView } from '@/components/AudienceView';
import { PresentationControls } from '@/components/PresentationControls';
import { bindChartScale } from '@/components/chartPointer';
import { SAMPLE_DECK } from '@/deck/sampleDeck';
import { usePresenterTimer } from '@/hooks/usePresenterTimer';
import { audienceSlides, message, type SessionBody } from '@/presentation/session';

vi.mock('@/components/Chart', () => ({ Chart: () => <div data-chart /> }));

let container: HTMLDivElement;
let root: Root;
let iframe: HTMLIFrameElement;
let peer: Window;
let post: ReturnType<typeof vi.fn>;
let closed: boolean;
let sessionId: string;

async function render(node: ReactNode = <App />) {
  await act(async () => root.render(node));
}
function button(name: string) {
  const found = [...container.querySelectorAll('button')].find((item) =>
    item.textContent?.trim() === name || item.getAttribute('aria-label') === name);
  if (!found) throw new Error(`Missing button ${name}`);
  return found;
}
async function click(name: string) { await act(async () => button(name).click()); }
async function receive(body: SessionBody, id = sessionId, source: Window = peer, origin = location.origin) {
  await act(async () => window.dispatchEvent(new MessageEvent('message', { data: message(id, body), source, origin })));
}
async function start() {
  await render();
  await click('Present');
  await click('Enter presenter mode');
  await receive({ type: 'ready', clientId: 'client' });
  const snapshot = post.mock.calls.map(([value]) => value).reverse().find((value) => value.type === 'state');
  await receive({ type: 'ack', revision: snapshot.revision });
}
async function editNotes(value: string) {
  const notes = container.querySelector<HTMLTextAreaElement>('.speaker-notes textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(notes, value);
    notes.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  peer = iframe.contentWindow!;
  closed = false;
  Object.defineProperty(peer, 'closed', { configurable: true, get: () => closed });
  Object.defineProperty(peer, 'close', { configurable: true, value: vi.fn(() => { closed = true; }) });
  Object.defineProperty(peer, 'focus', { configurable: true, value: vi.fn() });
  post = vi.fn();
  Object.defineProperty(peer, 'postMessage', { configurable: true, value: post });
  Object.defineProperty(window, 'opener', { configurable: true, value: peer });
  vi.spyOn(window, 'open').mockImplementation((url) => {
    sessionId = new URL(String(url)).hash.slice('#audience='.length);
    closed = false;
    return peer;
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  iframe.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('speaker notes', () => {
  it('migrates existing drafts, edits notes, and restores/resets them without discarding slide text', async () => {
    localStorage.setItem('raydeck.sample-deck.v1', JSON.stringify(SAMPLE_DECK.map((slide) => ({ ...slide, title: `Edited ${slide.id}` }))));
    await render();
    await editNotes('Private\nnotes');
    const saved = JSON.parse(localStorage.getItem('raydeck.sample-deck.v1')!);
    expect(saved[0].notes).toBe('Private\nnotes');
    expect(saved[0].title).toBe('Edited opening');
    await render(null);
    await render();
    expect(container.querySelector<HTMLTextAreaElement>('.speaker-notes textarea')?.value).toBe('Private\nnotes');
    await click('Reset sample deck');
    expect(container.querySelector<HTMLTextAreaElement>('.speaker-notes textarea')?.value).toBe('');
  });
  it('does not overwrite malformed stored notes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const stored = JSON.stringify(SAMPLE_DECK.map((slide) => ({ ...slide, notes: 12 })));
    localStorage.setItem('raydeck.sample-deck.v1', stored);
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('not been overwritten');
    expect(localStorage.getItem('raydeck.sample-deck.v1')).toBe(stored);
  });
});

describe('presenter window lifecycle', () => {
  it('opens from the menu, sends only audience data, navigates both ways, and ends on the selected slide', async () => {
    await start();
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.presenter-view')).not.toBeNull();
    expect(container.querySelector('.app-header, .presenter-toolbar')).toBeNull();
    expect(container.querySelector('.presenter-sidebar .speaker-notes')).not.toBeNull();
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(container.querySelector('.audience-connection')?.textContent).toBe('Audience connected');
    const snapshots = post.mock.calls.filter(([value]) => value.type === 'state').length;
    await editNotes('Do not project this');
    expect(JSON.stringify(post.mock.calls)).not.toContain('Do not project this');
    expect(post.mock.calls.filter(([value]) => value.type === 'state')).toHaveLength(snapshots);
    await receive({ type: 'navigate', clientId: 'client', commandId: 1, command: { type: 'next' } });
    expect(container.querySelector('.presenter-current article')?.getAttribute('data-slide-id')).toBe('snapshot');
    await receive({ type: 'navigate', clientId: 'client', commandId: 1, command: { type: 'next' } });
    expect(container.querySelector('.presenter-current article')?.getAttribute('data-slide-id')).toBe('snapshot');
    await click('Next');
    expect(container.querySelector('.presenter-current article')?.getAttribute('data-slide-id')).toBe('trajectory');
    await click('End presentation');
    expect(closed).toBe(true);
    expect(container.querySelector('.stage-shell article')?.getAttribute('data-slide-id')).toBe('trajectory');
    expect(document.activeElement).toBe(button('Present'));
    expect(document.documentElement.style.overflow).not.toBe('hidden');
    expect(container.querySelector('.app-header')).not.toBeNull();
  });
  it('keeps save/theme actions and moves slide jumps to a focus-managed picker', async () => {
    await start();
    expect(container.querySelector('.presenter-controls .save-menu-above')).not.toBeNull();
    expect(button('Toggle theme')).toBeTruthy();
    expect(container.querySelector('.presenter-slide-list')).toBeNull();
    await click('Jump to slide');
    const items = [...container.querySelectorAll<HTMLButtonElement>('.presenter-slide-list button')];
    expect(document.activeElement).toBe(items[0]);
    await act(async () => items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(container.querySelector('.presenter-current article')?.getAttribute('data-slide-id')).toBe('opening');
    await act(async () => items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(document.activeElement).toBe(items.at(-1));
    await act(async () => items.at(-1)?.click());
    expect(container.querySelector('.presenter-current article')?.getAttribute('data-slide-id')).toBe('close');
    expect(container.querySelector('.presenter-slide-list')).toBeNull();
    expect(document.activeElement).toBe(button('Jump to slide'));
    await click('Jump to slide');
    await act(async () => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('.presenter-slide-list')).toBeNull();
    expect(document.activeElement).toBe(button('Jump to slide'));
  });
  it('rejects commands from another source, origin, session, or client', async () => {
    await start();
    const command = { type: 'navigate', clientId: 'client', commandId: 1, command: { type: 'next' } } as const;
    await receive(command, 'different');
    await receive(command, sessionId, window);
    await receive(command, sessionId, peer, 'https://other.example');
    await receive({ ...command, clientId: 'different' });
    expect(container.querySelector('.presenter-current article')?.getAttribute('data-slide-id')).toBe('opening');
  });
  it('answers audience heartbeats even if presenter repaint/check timers are throttled', async () => {
    await start();
    post.mockClear();
    await receive({ type: 'ping' });
    expect(post).toHaveBeenCalledWith(message(sessionId, { type: 'pong' }), location.origin);
    expect(post.mock.calls.some(([value]) => value.type === 'state')).toBe(false);
  });
  it('reports malformed paired messages and ends sessions on history restoration', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await start();
    await act(async () => window.dispatchEvent(new MessageEvent('message', {
      source: peer, origin: location.origin,
      data: { protocol: 'raydeck.presenter.v1', sessionId, type: 'navigate', command: null },
    })));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('invalid message');
    await act(async () => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    expect(container.querySelector('.presenter-view')).toBeNull();
    expect(closed).toBe(true);
  });
  it('keeps the console/timer on audience close and reopens without resetting it', async () => {
    vi.useFakeTimers();
    await start();
    await act(async () => vi.advanceTimersByTime(4000));
    closed = true;
    await act(async () => vi.advanceTimersByTime(2000));
    expect(button('Reopen audience window')).toBeTruthy();
    const timer = container.querySelector('[role="timer"]')?.textContent;
    await click('Reopen audience window');
    expect(window.open).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="timer"]')?.textContent).toBe(timer);
  });
  it('shows blocked-popup feedback and keeps the editor', async () => {
    vi.mocked(window.open).mockReturnValue(null);
    await render();
    await click('Present');
    await click('Enter presenter mode');
    expect(container.querySelector('.presenter-view')).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('blocked');
  });
  it('handles a nonresponsive audience, retry, and a refreshed client', async () => {
    vi.useFakeTimers();
    await start();
    await act(async () => vi.advanceTimersByTime(16000));
    expect(container.querySelector('.audience-connection')?.textContent).toContain('disconnected');
    await click('Reconnect audience');
    expect(window.open).toHaveBeenCalledTimes(2);
    await receive({ type: 'ready', clientId: 'reloaded' });
    await receive({ type: 'navigate', clientId: 'reloaded', commandId: 1, command: { type: 'goTo', slideId: 'close' } });
    expect(container.querySelector('.presenter-end')?.textContent).toBe('End of deck');
  });
});

describe('audience isolation and recovery', () => {
  it('keeps audience controls hidden on navigation keys and incoming slide state', async () => {
    vi.useFakeTimers();
    sessionId = 'session';
    await render(<AudienceView sessionId={sessionId} />);
    await receive({ type: 'state', slides: audienceSlides(SAMPLE_DECK), revision: 1, activeId: 'opening' });
    await act(async () => vi.advanceTimersByTime(3000));
    expect(container.querySelector('.controls-hidden')).not.toBeNull();
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })));
    expect(post.mock.calls.some(([value]) => value.type === 'navigate')).toBe(true);
    await receive({ type: 'state', slides: audienceSlides(SAMPLE_DECK), revision: 2, activeId: 'snapshot' });
    expect(container.querySelector('.controls-hidden')).not.toBeNull();
    expect(container.querySelector('article')?.getAttribute('data-slide-id')).toBe('snapshot');
  });
  it('waits without loading storage, ignores stale revisions, and never renders notes or editor', async () => {
    const storage = vi.spyOn(Storage.prototype, 'getItem');
    sessionId = 'session';
    await render(<AudienceView sessionId={sessionId} />);
    expect(storage).not.toHaveBeenCalled();
    expect(container.querySelector('article')).toBeNull();
    await receive({ type: 'state', slides: audienceSlides(SAMPLE_DECK), revision: 2, activeId: 'snapshot' });
    await receive({ type: 'state', slides: audienceSlides(SAMPLE_DECK), revision: 1, activeId: 'opening' });
    expect(container.querySelector('article')?.getAttribute('data-slide-id')).toBe('snapshot');
    expect(container.querySelector('textarea, .app-header')).toBeNull();
    expect(storage).not.toHaveBeenCalled();
    await click('Next slide');
    expect(post.mock.calls.some(([value]) => value.type === 'navigate')).toBe(true);
    await receive({ type: 'end' });
    expect(container.querySelector('article')).toBeNull();
    expect(container.textContent).toContain('Presentation ended');
  });
  it('freezes on disconnection and resumes only with an authoritative snapshot', async () => {
    vi.useFakeTimers();
    sessionId = 'session';
    await render(<AudienceView sessionId={sessionId} />);
    await receive({ type: 'state', slides: audienceSlides(SAMPLE_DECK), revision: 1, activeId: 'snapshot' });
    await act(async () => vi.advanceTimersByTime(16000));
    expect(button('Next slide').disabled).toBe(true);
    expect(container.querySelector('.presentation-notice')?.textContent).toContain('disconnected');
    await receive({ type: 'state', slides: audienceSlides(SAMPLE_DECK), revision: 2, activeId: 'channels' });
    expect(button('Next slide').disabled).toBe(false);
    expect(container.querySelector('article')?.getAttribute('data-slide-id')).toBe('channels');
  });
  it('gives explicit feedback if opener isolation severs the pairing', async () => {
    Object.defineProperty(window, 'opener', { configurable: true, value: null });
    await render(<AudienceView sessionId="session" />);
    expect(container.textContent).toContain('No presenter is paired');
    expect(container.querySelector('article, textarea, .app-header')).toBeNull();
  });
});

function TimerHarness() {
  const timer = usePresenterTimer();
  return <><output>{Math.floor(timer.elapsed)}</output>
    <button onClick={timer.toggle}>{timer.paused ? 'Resume' : 'Pause'}</button>
    <button onClick={timer.reset}>Reset</button></>;
}

describe('elapsed timer and controls', () => {
  it('does not reveal or extend the hide delay on navigation, slide props, blur, or pointer leave', async () => {
    vi.useFakeTimers();
    const controls = (index: number) => <PresentationControls index={index} total={5} onNext={() => {}} onPrevious={() => {}} />;
    await render(controls(1));
    await act(async () => vi.advanceTimersByTime(2500));
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })));
    await render(controls(2));
    await act(async () => vi.advanceTimersByTime(500));
    expect(container.querySelector('.controls-hidden')).not.toBeNull();
    for (const key of ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', ' ', 'Escape', 'Tab']) {
      await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key })));
      expect(container.querySelector('.controls-hidden')).not.toBeNull();
    }
    await act(async () => document.documentElement.dispatchEvent(new PointerEvent('pointerleave')));
    await act(async () => container.querySelector('.presentation-controls')?.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await render(controls(3));
    expect(container.querySelector('.controls-hidden')).not.toBeNull();
    await act(async () => window.dispatchEvent(new PointerEvent('pointermove', { clientY: innerHeight - 81, pointerType: 'mouse' })));
    expect(container.querySelector('.controls-hidden')).not.toBeNull();
    await act(async () => window.dispatchEvent(new PointerEvent('pointermove', { clientY: innerHeight - 80, pointerType: 'mouse' })));
    expect(container.querySelector('.controls-hidden')).toBeNull();
  });
  it('uses physical pointer coordinates rather than scaled chart events for bottom-edge reveal', async () => {
    vi.useFakeTimers();
    await render(<PresentationControls index={1} total={5} onNext={() => {}} onPrevious={() => {}} />);
    const chart = document.createElement('div');
    chart.getBoundingClientRect = () => new DOMRect(0, 100, 400, 400);
    container.append(chart);
    const unbind = bindChartScale({ root: chart, width: 800, height: 800 });
    await act(async () => vi.advanceTimersByTime(3000));
    await act(async () => chart.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, clientX: 50, clientY: 450, pointerType: 'mouse',
    })));
    expect(container.querySelector('.controls-hidden')).not.toBeNull();
    unbind();
    chart.remove();
  });
  it('computes elapsed time from timestamps, retaining reset pause state', async () => {
    vi.useFakeTimers();
    await render(<TimerHarness />);
    await act(async () => vi.advanceTimersByTime(5500));
    expect(container.querySelector('output')?.textContent).toBe('5500');
    await click('Pause');
    await act(async () => vi.advanceTimersByTime(60000));
    expect(container.querySelector('output')?.textContent).toBe('5500');
    await click('Reset');
    expect(container.querySelector('output')?.textContent).toBe('0');
    await click('Resume');
    await act(async () => vi.advanceTimersByTime(1250));
    expect(container.querySelector('output')?.textContent).toBe('1250');
  });
  it('hides at 3 seconds, reveals at the bottom, and never hides focused controls', async () => {
    vi.useFakeTimers();
    await render(<PresentationControls index={1} total={5} onNext={() => {}} onPrevious={() => {}} />);
    const hidden = () => container.querySelector('.controls-hidden') !== null;
    await act(async () => vi.advanceTimersByTime(2999));
    expect(hidden()).toBe(false);
    await act(async () => vi.advanceTimersByTime(1));
    expect(hidden()).toBe(true);
    await act(async () => window.dispatchEvent(new PointerEvent('pointermove', { clientY: innerHeight - 1, pointerType: 'mouse' })));
    expect(hidden()).toBe(false);
    await act(async () => vi.advanceTimersByTime(5000));
    expect(hidden()).toBe(false);
    await act(async () => window.dispatchEvent(new PointerEvent('pointermove', { clientY: 20, pointerType: 'mouse' })));
    await act(async () => vi.advanceTimersByTime(3000));
    expect(hidden()).toBe(true);
    await act(async () => button('Next slide').focus());
    await act(async () => vi.advanceTimersByTime(5000));
    expect(hidden()).toBe(false);
    await act(async () => button('Next slide').blur());
    await act(async () => vi.advanceTimersByTime(3000));
    expect(hidden()).toBe(true);
    await act(async () => window.dispatchEvent(new PointerEvent('pointerdown', { clientY: innerHeight - 10, pointerType: 'touch' })));
    expect(hidden()).toBe(false);
  });
});
