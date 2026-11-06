import { describe, expect, it } from 'vitest';

import { sampleNetwork, sampleRoutes, sampleSites } from '@/data/sample-network';
import { indexSites, parseWaypoints, routeCoordinates } from '@/lib/network';

describe('sample network', () => {
  it('uses unique ids and codes', () => {
    const ids = [...sampleSites, ...sampleRoutes].map((record) => record.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const records of [sampleSites, sampleRoutes]) {
      const codes = records.map((record) => record.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    }
  });

  it('connects every route to known sites', () => {
    const sitesByCode = indexSites(sampleSites);
    for (const route of sampleRoutes) {
      expect(sitesByCode.has(route.originCode), route.code).toBe(true);
      expect(sitesByCode.has(route.destinationCode), route.code).toBe(true);
      expect(routeCoordinates(route, sitesByCode).length).toBeGreaterThan(1);
    }
  });

  it('gives sea lanes detailed waypoints and customers outlet counts', () => {
    for (const route of sampleRoutes.filter((r) => r.mode === 'sea')) {
      expect(parseWaypoints(route.waypoints).length, route.code).toBeGreaterThan(8);
      expect(route.waypoints!.length).toBeLessThanOrEqual(4000);
    }
    for (const site of sampleSites.filter((s) => s.role === 'customer')) {
      expect(site.outlets, site.code).toBeGreaterThan(0);
    }
  });

  it('includes the codes the story references', () => {
    const siteCodes = new Set(sampleNetwork.sites.map((s) => s.code));
    const routeCodes = new Set(sampleNetwork.routes.map((r) => r.code));
    for (const code of [
      'origin-huila',
      'origin-sidama',
      'origin-minas',
      'port-cartagena',
      'port-djibouti',
      'port-santos',
      'port-hamburg',
      'plant-hamburg',
      'dc-berlin',
      'dc-cologne',
      'dc-lyon',
      'dc-copenhagen',
      'customer-berlin',
      'customer-munich',
      'customer-paris',
      'customer-amsterdam',
      'customer-copenhagen',
      'customer-zurich',
      'customer-lyon',
      'customer-milan',
    ]) {
      expect(siteCodes.has(code), code).toBe(true);
    }
    for (const code of [
      'road-huila-cartagena',
      'rail-sidama-djibouti',
      'road-minas-santos',
      'sea-cartagena-hamburg',
      'sea-djibouti-hamburg',
      'sea-santos-hamburg',
      'road-port-roastery',
      'road-hamburg-berlin',
      'rail-hamburg-cologne',
      'rail-hamburg-lyon',
      'road-hamburg-copenhagen',
    ]) {
      expect(routeCodes.has(code), code).toBe(true);
    }
  });
});
