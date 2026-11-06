import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { draftStorageKey, DRAFT_MESSAGES, type DraftStorage } from '@/story/draft';
import { sampleStory } from '@/story/sampleStory';

import { AUTOSAVE_DELAY_MS, useStoryDraft } from './use-story-draft';

function memoryStorage(initial: Record<string, string> = {}): DraftStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

const key = draftStorageKey(sampleStory);

describe('useStoryDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('edits text, autosaves, and exports the change as a prompt', () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useStoryDraft(sampleStory, storage));
    expect(result.current.saveState.status).toBe('saved');
    expect(result.current.changes.status).toBe('unchanged');

    act(() => result.current.setChapterText('origins', 'title', 'High and slow'));
    expect(result.current.saveState.status).toBe('saving');
    expect(result.current.story.chapters[1].title).toBe('High and slow');
    expect(storage.data.has(key)).toBe(false);

    act(() => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS); });
    expect(result.current.saveState.status).toBe('saved');
    expect(JSON.parse(storage.data.get(key)!).draft.chapters.origins.title).toBe('High and slow');

    act(() => result.current.setMetricLabel('origins', 'highest-farm', 'Peak farm'));
    act(() => result.current.setStoryText('subtitle', 'A new subtitle'));
    const { changes } = result.current;
    expect(changes.status).toBe('ready');
    if (changes.status !== 'ready') return;
    expect(changes.count).toBe(3);
    expect(changes.prompt).toContain('"replacement": "Peak farm"');
  });

  it('captures a chapter camera as an override and restores on reset', () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useStoryDraft(sampleStory, storage));
    act(() => result.current.setChapterCamera('export', { center: [10.123456789, 50.987654321], zoom: 4.5678, bearing: 12.345, pitch: 30 }));
    expect(result.current.cameraOverrides.has('export')).toBe(true);
    expect(result.current.story.chapters[2].camera).toEqual({ center: [10.12346, 50.98765], zoom: 4.57, bearing: 12.35, pitch: 30 });
    act(() => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS); });
    expect(storage.data.has(key)).toBe(true);

    act(() => result.current.reset());
    expect(storage.data.has(key)).toBe(false);
    expect(result.current.cameraOverrides.size).toBe(0);
    expect(result.current.changes.status).toBe('unchanged');
    expect(result.current.story.chapters[2].camera).toEqual(sampleStory.chapters[2].camera);
  });

  it('reloads saved edits', () => {
    const storage = memoryStorage();
    const first = renderHook(() => useStoryDraft(sampleStory, storage));
    act(() => first.result.current.setStoryText('title', 'Bean to cup'));
    act(() => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS); });
    first.unmount();

    const second = renderHook(() => useStoryDraft(sampleStory, storage));
    expect(second.result.current.story.title).toBe('Bean to cup');
  });

  it('never overwrites an unreadable draft until the user resets', () => {
    const storage = memoryStorage({ [key]: '{not json' });
    const { result } = renderHook(() => useStoryDraft(sampleStory, storage));
    expect(result.current.saveState).toEqual({ status: 'error', message: DRAFT_MESSAGES.invalid });

    act(() => result.current.setChapterText('origins', 'body', 'Edited'));
    act(() => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS); });
    expect(storage.data.get(key)).toBe('{not json');
    expect(result.current.saveState.status).toBe('error');

    act(() => result.current.reset());
    expect(result.current.saveState.status).toBe('saved');
    act(() => result.current.setChapterText('origins', 'body', 'Edited again'));
    act(() => { vi.advanceTimersByTime(AUTOSAVE_DELAY_MS); });
    expect(JSON.parse(storage.data.get(key)!).draft.chapters.origins.body).toBe('Edited again');
  });

  it('keeps editing in memory when storage is unavailable', () => {
    const { result } = renderHook(() => useStoryDraft(sampleStory, null));
    expect(result.current.saveState).toEqual({ status: 'error', message: DRAFT_MESSAGES.unavailable });
    act(() => result.current.setChapterText('origins', 'title', 'Still editable'));
    expect(result.current.story.chapters[1].title).toBe('Still editable');
    expect(result.current.saveState.status).toBe('error');
  });
});
