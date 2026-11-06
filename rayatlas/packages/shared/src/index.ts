/**
 * Browser-safe contracts shared by the data registration package and frontend.
 *
 * Keep each record shape aligned with its decorated runtime entity in
 * `@rayfin-app/data`. This package must stay isomorphic, so do not import the
 * decorated classes here.
 */

/** Where a site sits in the supply chain the story follows. */
export type SiteRole = 'origin' | 'port' | 'plant' | 'distribution' | 'customer';

/** How goods travel along a route. */
export type RouteMode = 'sea' | 'rail' | 'road' | 'air';

export interface SiteRecord {
  id: string;
  /** Stable slug referenced by stories and routes, e.g. `origin-huila`. */
  code: string;
  name: string;
  role: SiteRole;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  summary?: string | null;
  /** Annual throughput or output in tonnes, when meaningful for the role. */
  capacityTonnes?: number | null;
  /** Number of outlets served, for customer sites. */
  outlets?: number | null;
  /** Altitude in meters, mainly for origin farms. */
  elevationMeters?: number | null;
  updatedAt: Date;
}

export interface RouteRecord {
  id: string;
  /** Stable slug referenced by stories, e.g. `sea-cartagena-hamburg`. */
  code: string;
  name: string;
  mode: RouteMode;
  /** `SiteRecord.code` of the departure site. */
  originCode: string;
  /** `SiteRecord.code` of the arrival site. */
  destinationCode: string;
  /**
   * JSON array of intermediate `[longitude, latitude]` points, excluding both
   * endpoints, so sea lanes follow real shipping corridors instead of crossing land.
   */
  waypoints?: string | null;
  annualVolumeTonnes: number;
  transitDays: number;
  co2Tonnes?: number | null;
  updatedAt: Date;
}

export interface NetworkData {
  sites: SiteRecord[];
  routes: RouteRecord[];
}

export type UniversalAppSchema = {
  Site: SiteRecord;
  Route: RouteRecord;
};
