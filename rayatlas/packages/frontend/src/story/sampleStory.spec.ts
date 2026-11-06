import { describe, expect, it } from 'vitest';

import { sampleNetwork } from '@/data/sample-network';

import { evaluateMetric, selectRoutes, selectSites } from './metrics';
import { sampleStory } from './sampleStory';
import type { StoryFocus } from './types';

function focuses(): Array<[string, StoryFocus]> {
  return sampleStory.chapters.flatMap((chapter) => [
    [`${chapter.id} focus`, chapter.focus] as [string, StoryFocus],
    ...chapter.metrics.map((metric) => [`${chapter.id}/${metric.id}`, metric.source.filter] as [string, StoryFocus]),
  ]);
}

describe('sampleStory', () => {
  it('has the expected chapters with unique ids', () => {
    expect(sampleStory.chapters.map((chapter) => chapter.id)).toEqual([
      'overview', 'origins', 'export', 'crossing', 'roastery', 'distribution', 'customers', 'recap',
    ]);
    for (const chapter of sampleStory.chapters) {
      const ids = chapter.metrics.map((metric) => metric.id);
      expect(new Set(ids).size, chapter.id).toBe(ids.length);
      expect(chapter.metrics.length, chapter.id).toBeGreaterThan(0);
    }
  });

  describe('against the bundled sample network', () => {
    const network = sampleNetwork;

    it.each(focuses())('%s resolves every referenced code', (_, focus) => {
      const siteCodes = new Set(network.sites.map((site) => site.code));
      const routeCodes = new Set(network.routes.map((route) => route.code));
      for (const code of focus.siteCodes ?? []) expect(siteCodes, code).toContain(code);
      for (const code of focus.routeCodes ?? []) expect(routeCodes, code).toContain(code);
      for (const prefix of focus.routeCodePrefixes ?? []) {
        expect(network.routes.some((route) => route.code.startsWith(prefix)), prefix).toBe(true);
      }
    });

    it.each(sampleStory.chapters.map((chapter) => [chapter.id, chapter] as const))('%s focus selects data and metrics evaluate', (_, chapter) => {
      expect(selectSites(network, chapter.focus).length + selectRoutes(network, chapter.focus).length).toBeGreaterThan(0);
      for (const metric of chapter.metrics) {
        expect(evaluateMetric(metric, network), `${chapter.id}/${metric.id}`).not.toBeNull();
      }
    });
  });

  it('uses valid cameras', () => {
    for (const { id, camera } of sampleStory.chapters) {
      expect(camera.center[0], id).toBeGreaterThanOrEqual(-180);
      expect(camera.center[0], id).toBeLessThanOrEqual(180);
      expect(Math.abs(camera.center[1]), id).toBeLessThanOrEqual(85);
      expect(camera.pitch, id).toBeGreaterThanOrEqual(0);
      expect(camera.pitch, id).toBeLessThanOrEqual(85);
      expect(camera.zoom, id).toBeGreaterThan(0);
    }
  });
});
