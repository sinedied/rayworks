import { describe, expect, it } from 'vitest';

import { sampleNetwork } from '@/data/sample-network';
import { networkToGeoJson } from '@/lib/network';

import { buildRoutePath, pointAlong, routePathsFromFeatures, shipmentCount, shipmentPositions } from './route-paths';

describe('route paths', () => {
  const path = buildRoutePath('test', 'sea', [[0, 0], [10, 0], [20, 0]]);

  it('measures cumulative length and interpolates along it', () => {
    expect(path.cumulative).toHaveLength(3);
    expect(path.lengthKm).toBeGreaterThan(2000);
    expect(pointAlong(path, 0)).toEqual([0, 0]);
    expect(pointAlong(path, 1)).toEqual([20, 0]);
    const middle = pointAlong(path, 0.5);
    expect(middle[0]).toBeCloseTo(10, 5);
    expect(pointAlong(path, 0.25)[0]).toBeCloseTo(5, 5);
    expect(pointAlong(path, 7)).toEqual([20, 0]);
  });

  it('rides the drawing edge, then loops shipments', () => {
    expect(shipmentPositions([path], 0, 0).features).toHaveLength(0);
    const drawing = shipmentPositions([path], 0, 0.5);
    expect(drawing.features).toHaveLength(1);
    expect(drawing.features[0].geometry.coordinates[0]).toBeCloseTo(10, 5);

    const looping = shipmentPositions([path], 3, 1);
    expect(looping.features).toHaveLength(shipmentCount(path.lengthKm));
    expect(looping.features.every((feature) => feature.properties.mode === 'sea')).toBe(true);
  });

  it('indexes every sample route', () => {
    const paths = routePathsFromFeatures(networkToGeoJson(sampleNetwork).routes.features);
    expect(paths.size).toBe(sampleNetwork.routes.length);
    expect(paths.get('sea-djibouti-hamburg')!.lengthKm).toBeGreaterThan(8000);
  });
});
