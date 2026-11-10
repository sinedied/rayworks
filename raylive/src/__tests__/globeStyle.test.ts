import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GlobeCity } from '@/lib/globe';
import {
  MIN_LAND_CONTRAST,
  arcFeatures,
  bubbleRadius,
  buildGlobePalette,
  buildGlobeStyle,
  cityFeatures,
  cometGradient,
  cometProgress,
  contrast,
  deriveThemeColors,
  flagEmoji,
  formatKm,
  globeFitZoom,
  graticule,
  initialView,
  paletteProperties,
  parseCssColor,
  readThemeColors,
  viewZoom,
  type GlobePalette,
  type Rgb,
} from '@/lib/globeStyle';
import type { Place } from '@/lib/places';
import { THEME_PRESETS } from '@/lib/theme';

const place = (id: string, name: string, countryCode: string, lat: number, lon: number): Place => ({
  id,
  name,
  countryCode,
  lat,
  lon,
  population: 1000,
});

const hamburg = place('1', 'Hamburg', 'DE', 53.55, 10);
const auckland = place('2', 'Auckland', 'NZ', -36.85, 174.76);
const paris = place('3', 'Paris', 'FR', 48.86, 2.35);
const city = (p: Place, count: number, distanceKm: number | null = null): GlobeCity => ({ place: p, count, distanceKm });

const hex = (value: string): Rgb => parseCssColor(value)!;
const paletteFor = (theme: { background: string; text: string; accent: string }) =>
  buildGlobePalette(deriveThemeColors(hex(theme.background), hex(theme.text), hex(theme.accent)));

describe('parseCssColor', () => {
  it('reads every format getComputedStyle produces', () => {
    expect(parseCssColor('#0a0a0b')).toEqual({ r: 10, g: 10, b: 11, a: 1 });
    expect(parseCssColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseCssColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseCssColor('rgba(1, 2, 3, 0.5)')).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
    expect(parseCssColor('rgb(1 2 3 / 50%)')).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
    // Chromium serialises color-mix() results this way.
    const mixed = parseCssColor('color(srgb 0.2 0.4 1)')!;
    expect(mixed.r).toBeCloseTo(51);
    expect(mixed.g).toBeCloseTo(102);
    expect(mixed.b).toBeCloseTo(255);
  });

  it('rejects anything it cannot convert', () => {
    expect(parseCssColor('')).toBeNull();
    expect(parseCssColor('color-mix(in srgb, red 50%, blue)')).toBeNull();
    expect(parseCssColor('color(display-p3 1 0 0)')).toBeNull();
    expect(parseCssColor('blue')).toBeNull();
  });
});

describe('buildGlobePalette', () => {
  const colourStrings = (palette: GlobePalette) =>
    paletteProperties(palette)
      .map(([, , value]) => value as string)
      .concat([palette.sky['sky-color'] as string, palette.sky['horizon-color'] as string]);

  it.each(THEME_PRESETS.map((preset) => [preset.name, preset.theme] as const))(
    '%s yields valid colours with land that reads against the sea',
    (_name, theme) => {
      const palette = paletteFor(theme);
      for (const value of colourStrings(palette)) {
        expect(value).toMatch(/^rgba?\(/);
        expect(parseCssColor(value)).not.toBeNull();
      }
      expect(contrast(palette.raw.land, palette.raw.ocean)).toBeGreaterThanOrEqual(MIN_LAND_CONTRAST);
      expect(contrast(palette.raw.accent, palette.raw.land)).toBeGreaterThan(1.3);
    }
  );

  it('keeps contrast for the unthemed console defaults and a low-contrast custom theme', () => {
    for (const theme of [
      { background: '#ffffff', text: '#1f2937', accent: '#2f80ff' },
      { background: '#777777', text: '#888888', accent: '#999999' },
    ]) {
      const palette = paletteFor(theme);
      expect(contrast(palette.raw.land, palette.raw.ocean)).toBeGreaterThanOrEqual(MIN_LAND_CONTRAST);
    }
  });

  it('detects light and dark themes', () => {
    expect(paletteFor(THEME_PRESETS[0].theme).dark).toBe(true);
    expect(paletteFor(THEME_PRESETS[1].theme).dark).toBe(false);
  });
});

describe('readThemeColors', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves color-mix() tokens through a probe element', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const computed: Record<string, string> = {
      '--ia-bg': '#0a0a0b',
      '--ia-text': '#ffffff',
      '--ia-accent': '#3b82f6',
      '--ia-surface': 'color-mix(in srgb, var(--ia-bg) 88%, var(--ia-text))',
    };
    const browserColors: Record<string, string> = {
      'var(--ia-bg)': 'rgb(10, 10, 11)',
      'var(--ia-text)': 'rgb(255, 255, 255)',
      'var(--ia-accent)': 'rgb(59, 130, 246)',
      'var(--ia-surface)': 'color(srgb 0.1 0.1 0.1)',
    };
    vi.spyOn(window, 'getComputedStyle').mockImplementation((target) => {
      const el = target as HTMLElement;
      return {
        getPropertyValue: (name: string) => computed[name] ?? '',
        color: browserColors[el.style.color] ?? '',
      } as unknown as CSSStyleDeclaration;
    });

    const colors = readThemeColors(element);
    expect(colors.bg).toEqual({ r: 10, g: 10, b: 11, a: 1 });
    expect(colors.accent).toEqual({ r: 59, g: 130, b: 246, a: 1 });
    expect(colors.surface.r).toBeCloseTo(25.5);
    // Undeclared tokens fall back to the main.css mix rather than inheriting the text colour.
    expect(colors.muted).toEqual(deriveThemeColors(colors.bg, colors.text, colors.accent).muted);
    expect(element.childElementCount).toBe(0);
  });

  it('falls back to the default theme when nothing resolves', () => {
    const colors = readThemeColors(document.createElement('div'));
    expect(colors.bg).toEqual({ r: 10, g: 10, b: 11, a: 1 });
  });
});

describe('features', () => {
  it('sizes bubbles by area, growing with the count', () => {
    expect(bubbleRadius(1, 10)).toBeLessThan(bubbleRadius(4, 10));
    expect(bubbleRadius(10, 10)).toBeCloseTo(15);
    const features = cityFeatures([city(hamburg, 9), city(paris, 1)]);
    expect(features.features.map((f) => f.properties.id)).toEqual(['1', '3']);
    expect(features.features[0].geometry.coordinates).toEqual([10, 53.55]);
  });

  it('draws arcs from each city to the venue only when there is one', () => {
    const cities = [city(paris, 1, 745), city(auckland, 3, 18_000), city(hamburg, 5, 0)];
    expect(arcFeatures(cities, null).features).toEqual([]);

    const arcs = arcFeatures(cities, hamburg).features;
    expect(arcs.map((f) => f.properties.id)).toEqual(['3', '2']);
    const line = arcs[1].geometry.coordinates;
    expect(line[0]).toEqual([auckland.lon, auckland.lat]);
    const end = line[line.length - 1];
    expect(end[1]).toBeCloseTo(hamburg.lat);
    expect(((end[0] - hamburg.lon) % 360 + 360) % 360).toBeCloseTo(0);
    expect(arcs[1].properties.w).toBeGreaterThan(arcs[0].properties.w);
  });

  it('builds a graticule of densified lines', () => {
    const lines = graticule(30, 10).features;
    expect(lines.length).toBe(12 + 6);
    expect(lines[0].geometry.coordinates.length).toBeGreaterThan(10);
  });
});

describe('cometGradient', () => {
  const positions = (expression: unknown[]) => expression.slice(3).filter((_, i) => i % 2 === 0) as number[];

  it.each([null, -0.05, 0, 0.2, 0.5, 0.99, 1, 1.2, 1.35])('is a valid ascending line-gradient at %s', (progress) => {
    const expression = cometGradient(progress, paletteFor(THEME_PRESETS[0].theme)) as unknown[];
    expect(expression.slice(0, 3)).toEqual(['interpolate', ['linear'], ['line-progress']]);
    const stops = positions(expression);
    expect(stops[0]).toBe(0);
    expect(stops[stops.length - 1]).toBe(1);
    for (let i = 1; i < stops.length; i++) expect(stops[i]).toBeGreaterThan(stops[i - 1]);
    for (let i = 4; i < expression.length; i += 2) expect(parseCssColor(expression[i] as string)).not.toBeNull();
  });

  it('travels from city to venue and lands every cycle', () => {
    expect(cometProgress(0)).toBeLessThan(0);
    expect(cometProgress(1500)).toBeGreaterThan(0.3);
    expect(cometProgress(3500)).toBeGreaterThan(1);
  });
});

describe('camera', () => {
  it('shows the whole globe before anyone joins, centred on the venue', () => {
    expect(initialView({ cities: [], venue: hamburg })).toEqual({ center: [10, 53.55], spreadDeg: 180 });
  });

  it('centres on a cluster and zooms closer than the whole globe', () => {
    const view = initialView({ cities: [city(paris, 2), city(hamburg, 2)], venue: null });
    expect(view.center[0]).toBeGreaterThan(2);
    expect(view.center[0]).toBeLessThan(10);
    expect(view.spreadDeg).toBeLessThan(10);
    expect(viewZoom(view, 500)).toBeGreaterThan(globeFitZoom(500, view.center[1]));
  });

  it('keeps the whole globe for a worldwide audience', () => {
    const view = initialView({ cities: [city(paris, 1), city(auckland, 1)], venue: hamburg });
    expect(view.spreadDeg).toBeGreaterThan(90);
    expect(viewZoom(view, 500)).toBe(globeFitZoom(500, view.center[1]));
    expect(globeFitZoom(1000)).toBeGreaterThan(globeFitZoom(500));
  });
});

describe('buildGlobeStyle', () => {
  it('is a tile-less globe style', () => {
    const style = buildGlobeStyle({ type: 'FeatureCollection', features: [] }, paletteFor(THEME_PRESETS[2].theme));
    expect(style.projection).toEqual({ type: 'globe' });
    expect(style.glyphs).toBeUndefined();
    expect(style.sprite).toBeUndefined();
    expect(Object.values(style.sources).every((source) => source.type === 'geojson')).toBe(true);
    expect(style.sources.arcs).toMatchObject({ lineMetrics: true });
    expect(style.layers.some((layer) => layer.type === 'symbol')).toBe(false);
  });
});

describe('formatting', () => {
  it('formats distances as round figures', () => {
    expect(formatKm(35.4)).toBe('35 km');
    expect(formatKm(745)).toBe('750 km');
    expect(formatKm(18_123)).toBe('18,100 km');
    expect(formatKm(411_789)).toBe('412,000 km');
  });

  it('turns country codes into flags', () => {
    expect(flagEmoji('de')).toBe('🇩🇪');
    expect(flagEmoji('XYZ')).toBe('');
  });
});
