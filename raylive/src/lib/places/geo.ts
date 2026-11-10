import { CONTINENT_COUNTRIES } from './continents';
import type { Continent, GeoPoint, LonLat } from './types';

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

function angularDistance(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Haversine distance in kilometres. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  return angularDistance(a, b) * EARTH_RADIUS_KM;
}

function toVector({ lat, lon }: GeoPoint): [number, number, number] {
  const phi = toRadians(lat);
  const lambda = toRadians(lon);
  return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
}

/**
 * Great-circle arc from `a` to `b` as `segments + 1` `[lon, lat]` points. Longitudes are
 * unwrapped (they may leave [-180, 180]) so a line crossing the antimeridian stays continuous.
 */
export function greatCircle(a: GeoPoint, b: GeoPoint, segments = 64): LonLat[] {
  const steps = Math.max(1, Math.round(segments));
  const delta = angularDistance(a, b);
  const sinDelta = Math.sin(delta);
  const va = toVector(a);
  const vb = toVector(b);
  const points: LonLat[] = [];

  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    let point: LonLat;
    if (i === 0) point = [a.lon, a.lat];
    else if (i === steps) point = [b.lon, b.lat];
    else if (sinDelta < 1e-12) {
      // Coincident (or antipodal, where the path is undefined): interpolate linearly.
      point = [a.lon + (b.lon - a.lon) * f, a.lat + (b.lat - a.lat) * f];
    } else {
      const wa = Math.sin((1 - f) * delta) / sinDelta;
      const wb = Math.sin(f * delta) / sinDelta;
      const x = wa * va[0] + wb * vb[0];
      const y = wa * va[1] + wb * vb[1];
      const z = wa * va[2] + wb * vb[2];
      point = [toDegrees(Math.atan2(y, x)), toDegrees(Math.atan2(z, Math.hypot(x, y)))];
    }

    const previous = points[points.length - 1];
    if (previous) {
      while (point[0] - previous[0] > 180) point[0] -= 360;
      while (point[0] - previous[0] < -180) point[0] += 360;
    }
    points.push(point);
  }
  return points;
}

let continentByCountry: Map<string, Continent> | undefined;

/** Continent for an ISO-2 code, as assigned by GeoNames (e.g. Türkiye → Asia, Russia → Europe). */
export function continentOf(countryCode: string): Continent | undefined {
  if (!continentByCountry) {
    continentByCountry = new Map();
    for (const [continent, rows] of Object.entries(CONTINENT_COUNTRIES)) {
      for (const code of rows.join(' ').split(' ')) {
        continentByCountry.set(code, continent as Continent);
      }
    }
  }
  return continentByCountry.get(countryCode.toUpperCase());
}
