import { createPlaceIndex } from './search';
import type { PlaceIndex, RawPlaceData, WorldFeatureCollection } from './types';

export { continentOf, distanceKm, greatCircle } from './geo';
export { countryName, formatPlace, normalizeText } from './search';
export type {
  Continent,
  GeoPoint,
  LonLat,
  Place,
  PlaceIndex,
  PlaceMatch,
  WorldFeature,
  WorldFeatureCollection,
} from './types';

export const placesAttribution =
  'City data © GeoNames (CC BY 4.0). Country shapes: Natural Earth.';

/** Memoizes an async loader, clearing the cache on failure so a later call can retry. */
function memoize<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    pending ??= load().catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
}

/** Lazily loads the bundled GeoNames city index (its own chunk). */
export const loadPlaces: () => Promise<PlaceIndex> = memoize(async () => {
  const { default: data } = await import('./cities.data.json');
  return createPlaceIndex(data as unknown as RawPlaceData);
});

/** Lazily loads the bundled Natural Earth 110m country shapes (its own chunk). */
export const loadWorld: () => Promise<WorldFeatureCollection> = memoize(async () => {
  const { default: world } = await import('./world-110m.json');
  return world as unknown as WorldFeatureCollection;
});
