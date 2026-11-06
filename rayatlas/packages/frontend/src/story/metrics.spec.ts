import type { NetworkData, RouteRecord, SiteRecord } from '@rayfin-app/shared';
import { describe, expect, it } from 'vitest';

import { evaluateMetric, formatMetric, selectRoutes, selectSites } from './metrics';
import type { StoryMetric } from './types';

const updatedAt = new Date('2026-11-01T00:00:00Z');

function site(code: string, role: SiteRecord['role'], extra: Partial<SiteRecord> = {}): SiteRecord {
  return { id: code, code, name: code, role, city: 'City', country: 'Country', latitude: 0, longitude: 0, updatedAt, ...extra };
}

function route(code: string, mode: RouteRecord['mode'], extra: Partial<RouteRecord> = {}): RouteRecord {
  return {
    id: code, code, name: code, mode, originCode: 'a', destinationCode: 'b',
    annualVolumeTonnes: 1000, transitDays: 2, updatedAt, ...extra,
  };
}

const network: NetworkData = {
  sites: [
    site('origin-huila', 'origin', { elevationMeters: 1700 }),
    site('origin-sidama', 'origin', { elevationMeters: 1900 }),
    site('origin-minas', 'origin', { elevationMeters: null }),
    site('plant-hamburg', 'plant', { capacityTonnes: 18_400 }),
    site('customer-berlin', 'customer', { outlets: 40 }),
    site('customer-paris', 'customer', { outlets: 25 }),
  ],
  routes: [
    route('sea-cartagena-hamburg', 'sea', { annualVolumeTonnes: 6000, transitDays: 18, co2Tonnes: 120 }),
    route('sea-santos-hamburg', 'sea', { annualVolumeTonnes: 7500, transitDays: 21 }),
    route('road-huila-cartagena', 'road', { transitDays: 3 }),
    route('lastmile-berlin', 'road', { transitDays: 1 }),
    route('lastmile-paris', 'road', { transitDays: 1 }),
  ],
};

const codesOf = (records: Array<{ code: string }>) => records.map((record) => record.code);

describe('selectSites / selectRoutes', () => {
  it('selects nothing for an empty focus', () => {
    expect(selectSites(network, {})).toEqual([]);
    expect(selectRoutes(network, { siteRoles: ['origin'] })).toEqual([]);
    expect(selectRoutes(network, { routeCodePrefixes: [''] })).toEqual([]);
  });

  it('unions site codes and roles', () => {
    expect(codesOf(selectSites(network, { siteCodes: ['plant-hamburg'], siteRoles: ['customer'] })))
      .toEqual(['plant-hamburg', 'customer-berlin', 'customer-paris']);
  });

  it('unions route codes, modes, and prefixes', () => {
    expect(codesOf(selectRoutes(network, { routeCodes: ['road-huila-cartagena'], routeModes: ['sea'] })))
      .toEqual(['sea-cartagena-hamburg', 'sea-santos-hamburg', 'road-huila-cartagena']);
    expect(codesOf(selectRoutes(network, { routeCodePrefixes: ['lastmile-'] })))
      .toEqual(['lastmile-berlin', 'lastmile-paris']);
  });
});

describe('evaluateMetric', () => {
  const metric = (source: StoryMetric['source']): StoryMetric => ({ id: 'm', label: 'M', format: 'number', source });

  it('counts selected records', () => {
    expect(evaluateMetric(metric({ kind: 'count', entity: 'site', filter: { siteRoles: ['origin'] } }), network)).toBe(3);
    expect(evaluateMetric(metric({ kind: 'count', entity: 'route', filter: { routeModes: ['air'] } }), network)).toBe(0);
  });

  it('aggregates site and route fields, skipping missing values', () => {
    const origins = { siteRoles: ['origin' as const] };
    expect(evaluateMetric(metric({ kind: 'max', entity: 'site', field: 'elevationMeters', filter: origins }), network)).toBe(1900);
    expect(evaluateMetric(metric({ kind: 'min', entity: 'site', field: 'elevationMeters', filter: origins }), network)).toBe(1700);
    expect(evaluateMetric(metric({ kind: 'avg', entity: 'site', field: 'elevationMeters', filter: origins }), network)).toBe(1800);
    expect(evaluateMetric(metric({ kind: 'sum', entity: 'site', field: 'outlets', filter: { siteRoles: ['customer'] } }), network)).toBe(65);
    expect(evaluateMetric(metric({ kind: 'sum', entity: 'route', field: 'annualVolumeTonnes', filter: { routeModes: ['sea'] } }), network)).toBe(13_500);
    expect(evaluateMetric(metric({ kind: 'max', entity: 'route', field: 'transitDays', filter: { routeModes: ['sea'] } }), network)).toBe(21);
    expect(evaluateMetric(metric({ kind: 'sum', entity: 'route', field: 'co2Tonnes', filter: { routeModes: ['sea'] } }), network)).toBe(120);
  });

  it('returns null when there is no data or the field is missing', () => {
    expect(evaluateMetric(metric({ kind: 'sum', entity: 'route', field: 'co2Tonnes', filter: { routeModes: ['road'] } }), network)).toBeNull();
    expect(evaluateMetric(metric({ kind: 'max', entity: 'site', field: 'capacityTonnes', filter: { siteCodes: ['missing'] } }), network)).toBeNull();
    expect(evaluateMetric(metric({ kind: 'count', entity: 'site', filter: { siteRoles: ['origin'] } }), { sites: [], routes: [] })).toBeNull();
  });
});

describe('formatMetric', () => {
  it('formats tonnes compactly when large', () => {
    expect(formatMetric(18_400, 'tonnes')).toBe('18.4k t');
    expect(formatMetric(1_250, 'tonnes')).toBe('1,250 t');
    expect(formatMetric(2_400_000, 'tonnes')).toBe('2.4M t');
  });

  it('formats days, meters, counts, and numbers', () => {
    expect(formatMetric(21, 'days')).toBe('21 days');
    expect(formatMetric(1, 'days')).toBe('1 day');
    expect(formatMetric(1900, 'meters')).toBe('1,900 m');
    expect(formatMetric(1833.333, 'meters')).toBe('1,833 m');
    expect(formatMetric(1234, 'count')).toBe('1,234');
    expect(formatMetric(12.345, 'number')).toBe('12.3');
  });

  it('renders missing values as a dash and honors the locale', () => {
    expect(formatMetric(null, 'tonnes')).toBe('—');
    expect(formatMetric(1900, 'meters', 'de-DE')).toBe('1.900 m');
  });
});
