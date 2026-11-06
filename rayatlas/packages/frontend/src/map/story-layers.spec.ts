import { describe, expect, it } from 'vitest';

import { sampleNetwork } from '@/data/sample-network';
import { sampleStory } from '@/story/sampleStory';

import { atlasMapPalette } from './atlas-style';
import {
  baseNetworkOpacity,
  createLabelBlockLayer,
  createStoryLayers,
  easeInOutCubic,
  focusedRouteFilter,
  labelBlockFeatures,
  labelBlockImage,
  resolveFocusCodes,
  routeDrawGradient,
  STORY_LABEL_BLOCKS_SOURCE_ID,
  STORY_LAYER_IDS,
  STORY_ROUTES_SOURCE_ID,
} from './story-layers';

const chapter = (id: string) => sampleStory.chapters.find((item) => item.id === id)!;

describe('story layers', () => {
  it('builds a per-mode route filter from focused codes', () => {
    expect(focusedRouteFilter('sea', ['sea-santos-hamburg', 'sea-djibouti-hamburg'])).toEqual([
      'all',
      ['==', ['get', 'mode'], 'sea'],
      ['in', ['get', 'code'], ['literal', ['sea-santos-hamburg', 'sea-djibouti-hamburg']]],
    ]);
    expect(focusedRouteFilter('rail', [])).toEqual([
      'all',
      ['==', ['get', 'mode'], 'rail'],
      ['in', ['get', 'code'], ['literal', []]],
    ]);
  });

  it('resolves chapter focus to site and route codes', () => {
    const crossing = resolveFocusCodes(sampleNetwork, chapter('crossing').focus);
    expect(crossing.routeCodes).toEqual(['sea-cartagena-hamburg', 'sea-djibouti-hamburg', 'sea-santos-hamburg']);
    expect([...crossing.siteCodes].sort()).toEqual(['port-cartagena', 'port-djibouti', 'port-hamburg', 'port-santos']);

    const customers = resolveFocusCodes(sampleNetwork, chapter('customers').focus);
    expect(customers.routeCodes.every((code) => code.startsWith('lastmile-'))).toBe(true);
    expect(resolveFocusCodes(sampleNetwork, {})).toEqual({ siteCodes: new Set(), routeCodes: [] });
  });

  it('draws routes from origin to destination with a bright head', () => {
    expect(routeDrawGradient('#FFC629', 1)).toEqual(['interpolate', ['linear'], ['line-progress'], 0, '#FFC629', 1, '#FFC629']);
    const hidden = routeDrawGradient('#FFC629', 0);
    expect(hidden.slice(4)).toEqual(['rgba(0, 0, 0, 0)', 1, 'rgba(0, 0, 0, 0)']);

    const half = routeDrawGradient('#FFC629', 0.5) as unknown[];
    const stops = half.slice(3).filter((_, index) => index % 2 === 0) as number[];
    expect(stops).toEqual([...stops].sort((a, b) => a - b));
    expect(new Set(stops).size).toBe(stops.length);
    expect(half).toContain('#FFF6D8');
    expect(stops.at(-1)).toBe(1);

    for (const progress of [0.001, 0.02, 0.999, Number.NaN]) {
      const values = (routeDrawGradient('#FFC629', progress) as unknown[]).slice(3).filter((_, i) => i % 2 === 0) as number[];
      for (let index = 1; index < values.length; index += 1) expect(values[index]).toBeGreaterThan(values[index - 1]);
    }
  });

  it('eases drawing progress and clamps it', () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(2)).toBe(1);
  });

  it('stacks base network, per-mode glow and line, then shipments', () => {
    const layers = createStoryLayers(atlasMapPalette);
    expect(layers.map((layer) => layer.id)).toEqual([
      STORY_LAYER_IDS.base,
      'story-route-glow-sea', 'story-route-line-sea',
      'story-route-glow-rail', 'story-route-line-rail',
      'story-route-glow-road', 'story-route-line-road',
      'story-route-glow-air', 'story-route-line-air',
      STORY_LAYER_IDS.shipmentHalo,
      STORY_LAYER_IDS.shipmentCore,
    ]);
    expect(layers.filter((layer) => layer.id.startsWith('story-route')).every((layer) => layer.source === STORY_ROUTES_SOURCE_ID)).toBe(true);
    expect(baseNetworkOpacity(true)).toBeLessThan(baseNetworkOpacity(false));
  });

  it('reserves focused label areas with invisible, placement-blocking symbols', () => {
    expect(labelBlockImage(171, 30)).toEqual({ id: 'story-label-block-176x32', width: 176, height: 32 });
    expect(labelBlockImage(0, 3)).toEqual({ id: 'story-label-block-8x8', width: 8, height: 8 });

    const features = labelBlockFeatures([{ lngLat: [-76.05, 1.85], x: -5.5, y: -15.2, width: 171, height: 30 }]);
    expect(features.features[0]).toMatchObject({
      geometry: { type: 'Point', coordinates: [-76.05, 1.85] },
      properties: { image: 'story-label-block-176x32', offset: [-5, -15] },
    });

    const layer = createLabelBlockLayer();
    expect(layer.source).toBe(STORY_LABEL_BLOCKS_SOURCE_ID);
    expect(layer.layout).toMatchObject({ 'icon-allow-overlap': true, 'icon-ignore-placement': false });
    expect(layer.paint).toEqual({ 'icon-opacity': 0 });
  });
});
