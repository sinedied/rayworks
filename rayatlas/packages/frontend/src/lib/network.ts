import type {
  NetworkData,
  RouteMode,
  RouteRecord,
  SiteRecord,
  SiteRole,
} from '@rayfin-app/shared';
import type {
  Feature,
  FeatureCollection,
  LineString,
  Point,
} from 'geojson';

/** A `[longitude, latitude]` pair, matching GeoJSON and MapLibre order. */
export type LngLat = [number, number];

/** `[[west, south], [east, north]]`, accepted by MapLibre `fitBounds`. */
export type LngLatBounds = [LngLat, LngLat];

export interface SiteFeatureProperties {
  id: string;
  code: string;
  name: string;
  role: SiteRole;
  city: string;
  country: string;
  capacityTonnes: number | null;
  outlets: number | null;
  elevationMeters: number | null;
}

export interface RouteFeatureProperties {
  id: string;
  code: string;
  name: string;
  mode: RouteMode;
  originCode: string;
  destinationCode: string;
  annualVolumeTonnes: number;
  transitDays: number;
  co2Tonnes: number | null;
  distanceKm: number;
}

export interface NetworkGeoJson {
  sites: FeatureCollection<Point, SiteFeatureProperties>;
  routes: FeatureCollection<LineString, RouteFeatureProperties>;
}

export interface NetworkGeoJsonOptions {
  /**
   * Insert great-circle points so no segment is longer than this many
   * kilometers. Use `0` or `false` to keep only the stored points.
   */
  densifyKm?: number | false;
}

const EARTH_RADIUS_KM = 6371.0088;
const DEFAULT_DENSIFY_KM = 150;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

function isLngLat(value: unknown): value is LngLat {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    Math.abs(value[1]) <= 90
  );
}

function siteLngLat(site: SiteRecord): LngLat | null {
  const point: unknown = [Number(site.longitude), Number(site.latitude)];
  return isLngLat(point) ? point : null;
}

export function indexSites(
  sites: readonly SiteRecord[]
): Map<string, SiteRecord> {
  return new Map(sites.map((site) => [site.code, site]));
}

/**
 * Parses a route's stored waypoint JSON. Malformed, missing, or invalid
 * entries are ignored, so the result is always a usable (possibly empty) list.
 */
export function parseWaypoints(raw: string | null | undefined): LngLat[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isLngLat)
      .map((point): LngLat => [point[0], point[1]]);
  } catch {
    return [];
  }
}

/**
 * Returns the route's path from origin to destination, including both
 * endpoints and any stored waypoints. Returns an empty list when either
 * endpoint site is unknown; never throws.
 */
export function routeCoordinates(
  route: RouteRecord,
  sitesByCode: ReadonlyMap<string, SiteRecord>
): LngLat[] {
  const origin = sitesByCode.get(route.originCode);
  const destination = sitesByCode.get(route.destinationCode);
  const start = origin ? siteLngLat(origin) : null;
  const end = destination ? siteLngLat(destination) : null;
  if (!start || !end) return [];
  return [start, ...parseWaypoints(route.waypoints), end];
}

/** Great-circle distance between two points in kilometers. */
export function distanceKm(from: LngLat, to: LngLat): number {
  const lat1 = toRadians(from[1]);
  const lat2 = toRadians(to[1]);
  const dLat = lat2 - lat1;
  const dLng = toRadians(to[0] - from[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total great-circle length of a path in kilometers. */
export function pathLengthKm(coordinates: readonly LngLat[]): number {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += distanceKm(coordinates[index - 1], coordinates[index]);
  }
  return total;
}

function toVector([lng, lat]: LngLat): [number, number, number] {
  const phi = toRadians(lat);
  const lambda = toRadians(lng);
  return [
    Math.cos(phi) * Math.cos(lambda),
    Math.cos(phi) * Math.sin(lambda),
    Math.sin(phi),
  ];
}

function fromVector([x, y, z]: [number, number, number]): LngLat {
  return [toDegrees(Math.atan2(y, x)), toDegrees(Math.atan2(z, Math.hypot(x, y)))];
}

/**
 * Rewrites longitudes so consecutive points never jump more than 180°.
 * Lines crossing the antimeridian then continue past ±180 instead of
 * wrapping around the world, which MapLibre renders as one continuous line.
 */
export function unwrapLongitudes(coordinates: readonly LngLat[]): LngLat[] {
  const result: LngLat[] = [];
  for (const [lng, lat] of coordinates) {
    const previous = result.at(-1);
    if (!previous) {
      result.push([lng, lat]);
      continue;
    }
    let next = lng;
    while (next - previous[0] > 180) next -= 360;
    while (next - previous[0] < -180) next += 360;
    result.push([next, lat]);
  }
  return result;
}

/**
 * Inserts spherical-interpolation points along each segment so that no
 * segment exceeds `maxSegmentKm`, making long lines follow great circles on
 * globe projections. Output longitudes are unwrapped across the antimeridian.
 */
export function densifyGreatCircle(
  coordinates: readonly LngLat[],
  maxSegmentKm = DEFAULT_DENSIFY_KM
): LngLat[] {
  if (coordinates.length < 2 || !(maxSegmentKm > 0)) {
    return unwrapLongitudes(coordinates);
  }

  const result: LngLat[] = [coordinates[0]];
  for (let index = 1; index < coordinates.length; index += 1) {
    const from = coordinates[index - 1];
    const to = coordinates[index];
    const segmentKm = distanceKm(from, to);
    const steps = Math.ceil(segmentKm / maxSegmentKm);
    const angle = segmentKm / EARTH_RADIUS_KM;
    const sinAngle = Math.sin(angle);

    if (steps > 1 && sinAngle > 1e-9) {
      const a = toVector(from);
      const b = toVector(to);
      for (let step = 1; step < steps; step += 1) {
        const t = step / steps;
        const wa = Math.sin((1 - t) * angle) / sinAngle;
        const wb = Math.sin(t * angle) / sinAngle;
        result.push(
          fromVector([
            wa * a[0] + wb * b[0],
            wa * a[1] + wb * b[1],
            wa * a[2] + wb * b[2],
          ])
        );
      }
    }
    result.push(to);
  }
  return unwrapLongitudes(result);
}

function nullableNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Converts the network to GeoJSON sources. Sites without valid coordinates
 * and routes whose endpoints cannot be resolved are skipped. Feature ids are
 * stable indexes into the emitted collections for MapLibre feature state.
 */
export function networkToGeoJson(
  network: NetworkData,
  options: NetworkGeoJsonOptions = {}
): NetworkGeoJson {
  const densifyKm = options.densifyKm ?? DEFAULT_DENSIFY_KM;
  const sitesByCode = indexSites(network.sites);

  const siteFeatures: Feature<Point, SiteFeatureProperties>[] = [];
  for (const site of network.sites) {
    const coordinates = siteLngLat(site);
    if (!coordinates) continue;
    siteFeatures.push({
      type: 'Feature',
      id: siteFeatures.length,
      geometry: { type: 'Point', coordinates },
      properties: {
        id: site.id,
        code: site.code,
        name: site.name,
        role: site.role,
        city: site.city,
        country: site.country,
        capacityTonnes: nullableNumber(site.capacityTonnes),
        outlets: nullableNumber(site.outlets),
        elevationMeters: nullableNumber(site.elevationMeters),
      },
    });
  }

  const routeFeatures: Feature<LineString, RouteFeatureProperties>[] = [];
  for (const route of network.routes) {
    const path = routeCoordinates(route, sitesByCode);
    if (path.length < 2) continue;
    routeFeatures.push({
      type: 'Feature',
      id: routeFeatures.length,
      geometry: {
        type: 'LineString',
        coordinates: densifyKm
          ? densifyGreatCircle(path, densifyKm)
          : unwrapLongitudes(path),
      },
      properties: {
        id: route.id,
        code: route.code,
        name: route.name,
        mode: route.mode,
        originCode: route.originCode,
        destinationCode: route.destinationCode,
        annualVolumeTonnes: Number(route.annualVolumeTonnes) || 0,
        transitDays: Number(route.transitDays) || 0,
        co2Tonnes: nullableNumber(route.co2Tonnes),
        distanceKm: Math.round(pathLengthKm(path)),
      },
    });
  }

  return {
    sites: { type: 'FeatureCollection', features: siteFeatures },
    routes: { type: 'FeatureCollection', features: routeFeatures },
  };
}

/** Bounding box of a list of points, or `null` when it is empty. */
export function coordinatesBounds(
  coordinates: Iterable<LngLat>
): LngLatBounds | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of coordinates) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return Number.isFinite(west)
    ? [
        [west, south],
        [east, north],
      ]
    : null;
}

export interface NetworkBoundsOptions {
  /** Site codes to include. */
  siteCodes?: readonly string[];
  /** Route codes to include, with their full paths. */
  routeCodes?: readonly string[];
}

/**
 * Bounds of the selected sites and routes, or `null` when nothing with
 * coordinates matches. With no codes, the whole network is included; once
 * either list is given, only the listed sites and routes count. Unknown
 * codes are ignored.
 */
export function networkBounds(
  network: NetworkData,
  options: NetworkBoundsOptions = {}
): LngLatBounds | null {
  const sitesByCode = indexSites(network.sites);
  const everything = !options.siteCodes && !options.routeCodes;
  const siteCodes = everything ? null : new Set(options.siteCodes ?? []);
  const routeCodes = everything ? null : new Set(options.routeCodes ?? []);
  const points: LngLat[] = [];

  for (const site of network.sites) {
    if (siteCodes && !siteCodes.has(site.code)) continue;
    const point = siteLngLat(site);
    if (point) points.push(point);
  }
  for (const route of network.routes) {
    if (routeCodes && !routeCodes.has(route.code)) continue;
    points.push(...unwrapLongitudes(routeCoordinates(route, sitesByCode)));
  }

  return coordinatesBounds(points);
}
