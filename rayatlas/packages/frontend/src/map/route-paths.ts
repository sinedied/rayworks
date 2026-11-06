import type { RouteMode } from '@rayfin-app/shared';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

import { distanceKm, type LngLat } from '@/lib/network';

/** A route polyline with cumulative distances, for placing moving shipments along it. */
export interface RoutePath {
  code: string;
  mode: RouteMode;
  coordinates: LngLat[];
  /**
   * Distance from the start to each vertex in Web Mercator units, matching how MapLibre measures
   * `line-progress`, so a shipment can ride the leading edge of a drawing route.
   */
  cumulative: number[];
  lengthKm: number;
}

function mercator([lng, lat]: LngLat): [number, number] {
  const phi = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  return [(lng + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2];
}

export function buildRoutePath(code: string, mode: RouteMode, coordinates: readonly LngLat[]): RoutePath {
  const cumulative = [0];
  let lengthKm = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [x0, y0] = mercator(coordinates[index - 1]);
    const [x1, y1] = mercator(coordinates[index]);
    cumulative.push(cumulative[index - 1] + Math.hypot(x1 - x0, y1 - y0));
    lengthKm += distanceKm(coordinates[index - 1], coordinates[index]);
  }
  return { code, mode, coordinates: [...coordinates], cumulative, lengthKm };
}

export function routePathsFromFeatures(
  features: ReadonlyArray<Feature<LineString, { code: string; mode: RouteMode }>>,
): Map<string, RoutePath> {
  const paths = new Map<string, RoutePath>();
  for (const feature of features) {
    const coordinates = feature.geometry.coordinates.map(([lng, lat]): LngLat => [lng, lat]);
    if (coordinates.length < 2) continue;
    paths.set(feature.properties.code, buildRoutePath(feature.properties.code, feature.properties.mode, coordinates));
  }
  return paths;
}

/** Point at fraction `t` (0..1) of the projected path length, interpolated between vertices. */
export function pointAlong(path: RoutePath, t: number): LngLat {
  const { coordinates, cumulative } = path;
  const total = cumulative.at(-1) ?? 0;
  if (coordinates.length === 0) return [0, 0];
  if (coordinates.length === 1 || total <= 0) return coordinates[0];
  const target = Math.min(1, Math.max(0, t)) * total;
  let low = 0;
  let high = cumulative.length - 1;
  while (low < high - 1) {
    const middle = (low + high) >> 1;
    if (cumulative[middle] <= target) low = middle;
    else high = middle;
  }
  const span = cumulative[high] - cumulative[low];
  const f = span > 0 ? (target - cumulative[low]) / span : 0;
  const [x0, y0] = coordinates[low];
  const [x1, y1] = coordinates[high];
  return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
}

/** Seconds for one shipment to travel the full route: long lanes move faster on screen. */
export function shipmentPeriodSeconds(lengthKm: number): number {
  return Math.min(16, Math.max(5, 4 + lengthKm / 1400));
}

/** Number of shipments in flight on a route at once. */
export function shipmentCount(lengthKm: number): number {
  return Math.min(4, Math.max(1, Math.round(lengthKm / 3500)));
}

export type ShipmentCollection = FeatureCollection<Point, { mode: RouteMode; code: string }>;

/**
 * Moving shipments for the focused routes. While a route is still drawing (`drawProgress < 1`)
 * there is a single shipment riding its leading edge; afterwards shipments loop end to end.
 */
export function shipmentPositions(
  paths: Iterable<RoutePath>,
  elapsedSeconds: number,
  drawProgress: number,
): ShipmentCollection {
  const features: ShipmentCollection['features'] = [];
  for (const path of paths) {
    if (drawProgress < 1) {
      if (drawProgress <= 0) continue;
      features.push({
        type: 'Feature',
        properties: { mode: path.mode, code: path.code },
        geometry: { type: 'Point', coordinates: pointAlong(path, drawProgress) },
      });
      continue;
    }
    const count = shipmentCount(path.lengthKm);
    const period = shipmentPeriodSeconds(path.lengthKm);
    for (let index = 0; index < count; index += 1) {
      const t = (elapsedSeconds / period + index / count) % 1;
      features.push({
        type: 'Feature',
        properties: { mode: path.mode, code: path.code },
        geometry: { type: 'Point', coordinates: pointAlong(path, t) },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}
