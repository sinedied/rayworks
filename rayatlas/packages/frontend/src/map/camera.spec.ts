import { describe, expect, it } from 'vitest';

import { sampleNetwork } from '@/data/sample-network';
import { buildScenes } from '@/story/scenes';
import { sampleStory } from '@/story/sampleStory';

import { flightCurve, formatCoordinates, readCamera, sceneCameraTarget } from './camera';

describe('camera', () => {
  const scenes = buildScenes(sampleStory);
  const scene = (key: string) => scenes.find((item) => item.key === key)!;

  it('flies to fixed cameras and frames fit chapters', () => {
    expect(sceneCameraTarget(scene('origins'), sampleNetwork)).toEqual({ kind: 'camera', camera: scene('origins').camera });
    const target = sceneCameraTarget(scene('export'), sampleNetwork);
    expect(target.kind).toBe('bounds');
    if (target.kind !== 'bounds') return;
    const [[west, south], [east, north]] = target.bounds;
    expect(west).toBeLessThan(-75);
    expect(east).toBeGreaterThan(43);
    expect(south).toBeLessThan(-23);
    expect(north).toBeGreaterThan(11);
  });

  it('uses a saved camera instead of automatic framing', () => {
    const overridden = buildScenes(sampleStory, new Set(['export'])).find((item) => item.key === 'export')!;
    expect(sceneCameraTarget(overridden, sampleNetwork).kind).toBe('camera');
  });

  it('reads and rounds the live camera with wrapped longitude', () => {
    expect(readCamera({
      getCenter: () => ({ lng: 370.1234567, lat: 12.3456789 }),
      getZoom: () => 3.14159,
      getBearing: () => -12.3456,
      getPitch: () => 45.678,
    })).toEqual({ center: [10.12346, 12.34568], zoom: 3.14, bearing: -12.35, pitch: 45.68 });
  });

  it('formats coordinates and tunes flight curves', () => {
    expect(formatCoordinates([-76.051, 1.853])).toBe('1.85° N, 76.05° W');
    expect(formatCoordinates([10.077, -53.535])).toBe('53.53° S, 10.08° E');
    expect(flightCurve(2, 15)).toBeGreaterThan(flightCurve(2, 4));
  });
});
