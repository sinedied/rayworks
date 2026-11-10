export type Place = {
  /** GeoNames id. */
  id: string;
  name: string;
  /** First-level administrative region (state, province...). */
  region?: string;
  /** ISO 3166-1 alpha-2. */
  countryCode: string;
  lat: number;
  lon: number;
  population: number;
};

export type GeoPoint = { lat: number; lon: number };

/** `[lon, lat]`, GeoJSON order. */
export type LonLat = [number, number];

export type Continent =
  | 'Africa'
  | 'Antarctica'
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'Oceania'
  | 'South America';

/** A search hit; `alias` is set when the query matched an exonym rather than the name. */
export type PlaceMatch = { place: Place; alias?: string };

export interface PlaceIndex {
  readonly places: readonly Place[];
  get(id: string): Place | undefined;
  search(query: string, limit?: number): Place[];
  /** Like `search`, but reports the exonym ("Cologne") that matched, if any. */
  searchMatches(query: string, limit?: number): PlaceMatch[];
}

/** Compact city tuples written by `scripts/build-places.mjs`. */
export type RawPlaceData = {
  regions: ([string] | [string, string])[];
  cities: [
    id: number,
    name: string,
    asciiName: string,
    region: number,
    countryCode: string,
    lat: number,
    lon: number,
    population: number,
    /** "|"-joined search aliases (exonyms), only present when the city has any. */
    aliases?: string,
  ][];
};

export type WorldFeature = {
  type: 'Feature';
  properties: { iso_a2: string; name: string };
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
};

/** Structurally compatible with a GeoJSON `FeatureCollection`. */
export type WorldFeatureCollection = {
  type: 'FeatureCollection';
  features: WorldFeature[];
};
