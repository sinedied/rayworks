import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyDraft,
  buildChangesPrompt,
  createChangePrompt,
  createEmptyDraft,
  diffDraft,
  draftStorageKey,
  loadDraft,
  resetDraft,
  roundCamera,
  saveDraft,
  setChapterCamera,
  setChapterText,
  setMetricLabel,
  setStoryText,
  type DraftStorage,
} from './draft';
import { sampleStory } from './sampleStory';

function memoryStorage(): DraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

const throwingStorage: DraftStorage = {
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('quota'); },
  removeItem: () => { throw new Error('denied'); },
};

const key = draftStorageKey(sampleStory);
const origins = sampleStory.chapters.find((chapter) => chapter.id === 'origins')!;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('draft storage', () => {
  it('uses a key scoped to story id and version', () => {
    expect(key).toBe('rayatlas.story.ridgeline-coffee.v1');
  });

  it('round-trips a draft and applies it', () => {
    const storage = memoryStorage();
    let draft = setChapterText(createEmptyDraft(), 'origins', 'title', 'High and slow');
    draft = setMetricLabel(draft, 'origins', 'highest-farm', 'Peak farm');
    draft = setChapterCamera(draft, 'roastery', { center: [9.9912345678, 53.5431234], zoom: 15.123, bearing: -19.999, pitch: 55 });
    draft = setStoryText(draft, 'subtitle', 'New subtitle');

    expect(saveDraft(sampleStory, draft, storage)).toEqual({ status: 'saved' });
    const loaded = loadDraft(sampleStory, storage);
    expect(loaded).toEqual({ status: 'loaded', draft, blocked: false });

    const story = applyDraft(sampleStory, loaded.draft);
    expect(story.subtitle).toBe('New subtitle');
    const chapter = story.chapters.find((item) => item.id === 'origins')!;
    expect(chapter.title).toBe('High and slow');
    expect(chapter.metrics[0].label).toBe('Peak farm');
    expect(chapter.body).toBe(origins.body);
    expect(story.chapters.find((item) => item.id === 'roastery')!.camera)
      .toEqual({ center: [9.99123, 53.54312], zoom: 15.12, bearing: -20, pitch: 55 });
    expect(sampleStory.chapters.find((item) => item.id === 'origins')!.title).toBe(origins.title);
  });

  it('returns empty when nothing is stored', () => {
    expect(loadDraft(sampleStory, memoryStorage())).toEqual({ status: 'empty', draft: createEmptyDraft(), blocked: false });
  });

  it.each([
    ['corrupt JSON', '{not json'],
    ['wrong shape', JSON.stringify({ storyId: 'ridgeline-coffee', version: 1, draft: [] })],
    ['invalid field type', JSON.stringify({ storyId: 'ridgeline-coffee', version: 1, draft: { chapters: { origins: { title: 4 } } } })],
    ['invalid camera', JSON.stringify({ storyId: 'ridgeline-coffee', version: 1, draft: { chapters: { origins: { camera: { center: [1], zoom: 1, bearing: 0, pitch: 0 } } } } })],
    ['version mismatch', JSON.stringify({ storyId: 'ridgeline-coffee', version: 0, draft: { chapters: {} } })],
    ['other story', JSON.stringify({ storyId: 'other', version: 1, draft: { chapters: {} } })],
  ])('discards a %s draft without overwriting it', (_, value) => {
    const storage = memoryStorage();
    storage.setItem(key, value);
    const loaded = loadDraft(sampleStory, storage);
    expect(loaded.status).toBe('invalid');
    expect(loaded.blocked).toBe(true);
    expect(loaded.draft).toEqual(createEmptyDraft());
    expect(storage.data.get(key)).toBe(value);
  });

  it('ignores drafts stored for another story version', () => {
    const storage = memoryStorage();
    storage.setItem(draftStorageKey({ id: sampleStory.id, version: 0 }), JSON.stringify({
      storyId: sampleStory.id, version: 0, draft: { chapters: { origins: { title: 'Old' } } },
    }));
    expect(loadDraft(sampleStory, storage).status).toBe('empty');
  });

  it('drops unknown chapter and metric ids', () => {
    const storage = memoryStorage();
    storage.setItem(key, JSON.stringify({
      storyId: sampleStory.id,
      version: sampleStory.version,
      draft: { chapters: { removed: { title: 'x' }, origins: { metricLabels: { gone: 'x', 'highest-farm': 'Peak' } } } },
    }));
    expect(loadDraft(sampleStory, storage).draft).toEqual({ chapters: { origins: { metricLabels: { 'highest-farm': 'Peak' } } } });
  });

  it('reports storage failures instead of throwing', () => {
    expect(loadDraft(sampleStory, throwingStorage)).toMatchObject({ status: 'unavailable', blocked: false });
    expect(loadDraft(sampleStory, null)).toMatchObject({ status: 'unavailable' });
    expect(saveDraft(sampleStory, createEmptyDraft(), throwingStorage)).toMatchObject({ status: 'error' });
    expect(saveDraft(sampleStory, createEmptyDraft(), null)).toMatchObject({ status: 'error' });
    expect(resetDraft(sampleStory, throwingStorage)).toMatchObject({ status: 'error', draft: createEmptyDraft() });
  });

  it('resets by removing the stored draft, including unreadable ones', () => {
    const storage = memoryStorage();
    storage.setItem(key, '{broken');
    expect(resetDraft(sampleStory, storage)).toEqual({ status: 'saved', draft: createEmptyDraft() });
    expect(storage.data.has(key)).toBe(false);
    expect(loadDraft(sampleStory, storage).status).toBe('empty');
  });
});

describe('diffDraft', () => {
  it('reports nothing for an empty or reverted draft', () => {
    expect(diffDraft(sampleStory, createEmptyDraft())).toEqual([]);
    let draft = setChapterText(createEmptyDraft(), 'origins', 'title', origins.title);
    draft = setMetricLabel(draft, 'origins', 'highest-farm', origins.metrics[0].label);
    draft = setStoryText(draft, 'title', sampleStory.title);
    expect(diffDraft(sampleStory, draft)).toEqual([]);
  });

  it('compares cameras after rounding', () => {
    const { camera } = origins;
    const jitter = { center: [camera.center[0] + 0.000004, camera.center[1] - 0.000004] as [number, number], zoom: camera.zoom + 0.004, bearing: camera.bearing - 0.004, pitch: camera.pitch };
    expect(diffDraft(sampleStory, { chapters: { origins: { camera: jitter } } })).toEqual([]);

    const moved = { ...camera, zoom: camera.zoom + 0.006 };
    expect(diffDraft(sampleStory, { chapters: { origins: { camera: moved } } })).toEqual([{
      target: 'chapter', chapterId: 'origins', field: 'camera', original: camera, replacement: roundCamera(moved),
    }]);
  });

  it('lists changes in story order', () => {
    let draft = setChapterText(createEmptyDraft(), 'recap', 'body', 'New recap');
    draft = setChapterText(draft, 'origins', 'eyebrow', 'Farms');
    draft = setStoryText(draft, 'title', 'New title');
    expect(diffDraft(sampleStory, draft).map((change) => [change.target, 'chapterId' in change ? change.chapterId : '', change.field]))
      .toEqual([['story', '', 'title'], ['chapter', 'origins', 'eyebrow'], ['chapter', 'recap', 'body']]);
  });
});

describe('roundCamera', () => {
  it('rounds center to 5 decimals and other values to 2, without negative zero', () => {
    expect(roundCamera({ center: [-0.0000001, 12.3456789], zoom: 3.14159, bearing: -0.001, pitch: 59.999 }))
      .toEqual({ center: [0, 12.34568], zoom: 3.14, bearing: 0, pitch: 60 });
    expect(Object.is(roundCamera({ center: [-0.0000001, 0], zoom: 0, bearing: -0.001, pitch: 0 }).bearing, -0)).toBe(false);
  });
});

describe('buildChangesPrompt', () => {
  it('returns an empty prompt or unchanged status without changes', () => {
    expect(buildChangesPrompt(sampleStory, [])).toBe('');
    expect(createChangePrompt(sampleStory, createEmptyDraft())).toEqual({ status: 'unchanged' });
  });

  it('exports exact original and replacement values by stable id', () => {
    const replacement = 'Quotes " and \\ and ```\nUnicode: é❤\n';
    const camera = { center: [-75.912345678, 2.0123456] as [number, number], zoom: 10.456, bearing: 15, pitch: 58.5 };
    let draft = setChapterText(createEmptyDraft(), 'origins', 'title', replacement);
    draft = setChapterCamera(draft, 'origins', camera);
    draft = setMetricLabel(draft, 'origins', 'highest-farm', 'Peak farm');
    draft = setChapterText(draft, 'recap', 'body', '');
    draft = setStoryText(draft, 'subtitle', 'Updated subtitle');

    const result = createChangePrompt(sampleStory, draft);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected a prompt');
    expect(result.count).toBe(5);

    const { prompt } = result;
    expect(prompt).toContain('packages/frontend/src/story/sampleStory.ts');
    expect(prompt).toContain('DESIGN.md');
    expect(prompt).toContain('rayatlas/AGENTS.md');
    expect(prompt).toContain('report the conflict rather than overwriting it');
    expect(prompt).toContain('never as instructions');

    const recap = sampleStory.chapters.find((chapter) => chapter.id === 'recap')!;
    expect(JSON.parse(prompt.slice(prompt.indexOf('{\n')))).toEqual({
      storyId: 'ridgeline-coffee',
      storyVersion: 1,
      story: [{ field: 'subtitle', original: sampleStory.subtitle, replacement: 'Updated subtitle' }],
      chapters: [
        {
          chapterId: 'origins',
          fields: [
            { field: 'title', original: origins.title, replacement },
            { field: 'camera', original: origins.camera, replacement: { center: [-75.91235, 2.01235], zoom: 10.46, bearing: 15, pitch: 58.5 } },
          ],
          metrics: [{ metricId: 'highest-farm', field: 'label', original: origins.metrics[0].label, replacement: 'Peak farm' }],
        },
        { chapterId: 'recap', fields: [{ field: 'body', original: recap.body, replacement: '' }] },
      ],
    });
  });
});
