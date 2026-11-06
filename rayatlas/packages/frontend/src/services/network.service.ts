import type {
  NetworkData,
  RouteRecord,
  SiteRecord,
} from '@rayfin-app/shared';

import { sampleNetwork } from '@/data/sample-network';
import { getRayfinClient } from '@/lib/rayfin-client';

export type NetworkDataSource = 'sample' | 'rayfin';

const PAGE_SIZE = 500;

const siteFields = [
  'id',
  'code',
  'name',
  'role',
  'city',
  'country',
  'latitude',
  'longitude',
  'summary',
  'capacityTonnes',
  'outlets',
  'elevationMeters',
  'updatedAt',
] as const;

const routeFields = [
  'id',
  'code',
  'name',
  'mode',
  'originCode',
  'destinationCode',
  'waypoints',
  'annualVolumeTonnes',
  'transitDays',
  'co2Tonnes',
  'updatedAt',
] as const;

export function configuredNetworkDataSource(): NetworkDataSource {
  return import.meta.env.VITE_ATLAS_DATA_SOURCE === 'rayfin'
    ? 'rayfin'
    : 'sample';
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function requiredNumber(value: unknown): number {
  return optionalNumber(value) ?? Number.NaN;
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

/** Decimal and date columns may arrive serialized; coerce them to the contract types. */
function normalizeSite(row: SiteRecord): SiteRecord {
  return {
    ...row,
    latitude: requiredNumber(row.latitude),
    longitude: requiredNumber(row.longitude),
    summary: row.summary ?? null,
    capacityTonnes: optionalNumber(row.capacityTonnes),
    outlets: optionalNumber(row.outlets),
    elevationMeters: optionalNumber(row.elevationMeters),
    updatedAt: toDate(row.updatedAt),
  };
}

function normalizeRoute(row: RouteRecord): RouteRecord {
  return {
    ...row,
    waypoints: row.waypoints ?? null,
    annualVolumeTonnes: requiredNumber(row.annualVolumeTonnes),
    transitDays: requiredNumber(row.transitDays),
    co2Tonnes: optionalNumber(row.co2Tonnes),
    updatedAt: toDate(row.updatedAt),
  };
}

async function loadRayfinNetwork(): Promise<NetworkData> {
  const client = await getRayfinClient();

  const sites: SiteRecord[] = [];
  let siteCursor: string | undefined;
  do {
    const query = client.data.Site.select([...siteFields])
      .orderBy({ code: 'asc' })
      .first(PAGE_SIZE);
    const page = siteCursor
      ? await query.after(siteCursor).executePaginated()
      : await query.executePaginated();
    sites.push(...page.items.map(normalizeSite));
    siteCursor = page.hasNextPage ? page.endCursor : undefined;
  } while (siteCursor);

  const routes: RouteRecord[] = [];
  let routeCursor: string | undefined;
  do {
    const query = client.data.Route.select([...routeFields])
      .orderBy({ code: 'asc' })
      .first(PAGE_SIZE);
    const page = routeCursor
      ? await query.after(routeCursor).executePaginated()
      : await query.executePaginated();
    routes.push(...page.items.map(normalizeRoute));
    routeCursor = page.hasNextPage ? page.endCursor : undefined;
  } while (routeCursor);

  return { sites, routes };
}

/** Loads every site and route from the configured (or given) source. */
export async function loadNetwork(
  source: NetworkDataSource = configuredNetworkDataSource()
): Promise<NetworkData> {
  return source === 'rayfin' ? loadRayfinNetwork() : sampleNetwork;
}
