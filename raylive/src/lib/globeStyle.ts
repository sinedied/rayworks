/**
 * Pure helpers for the globe results view: theme colour resolution, the tile-less MapLibre
 * style, and the GeoJSON features for cities, arcs and the graticule.
 *
 * Nothing here imports maplibre-gl at runtime (types only), so it stays cheap to test and the
 * map library stays in its own lazy chunk.
 */
import type {
  ExpressionSpecification,
  GeoJSONSourceSpecification,
  SkySpecification,
  StyleSpecification,
} from 'maplibre-gl';

import type { GlobeCity, GlobeTally } from './globe';
import { greatCircle } from './places/geo';
import type { LonLat, Place, WorldFeatureCollection } from './places/types';

/** Channels 0–255, alpha 0–1. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function parseChannel(token: string, scale: number): number {
  if (token === 'none') return 0;
  if (token.endsWith('%')) return (parseFloat(token) / 100) * scale;
  return parseFloat(token);
}

function parseAlpha(token: string | undefined): number {
  if (token === undefined) return 1;
  return token.endsWith('%') ? parseFloat(token) / 100 : parseFloat(token);
}

/**
 * Parses the colour formats browsers return from `getComputedStyle`: hex, `rgb()`/`rgba()`
 * (comma or space syntax) and `color(srgb …)`, which Chromium emits for `color-mix()` results.
 */
export function parseCssColor(value: string | null | undefined): Rgb | null {
  if (!value) return null;
  const input = value.trim().toLowerCase();

  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(input);
  if (hex) {
    let digits = hex[1];
    if (digits.length <= 4) digits = [...digits].map((d) => d + d).join('');
    const n = (i: number) => parseInt(digits.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: digits.length === 8 ? n(6) / 255 : 1 };
  }

  const fn = /^(rgba?|color)\((.*)\)$/.exec(input);
  if (!fn) return null;
  const [body, alphaToken] = fn[2].split('/').map((part) => part.trim());
  let tokens = body.split(/[\s,]+/).filter(Boolean);
  let alpha = alphaToken;

  let channels: number[];
  if (fn[1] === 'color') {
    if (tokens[0] !== 'srgb') return null;
    tokens = tokens.slice(1);
    channels = tokens.slice(0, 3).map((token) => parseChannel(token, 1) * 255);
  } else {
    if (tokens.length === 4 && alpha === undefined) alpha = tokens[3];
    channels = tokens.slice(0, 3).map((token) => parseChannel(token, 255));
  }

  if (channels.length !== 3 || channels.some((c) => !Number.isFinite(c))) return null;
  const a = parseAlpha(alpha);
  if (!Number.isFinite(a)) return null;
  return {
    r: clamp(channels[0], 0, 255),
    g: clamp(channels[1], 0, 255),
    b: clamp(channels[2], 0, 255),
    a: clamp(a, 0, 1),
  };
}

/** `color-mix(in srgb, a weightA, b)`, with `weightA` in 0–1. */
export function mixRgb(a: Rgb, b: Rgb, weightA: number): Rgb {
  const w = clamp(weightA, 0, 1);
  return {
    r: a.r * w + b.r * (1 - w),
    g: a.g * w + b.g * (1 - w),
    b: a.b * w + b.b * (1 - w),
    a: a.a * w + b.a * (1 - w),
  };
}

export function withAlpha(color: Rgb, a: number): Rgb {
  return { ...color, a: clamp(a, 0, 1) };
}

/** A string MapLibre's colour parser accepts. */
export function toCss(color: Rgb): string {
  const r = Math.round(color.r);
  const g = Math.round(color.g);
  const b = Math.round(color.b);
  if (color.a >= 1) return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${Math.round(color.a * 1000) / 1000})`;
}

function linear(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

export function luminance(color: Rgb): number {
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The room theme tokens a themed surface exposes as `--ia-*` custom properties. */
export interface ThemeColors {
  bg: Rgb;
  text: Rgb;
  accent: Rgb;
  surface: Rgb;
  muted: Rgb;
  border: Rgb;
  accentSoft: Rgb;
}

const FALLBACK = {
  bg: { r: 10, g: 10, b: 11, a: 1 },
  text: { r: 255, g: 255, b: 255, a: 1 },
  accent: { r: 59, g: 130, b: 246, a: 1 },
};

/** Mirrors the `[data-ia-theme]` `color-mix()` derivations in `main.css`. */
export function deriveThemeColors(bg: Rgb, text: Rgb, accent: Rgb): ThemeColors {
  return {
    bg,
    text,
    accent,
    surface: mixRgb(bg, text, 0.88),
    muted: mixRgb(text, bg, 0.6),
    border: mixRgb(text, bg, 0.18),
    accentSoft: mixRgb(accent, bg, 0.28),
  };
}

const THEME_TOKENS: [keyof ThemeColors, string][] = [
  ['bg', '--ia-bg'],
  ['text', '--ia-text'],
  ['accent', '--ia-accent'],
  ['surface', '--ia-surface'],
  ['muted', '--ia-muted'],
  ['border', '--ia-border'],
  ['accentSoft', '--ia-accent-soft'],
];

/**
 * Resolves the room theme as seen by `element`. Custom properties come back unresolved
 * (`color-mix(...)`), so each one is applied to a probe's `color` and read back computed.
 * Anything unreadable falls back to the same mix `main.css` would produce.
 */
export function readThemeColors(element: Element): ThemeColors {
  const doc = element.ownerDocument;
  const probe = doc.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;';
  element.appendChild(probe);

  const read: Partial<Record<keyof ThemeColors, Rgb>> = {};
  try {
    const view = doc.defaultView;
    const declared = view?.getComputedStyle(element);
    for (const [key, token] of THEME_TOKENS) {
      // An undeclared token would silently inherit the probe's text colour instead.
      if (!declared?.getPropertyValue(token).trim()) continue;
      probe.style.color = `var(${token})`;
      const color = parseCssColor(view?.getComputedStyle(probe).color);
      if (color && color.a > 0) read[key] = withAlpha(color, 1);
    }
  } finally {
    probe.remove();
  }

  const derived = deriveThemeColors(
    read.bg ?? FALLBACK.bg,
    read.text ?? FALLBACK.text,
    read.accent ?? FALLBACK.accent
  );
  return { ...derived, ...read };
}

export interface GlobePalette {
  dark: boolean;
  ocean: string;
  land: string;
  borders: string;
  graticule: string;
  coast: string;
  accent: string;
  glow: string;
  core: string;
  ring: string;
  arc: string;
  sky: SkySpecification;
  /** Raw colours, for the comet gradient and contrast checks. */
  raw: {
    bg: Rgb;
    ocean: Rgb;
    land: Rgb;
    accent: Rgb;
    head: Rgb;
  };
}

/** Minimum luminance contrast between land and ocean, so continents read on a washed-out projector. */
export const MIN_LAND_CONTRAST = 1.45;

/** Derives every globe colour from the room theme, adapting to light and dark themes. */
export function buildGlobePalette(theme: ThemeColors): GlobePalette {
  const dark = luminance(theme.bg) < luminance(theme.text);
  const bg = withAlpha(theme.bg, 1);
  const text = withAlpha(theme.text, 1);
  const accent = withAlpha(theme.accent, 1);

  // The sea is the background lifted toward the accent, so the sphere separates from the page.
  const ocean = dark
    ? mixRgb(mixRgb(accent, bg, 0.1), text, 0.95)
    : mixRgb(accent, bg, 0.1);

  // Land starts as a quiet tint and gets stronger until it clearly reads against the sea.
  let landShare = dark ? 0.16 : 0.1;
  let land = mixRgb(text, ocean, landShare);
  while (contrast(land, ocean) < MIN_LAND_CONTRAST && landShare < 0.7) {
    landShare += 0.02;
    land = mixRgb(text, ocean, landShare);
  }
  // A custom theme whose text is too close to its background: push land to black or white.
  if (contrast(land, ocean) < MIN_LAND_CONTRAST) {
    const extreme = luminance(ocean) > 0.18 ? { r: 0, g: 0, b: 0, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
    let share = 0;
    while (contrast(land, ocean) < MIN_LAND_CONTRAST && share < 1) {
      share += 0.05;
      land = mixRgb(extreme, ocean, share);
    }
  }
  land = mixRgb(accent, land, 0.06);

  const head = mixRgb(text, accent, dark ? 0.55 : 0.15);

  return {
    dark,
    ocean: toCss(ocean),
    land: toCss(land),
    borders: toCss(mixRgb(ocean, land, 0.55)),
    coast: toCss(withAlpha(mixRgb(text, land, 0.5), dark ? 0.35 : 0.25)),
    graticule: toCss(withAlpha(text, dark ? 0.08 : 0.07)),
    accent: toCss(accent),
    glow: toCss(withAlpha(accent, dark ? 0.5 : 0.35)),
    core: toCss(dark ? mixRgb(text, accent, 0.7) : mixRgb(bg, accent, 0.85)),
    ring: toCss(withAlpha(bg, 0.6)),
    arc: toCss(accent),
    sky: {
      'sky-color': toCss(bg),
      'horizon-color': toCss(mixRgb(accent, bg, dark ? 0.55 : 0.35)),
      'fog-color': toCss(mixRgb(accent, bg, 0.35)),
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.9,
      // MapLibre's atmosphere is not themeable; keep its rim subtle and let the CSS halo carry colour.
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, dark ? 0.55 : 0.7, 5, 0.4, 7, 0],
    },
    raw: { bg, ocean, land, accent, head },
  };
}

/** The layer ids/properties `applyPalette` re-colours when the theme changes. */
export function paletteProperties(palette: GlobePalette): [string, string, unknown][] {
  return [
    ['ocean', 'background-color', palette.ocean],
    ['graticule', 'line-color', palette.graticule],
    ['land', 'fill-color', palette.land],
    ['borders', 'line-color', palette.borders],
    ['coast', 'line-color', palette.coast],
    ['arcs', 'line-color', palette.arc],
    ['city-glow', 'circle-color', palette.glow],
    ['city', 'circle-color', palette.accent],
    ['city', 'circle-stroke-color', palette.ring],
    ['city-core', 'circle-color', palette.core],
  ];
}

type Feature<G, P> = { type: 'Feature'; id?: string | number; geometry: G; properties: P };
export type FeatureCollection<G, P> = { type: 'FeatureCollection'; features: Feature<G, P>[] };

type LineGeometry = { type: 'LineString'; coordinates: LonLat[] };
type PointGeometry = { type: 'Point'; coordinates: LonLat };

export type CityFeatures = FeatureCollection<PointGeometry, { id: string; count: number; r: number }>;
export type ArcFeatures = FeatureCollection<LineGeometry, { id: string; count: number; w: number }>;

export const EMPTY_COLLECTION = { type: 'FeatureCollection' as const, features: [] };

/** Bubble radius in px (at the base zoom), area-proportional to the count. */
export function bubbleRadius(count: number, maxCount: number, scale = 1): number {
  const min = 3.5 * scale;
  const max = 15 * scale;
  if (maxCount <= 1) return min + (max - min) * 0.25;
  return min + (max - min) * Math.sqrt(Math.max(0, count - 1) / (maxCount - 1));
}

export function cityFeatures(cities: GlobeCity[], scale = 1): CityFeatures {
  const maxCount = cities.reduce((max, city) => Math.max(max, city.count), 1);
  return {
    type: 'FeatureCollection',
    features: cities.map(({ place, count }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [place.lon, place.lat] },
      properties: { id: place.id, count, r: bubbleRadius(count, maxCount, scale) },
    })),
  };
}

/** Arcs shorter than this are drawn as a bubble on the venue only. */
const MIN_ARC_KM = 40;

/** Great-circle arcs from every city to the venue, ordered so the busiest draw on top. */
export function arcFeatures(cities: GlobeCity[], venue: Place | null): ArcFeatures {
  if (!venue) return { type: 'FeatureCollection', features: [] };
  const maxCount = cities.reduce((max, city) => Math.max(max, city.count), 1);
  const features = cities
    .filter((city) => city.place.id !== venue.id && (city.distanceKm ?? Infinity) >= MIN_ARC_KM)
    .map(({ place, count, distanceKm }) => {
      const segments = clamp(Math.round((distanceKm ?? 0) / 120), 12, 128);
      return {
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: greatCircle(place, venue, segments) },
        properties: {
          id: place.id,
          count,
          w: 1 + 2.5 * Math.sqrt((count - 1) / Math.max(1, maxCount - 1)),
        },
      };
    });
  features.sort((a, b) => a.properties.count - b.properties.count);
  return { type: 'FeatureCollection', features };
}

/** Faint meridians and parallels, densified so they curve with the sphere. */
export function graticule(step = 20, density = 4): FeatureCollection<LineGeometry, Record<string, never>> {
  const features: Feature<LineGeometry, Record<string, never>>[] = [];
  for (let lon = -180; lon < 180; lon += step) {
    const coordinates: LonLat[] = [];
    for (let lat = -80; lat <= 80; lat += density) coordinates.push([lon, lat]);
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} });
  }
  for (let lat = -80; lat <= 80; lat += step) {
    const coordinates: LonLat[] = [];
    for (let lon = -180; lon <= 180; lon += density) coordinates.push([lon, lat]);
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} });
  }
  return { type: 'FeatureCollection', features };
}

export const COMET_PERIOD_MS = 4200;
const COMET_TAIL = 0.32;
const COMET_HEAD = 0.035;

/**
 * Comet position along the arcs for an animation time. Every comet leaves its city together
 * and lands on the venue together, so the room "arrives" at once; it then rests briefly.
 * Values past 1 mean the comet has landed.
 */
export function cometProgress(timeMs: number): number {
  const phase = (timeMs % COMET_PERIOD_MS) / COMET_PERIOD_MS;
  const travel = Math.min(1, phase / 0.72);
  const eased = 1 - Math.pow(1 - travel, 2.2);
  return -COMET_HEAD + eased * (1 + COMET_TAIL + COMET_HEAD);
}

/**
 * `line-gradient` for one comet frame: a faint trail brightening into a hot head at
 * `progress`. With `progress` null it draws a static city → venue fade instead (reduced motion).
 */
export function cometGradient(progress: number | null, palette: GlobePalette): ExpressionSpecification {
  const { accent, head } = palette.raw;
  type Stop = [number, Rgb];
  let stops: Stop[];

  if (progress === null) {
    stops = [
      [0, withAlpha(accent, 0.1)],
      [0.7, withAlpha(accent, 0.55)],
      [1, withAlpha(head, 0.95)],
    ];
  } else {
    const p = progress;
    stops = [
      [p - COMET_TAIL, withAlpha(accent, 0)],
      [p - COMET_HEAD * 2, withAlpha(accent, 0.6)],
      [p, withAlpha(head, 1)],
      [p + 0.006, withAlpha(head, 0)],
    ];
  }

  const valueAt = (x: number): Rgb => {
    if (x <= stops[0][0]) return progress === null ? stops[0][1] : withAlpha(stops[0][1], 0);
    const last = stops[stops.length - 1];
    if (x >= last[0]) return progress === null ? last[1] : withAlpha(last[1], 0);
    for (let i = 1; i < stops.length; i++) {
      const [x1, c1] = stops[i];
      if (x <= x1) {
        const [x0, c0] = stops[i - 1];
        const t = (x - x0) / (x1 - x0 || 1);
        return mixRgb(c1, c0, t);
      }
    }
    return last[1];
  };

  const positions = [0, 1, ...stops.map(([x]) => x).filter((x) => x > 0 && x < 1)];
  const unique = [...new Set(positions.map((x) => Math.round(x * 10000) / 10000))].sort((a, b) => a - b);
  const expression: unknown[] = ['interpolate', ['linear'], ['line-progress']];
  for (const x of unique) expression.push(x, toCss(valueAt(x)));
  return expression as ExpressionSpecification;
}

/** Zoom factor applied on top of each bubble's base radius. */
const zoomed = (value: ExpressionSpecification | number): ExpressionSpecification => [
  'interpolate',
  ['exponential', 1.6],
  ['zoom'],
  0,
  ['*', 0.85, value],
  3,
  ['*', 1.15, value],
  6,
  ['*', 2, value],
];

type GeoJSONData = GeoJSONSourceSpecification['data'];

const POP: ExpressionSpecification = ['coalesce', ['feature-state', 'pop'], 1];

/** The complete tile-less globe style: no tile server, no glyphs, no sprites. */
export function buildGlobeStyle(world: WorldFeatureCollection, palette: GlobePalette): StyleSpecification {
  return {
    version: 8,
    projection: { type: 'globe' },
    sky: palette.sky,
    sources: {
      world: { type: 'geojson', data: world as unknown as GeoJSONData, tolerance: 0.6 },
      graticule: { type: 'geojson', data: graticule() as unknown as GeoJSONData },
      arcs: { type: 'geojson', data: EMPTY_COLLECTION, lineMetrics: true },
      cities: { type: 'geojson', data: EMPTY_COLLECTION, promoteId: 'id' },
    },
    layers: [
      { id: 'ocean', type: 'background', paint: { 'background-color': palette.ocean } },
      {
        id: 'graticule',
        type: 'line',
        source: 'graticule',
        paint: { 'line-color': palette.graticule, 'line-width': 0.8 },
      },
      {
        id: 'land',
        type: 'fill',
        source: 'world',
        paint: { 'fill-color': palette.land, 'fill-antialias': true },
      },
      {
        id: 'borders',
        type: 'line',
        source: 'world',
        paint: { 'line-color': palette.borders, 'line-width': 0.6 },
      },
      {
        id: 'coast',
        type: 'line',
        source: 'world',
        paint: { 'line-color': palette.coast, 'line-width': 0.4, 'line-blur': 0.4 },
      },
      {
        id: 'arcs',
        type: 'line',
        source: 'arcs',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': palette.arc,
          'line-width': ['*', 0.9, ['get', 'w']],
          'line-opacity': ['interpolate', ['linear'], ['get', 'w'], 1, 0.22, 3.5, 0.5],
        },
      },
      {
        id: 'comet-glow',
        type: 'line',
        source: 'arcs',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-width': ['+', 4, ['*', 2.5, ['get', 'w']]],
          'line-blur': 5,
          'line-opacity': 0.55,
          'line-gradient': cometGradient(null, palette),
        },
      },
      {
        id: 'comets',
        type: 'line',
        source: 'arcs',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-width': ['+', 1.2, ['*', 1.1, ['get', 'w']]],
          'line-blur': 0.6,
          'line-gradient': cometGradient(null, palette),
        },
      },
      {
        id: 'city-glow',
        type: 'circle',
        source: 'cities',
        paint: {
          'circle-color': palette.glow,
          'circle-radius': zoomed(['*', 2.3, ['get', 'r'], POP]),
          'circle-blur': 1,
          'circle-pitch-alignment': 'map',
        },
      },
      {
        id: 'city',
        type: 'circle',
        source: 'cities',
        paint: {
          'circle-color': palette.accent,
          'circle-opacity': 0.85,
          'circle-radius': zoomed(['*', ['get', 'r'], POP]),
          'circle-stroke-color': palette.ring,
          'circle-stroke-width': 1,
          'circle-pitch-alignment': 'map',
        },
      },
      {
        id: 'city-core',
        type: 'circle',
        source: 'cities',
        paint: {
          'circle-color': palette.core,
          'circle-radius': zoomed(['*', 0.32, ['get', 'r'], POP]),
          'circle-blur': 0.5,
          'circle-pitch-alignment': 'map',
        },
      },
    ],
  };
}

/** Pixel radius of a bubble at a zoom, matching the `zoomed` expression (for label offsets). */
export function zoomedRadius(r: number, zoom: number): number {
  const stops: [number, number][] = [
    [0, 0.85],
    [3, 1.15],
    [6, 2],
  ];
  const z = clamp(zoom, 0, 6);
  const i = z <= 3 ? 0 : 1;
  const [z0, f0] = stops[i];
  const [z1, f1] = stops[i + 1];
  const base = 1.6;
  const t = (Math.pow(base, z - z0) - 1) / (Math.pow(base, z1 - z0) - 1);
  return r * (f0 + (f1 - f0) * t);
}

export interface GlobeView {
  center: LonLat;
  /** Angular radius in degrees that should fit the view. */
  spreadDeg: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Count-weighted spherical centroid of the participants (and venue), plus how far they spread. */
export function initialView(tally: Pick<GlobeTally, 'cities' | 'venue'>): GlobeView {
  // Before anyone joins, show the whole globe (around the venue, if there is one).
  if (tally.cities.length === 0) {
    return { center: tally.venue ? [tally.venue.lon, tally.venue.lat] : [10, 25], spreadDeg: 180 };
  }
  const points: { lat: number; lon: number; weight: number }[] = tally.cities.map(({ place, count }) => ({
    lat: place.lat,
    lon: place.lon,
    weight: count,
  }));
  if (tally.venue) {
    points.push({ lat: tally.venue.lat, lon: tally.venue.lon, weight: Math.max(1, points.length) });
  }
  let x = 0;
  let y = 0;
  let z = 0;
  for (const { lat, lon, weight } of points) {
    x += Math.cos(toRad(lat)) * Math.cos(toRad(lon)) * weight;
    y += Math.cos(toRad(lat)) * Math.sin(toRad(lon)) * weight;
    z += Math.sin(toRad(lat)) * weight;
  }
  const anchor = tally.venue ?? points[0];
  const center: LonLat =
    Math.hypot(x, y, z) < 1e-9
      ? [anchor.lon, anchor.lat]
      : [toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.hypot(x, y)))];

  let spreadDeg = 0;
  for (const { lat, lon } of points) {
    const d =
      Math.sin(toRad(lat)) * Math.sin(toRad(center[1])) +
      Math.cos(toRad(lat)) * Math.cos(toRad(center[1])) * Math.cos(toRad(lon - center[0]));
    spreadDeg = Math.max(spreadDeg, toDeg(Math.acos(clamp(d, -1, 1))));
  }
  return { center, spreadDeg };
}

/**
 * Zoom at which the whole sphere is `diameterPx` across.
 * MapLibre's globe radius is `512·2^z / 2π` px, scaled by 1/cos(latitude) of the centre.
 */
export function globeFitZoom(diameterPx: number, centerLat = 0): number {
  const zoom = Math.log2((Math.max(100, diameterPx) * Math.PI * Math.cos(toRad(clamp(centerLat, -80, 80)))) / 512);
  return clamp(zoom, -1, 4);
}

/** Zoom that frames the participants: the full globe when they span it, closer when clustered. */
export function viewZoom(view: GlobeView, diameterPx: number): number {
  const fit = globeFitZoom(diameterPx, view.center[1]);
  if (view.spreadDeg >= 55) return fit;
  const closer = Math.log2(55 / Math.max(view.spreadDeg, 12));
  return clamp(fit + closer, fit, fit + 1.5);
}

/** Regional-indicator flag emoji for an ISO-2 code (empty for anything else). */
export function flagEmoji(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Distances read as round figures on a projector: "18,100 km", "412,000 km", "35 km". */
export function formatKm(km: number): string {
  const value = Math.max(0, km);
  let rounded: number;
  if (value < 100) rounded = Math.round(value);
  else if (value < 1000) rounded = Math.round(value / 10) * 10;
  else {
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)) - 2);
    rounded = Math.round(value / magnitude) * magnitude;
  }
  return `${new Intl.NumberFormat('en').format(rounded)} km`;
}
