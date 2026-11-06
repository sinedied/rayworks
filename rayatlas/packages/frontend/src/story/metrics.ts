import type { NetworkData, RouteRecord, SiteRecord } from '@rayfin-app/shared';

import type { MetricFormat, StoryFocus, StoryMetric } from './types';

/**
 * Sites matching a focus: code listed in `siteCodes` OR role listed in `siteRoles`.
 * An empty focus selects nothing.
 */
export function selectSites(network: NetworkData, focus: StoryFocus): SiteRecord[] {
  const codes = new Set(focus.siteCodes ?? []);
  const roles = new Set(focus.siteRoles ?? []);
  if (!codes.size && !roles.size) return [];
  return network.sites.filter((site) => codes.has(site.code) || roles.has(site.role));
}

/**
 * Routes matching a focus: code listed in `routeCodes` OR mode listed in `routeModes` OR code
 * starting with one of `routeCodePrefixes`. An empty focus selects nothing.
 */
export function selectRoutes(network: NetworkData, focus: StoryFocus): RouteRecord[] {
  const codes = new Set(focus.routeCodes ?? []);
  const modes = new Set(focus.routeModes ?? []);
  const prefixes = (focus.routeCodePrefixes ?? []).filter(Boolean);
  if (!codes.size && !modes.size && !prefixes.length) return [];
  return network.routes.filter((route) => (
    codes.has(route.code)
    || modes.has(route.mode)
    || prefixes.some((prefix) => route.code.startsWith(prefix))
  ));
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Evaluate a metric against the network. Returns `null` when the network has no records of the
 * metric's entity, or when no selected record has a numeric value for an aggregated field.
 * Aggregates skip records whose field is missing.
 */
export function evaluateMetric(metric: StoryMetric, network: NetworkData): number | null {
  const { source } = metric;
  if (source.kind === 'count') {
    if (source.entity === 'site') {
      return network.sites.length ? selectSites(network, source.filter).length : null;
    }
    return network.routes.length ? selectRoutes(network, source.filter).length : null;
  }

  const values = source.entity === 'site'
    ? selectSites(network, source.filter).map((site) => site[source.field])
    : selectRoutes(network, source.filter).map((route) => route[source.field]);
  const numbers = values.filter(isNumber);
  if (!numbers.length) return null;

  switch (source.kind) {
    case 'sum': return numbers.reduce((total, value) => total + value, 0);
    case 'max': return Math.max(...numbers);
    case 'min': return Math.min(...numbers);
    case 'avg': return numbers.reduce((total, value) => total + value, 0) / numbers.length;
  }
}

/** Tonnage at or above this value is shown in compact notation, e.g. `18.4k t`. */
const COMPACT_TONNES_THRESHOLD = 10_000;

/** Format a metric value for display; `null` renders as an em dash. */
export function formatMetric(value: number | null, format: MetricFormat, locale = 'en-US'): string {
  if (value === null || !Number.isFinite(value)) return '—';
  switch (format) {
    case 'tonnes': {
      if (Math.abs(value) >= COMPACT_TONNES_THRESHOLD) {
        const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
          .format(value)
          // SI-style thousands prefix reads better next to the unit than the uppercase "K".
          .replace(/K$/, 'k');
        return `${compact} t`;
      }
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} t`;
    }
    case 'days': {
      const days = Math.round(value * 10) / 10;
      const text = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(days);
      return `${text} ${days === 1 ? 'day' : 'days'}`;
    }
    case 'meters':
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} m`;
    case 'count':
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
    case 'number':
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  }
}
