import type { RouteRecord, SiteRecord } from '@rayfin-app/shared';
import { describe, expect, it } from 'vitest';

import {
  densifyGreatCircle,
  distanceKm,
  indexSites,
  networkBounds,
  networkToGeoJson,
  parseWaypoints,
  routeCoordinates,
  unwrapLongitudes,
  type LngLat,
} from '@/lib/network';

const updatedAt = new Date('2026-01-01T00:00:00Z');

function site(code: string, longitude: number, latitude: number): SiteRecord {
  return {
    id: `id-${code}`,
    code,
    name: code,
    role: 'port',
    city: 'City',
    country: 'Country',
    latitude,
    longitude,
    capacityTonnes: 100,
    updatedAt,
  };
}

function route(
  code: string,
  originCode: string,
  destinationCode: string,
  waypoints?: string | null
): RouteRecord {
  return {
    id: `id-${code}`,
    code,
    name: code,
    mode: 'sea',
    originCode,
    destinationCode,
    waypoints,
    annualVolumeTonnes: 500,
    transitDays: 10,
    co2Tonnes: null,
    updatedAt,
  };
}

const sites = [site('a', 0, 0), site('b', 10, 10), site('c', -20, 40)];
const sitesByCode = indexSites(sites);

describe('indexSites', () => {
  it('indexes sites by code', () => {
    expect(sitesByCode.get('b')?.id).toBe('id-b');
    expect(sitesByCode.size).toBe(3);
  });
});

describe('parseWaypoints', () => {
  it('parses valid points and drops invalid ones', () => {
    expect(parseWaypoints('[[1,2],[3,"x"],[4,95],[5,6,7],"z"]')).toEqual([
      [1, 2],
      [5, 6],
    ]);
  });

  it.each([null, undefined, '', 'not json', '{"a":1}', '42'])(
    'returns no points for %j',
    (raw) => {
      expect(parseWaypoints(raw)).toEqual([]);
    }
  );
});

describe('routeCoordinates', () => {
  it('includes endpoints around parsed waypoints', () => {
    expect(
      routeCoordinates(route('r', 'a', 'b', '[[5,1],[6,2]]'), sitesByCode)
    ).toEqual([
      [0, 0],
      [5, 1],
      [6, 2],
      [10, 10],
    ]);
  });

  it('falls back to endpoints when waypoints are missing or malformed', () => {
    const expected = [
      [0, 0],
      [10, 10],
    ];
    expect(routeCoordinates(route('r', 'a', 'b'), sitesByCode)).toEqual(expected);
    expect(routeCoordinates(route('r', 'a', 'b', '[[oops'), sitesByCode)).toEqual(
      expected
    );
  });

  it('returns no coordinates when an endpoint is unknown', () => {
    expect(routeCoordinates(route('r', 'a', 'missing'), sitesByCode)).toEqual([]);
  });
});

describe('great-circle helpers', () => {
  it('measures distances', () => {
    expect(distanceKm([0, 0], [0, 1])).toBeCloseTo(111.2, 0);
    expect(distanceKm([0, 0], [180, 0])).toBeCloseTo(20015, -1);
  });

  it('densifies long segments along the great circle', () => {
    const path = densifyGreatCircle(
      [
        [-74, 40.7],
        [-0.1, 51.5],
      ],
      100
    );
    expect(path.length).toBeGreaterThan(50);
    expect(path[0]).toEqual([-74, 40.7]);
    expect(path.at(-1)![0]).toBeCloseTo(-0.1, 6);
    expect(path.at(-1)![1]).toBeCloseTo(51.5, 6);
    const midpoint = path[Math.floor(path.length / 2)];
    expect(midpoint[1]).toBeGreaterThan(51.5);
    for (let index = 1; index < path.length; index += 1) {
      expect(distanceKm(path[index - 1], path[index])).toBeLessThanOrEqual(100.01);
    }
  });

  it('keeps short segments untouched', () => {
    const points: LngLat[] = [
      [0, 0],
      [0.1, 0.1],
    ];
    expect(densifyGreatCircle(points, 100)).toEqual(points);
  });

  it('unwraps paths that cross the antimeridian', () => {
    expect(
      unwrapLongitudes([
        [170, 0],
        [-175, 1],
        [-170, 2],
      ])
    ).toEqual([
      [170, 0],
      [185, 1],
      [190, 2],
    ]);
    const path = densifyGreatCircle(
      [
        [170, 10],
        [-170, 10],
      ],
      100
    );
    for (let index = 1; index < path.length; index += 1) {
      expect(path[index][0]).toBeGreaterThan(path[index - 1][0]);
    }
    expect(path.at(-1)![0]).toBeCloseTo(190, 6);
  });
});

describe('networkToGeoJson', () => {
  const network = {
    sites: [...sites, { ...site('bad', 0, 0), latitude: Number.NaN }],
    routes: [
      route('ab', 'a', 'b', '[[5,1]]'),
      route('ac', 'a', 'c', 'broken'),
      route('orphan', 'a', 'missing'),
    ],
  };

  it('builds site and route feature collections with metrics', () => {
    const geojson = networkToGeoJson(network);
    expect(geojson.sites.features.map((f) => f.properties.code)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(geojson.sites.features[1]).toMatchObject({
      id: 1,
      geometry: { type: 'Point', coordinates: [10, 10] },
      properties: {
        code: 'b',
        role: 'port',
        capacityTonnes: 100,
        outlets: null,
      },
    });
    expect(geojson.routes.features.map((f) => f.properties.code)).toEqual([
      'ab',
      'ac',
    ]);
    const [ab] = geojson.routes.features;
    expect(ab.properties).toMatchObject({
      mode: 'sea',
      annualVolumeTonnes: 500,
      transitDays: 10,
      co2Tonnes: null,
    });
    expect(ab.properties.distanceKm).toBeGreaterThan(1500);
    expect(ab.geometry.coordinates.length).toBeGreaterThan(3);
  });

  it('can skip densification', () => {
    const geojson = networkToGeoJson(network, { densifyKm: false });
    expect(geojson.routes.features[0].geometry.coordinates).toEqual([
      [0, 0],
      [5, 1],
      [10, 10],
    ]);
  });
});

describe('networkBounds', () => {
  const network = {
    sites,
    routes: [route('ab', 'a', 'b', '[[30,-5]]')],
  };

  it('covers the whole network by default', () => {
    expect(networkBounds(network)).toEqual([
      [-20, -5],
      [30, 40],
    ]);
  });

  it('limits to the requested sites and routes', () => {
    expect(networkBounds(network, { siteCodes: ['a', 'b'] })).toEqual([
      [0, 0],
      [10, 10],
    ]);
    expect(networkBounds(network, { routeCodes: ['ab'] })).toEqual([
      [0, -5],
      [30, 10],
    ]);
  });

  it('returns null when nothing matches', () => {
    expect(networkBounds(network, { siteCodes: ['missing'] })).toBeNull();
    expect(networkBounds({ sites: [], routes: [] })).toBeNull();
  });
});
