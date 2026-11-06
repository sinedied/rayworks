import { describe, expect, it } from 'vitest';

import { buildScenes, readingMinutes, sceneCameraKey } from './scenes';
import { sampleStory } from './sampleStory';
import { splitMetric, splitTitle } from './text';

describe('buildScenes', () => {
  const scenes = buildScenes(sampleStory);

  it('wraps chapters with a title card and an end card', () => {
    expect(scenes).toHaveLength(sampleStory.chapters.length + 2);
    expect(scenes[0]).toMatchObject({ key: 'intro', kind: 'intro', chapterIndex: null, spin: true });
    expect(scenes.at(-1)).toMatchObject({ key: 'outro', kind: 'outro', chapterIndex: null });
    expect(scenes.slice(1, -1).map((scene) => scene.key)).toEqual(sampleStory.chapters.map((chapter) => chapter.id));
  });

  it('carries chapter flags', () => {
    const origins = scenes.find((scene) => scene.key === 'origins')!;
    expect(origins).toMatchObject({ terrain: true, fit: false, duration: 6000 });
    expect(scenes.find((scene) => scene.key === 'export')).toMatchObject({ fit: true, animateRoutes: true });
  });

  it('keys camera moves by view, not by text', () => {
    const edited = buildScenes({ ...sampleStory, chapters: sampleStory.chapters.map((chapter) => ({ ...chapter, title: 'Changed' })) });
    expect(edited.map(sceneCameraKey)).toEqual(scenes.map(sceneCameraKey));
  });

  it('estimates reading time', () => {
    expect(readingMinutes(sampleStory)).toBeGreaterThanOrEqual(1);
  });
});

describe('text helpers', () => {
  it('splits story titles and metrics', () => {
    expect(splitTitle('Ridgeline Coffee: From ridge to cup')).toEqual({ lead: 'Ridgeline Coffee', main: 'From ridge to cup' });
    expect(splitTitle('Plain title')).toEqual({ lead: '', main: 'Plain title' });
    expect(splitMetric('18.4k t')).toEqual({ figure: '18.4k', unit: 't' });
    expect(splitMetric('23')).toEqual({ figure: '23', unit: '' });
  });
});
