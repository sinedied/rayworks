import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import {
  ATLAS_DEFAULT_DEM_URL,
  ATLAS_DEFAULT_GLYPHS_URL,
  ATLAS_DEFAULT_TILES_URL,
  ATLAS_DEM_SOURCE_ID,
  ATLAS_FIRST_LABEL_LAYER_ID,
  ATLAS_GRATICULE_SOURCE_ID,
  ATLAS_TERRAIN_SOURCE_ID,
  ATLAS_VECTOR_SOURCE_ID,
  applyAtlasTerrain,
  atlasMapPalette,
  atlasMapPaletteDay,
  createAtlasStyle,
  resolveAtlasStyle,
} from './atlas-style';

const layerIds = (style: StyleSpecification) => style.layers.map((layer) => layer.id);
const layer = (style: StyleSpecification, id: string) =>
  style.layers.find((candidate) => candidate.id === id) as LayerSpecification;

describe('createAtlasStyle', () => {
  it.each(['night', 'day'] as const)('produces a valid %s style', (variant) => {
    const style = createAtlasStyle({ variant });
    expect(validateStyleMin(style)).toEqual([]);
  });

  it('is valid with every optional feature disabled', () => {
    const style = createAtlasStyle({ demUrl: null, buildings: false, graticule: false, projection: 'mercator' });
    expect(validateStyleMin(style)).toEqual([]);
  });

  it('uses OpenFreeMap tiles, glyphs, and AWS terrain by default', () => {
    const style = createAtlasStyle();
    expect(style.glyphs).toBe(ATLAS_DEFAULT_GLYPHS_URL);
    expect(style.sources[ATLAS_VECTOR_SOURCE_ID]).toMatchObject({ type: 'vector', url: ATLAS_DEFAULT_TILES_URL });
    for (const id of [ATLAS_DEM_SOURCE_ID, ATLAS_TERRAIN_SOURCE_ID]) {
      expect(style.sources[id]).toMatchObject({
        type: 'raster-dem',
        tiles: [ATLAS_DEFAULT_DEM_URL],
        encoding: 'terrarium',
        maxzoom: 15,
      });
    }
  });

  it('carries attribution on every remote source', () => {
    const style = createAtlasStyle();
    expect(style.sources[ATLAS_VECTOR_SOURCE_ID]).toMatchObject({
      attribution: expect.stringMatching(/OpenFreeMap.*OpenMapTiles.*OpenStreetMap contributors/),
    });
    expect(style.sources[ATLAS_DEM_SOURCE_ID]).toMatchObject({ attribution: expect.stringContaining('Mapzen') });
  });

  it('includes the core layer stack in drawing order', () => {
    const ids = layerIds(createAtlasStyle());
    const ordered = [
      'atlas-background',
      'atlas-water',
      'atlas-seafloor-relief',
      'atlas-hillshade',
      'atlas-graticule',
      'atlas-coastline',
      'atlas-road-motorway',
      'atlas-boundary-country',
      'atlas-building-3d',
      ATLAS_FIRST_LABEL_LAYER_ID,
      'atlas-label-city',
      'atlas-label-country',
    ];
    const positions = ordered.map((id) => ids.indexOf(id));
    expect(positions).not.toContain(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every symbol layer after the story insertion point', () => {
    const style = createAtlasStyle();
    const firstLabel = layerIds(style).indexOf(ATLAS_FIRST_LABEL_LAYER_ID);
    style.layers.forEach((candidate, index) => {
      if (candidate.type === 'symbol') expect(index).toBeGreaterThanOrEqual(firstLabel);
    });
  });

  it('renders as a globe with an atmosphere that fades out at street zoom', () => {
    const style = createAtlasStyle();
    expect(style.projection).toEqual({ type: 'globe' });
    expect(style.sky?.['atmosphere-blend']).toEqual(['interpolate', ['linear'], ['zoom'], 0, 0.95, 4, 0.7, 7, 0]);
    expect(style).not.toHaveProperty('terrain');
  });

  it('extrudes buildings from zoom 14 unless disabled', () => {
    expect(layer(createAtlasStyle(), 'atlas-building-3d')).toMatchObject({ type: 'fill-extrusion', minzoom: 14 });
    expect(layerIds(createAtlasStyle({ buildings: false })).some((id) => id.startsWith('atlas-building'))).toBe(false);
  });

  it.each([null, '', 'none', ' NONE '])('drops DEM sources and layers when demUrl is %j', (demUrl) => {
    const style = createAtlasStyle({ demUrl });
    expect(style.sources).not.toHaveProperty(ATLAS_DEM_SOURCE_ID);
    expect(style.sources).not.toHaveProperty(ATLAS_TERRAIN_SOURCE_ID);
    expect(style.layers.some((candidate) => candidate.type === 'hillshade' || candidate.type === 'color-relief')).toBe(
      false,
    );
    expect(validateStyleMin(style)).toEqual([]);
  });

  it('accepts tile templates and TileJSON overrides', () => {
    const style = createAtlasStyle({
      tilesUrl: 'https://tiles.example.com/{z}/{x}/{y}.pbf',
      glyphsUrl: 'https://fonts.example.com/{fontstack}/{range}.pbf',
      demUrl: 'https://dem.example.com/tiles.json',
      demEncoding: 'mapbox',
    });
    expect(style.glyphs).toBe('https://fonts.example.com/{fontstack}/{range}.pbf');
    expect(style.sources[ATLAS_VECTOR_SOURCE_ID]).toMatchObject({
      tiles: ['https://tiles.example.com/{z}/{x}/{y}.pbf'],
      maxzoom: 14,
    });
    expect(style.sources[ATLAS_DEM_SOURCE_ID]).toEqual(
      expect.objectContaining({ url: 'https://dem.example.com/tiles.json', encoding: 'mapbox' }),
    );
    expect(validateStyleMin(style)).toEqual([]);
  });

  it('omits the graticule when disabled', () => {
    const style = createAtlasStyle({ graticule: false });
    expect(style.sources).not.toHaveProperty(ATLAS_GRATICULE_SOURCE_ID);
    expect(layerIds(style).some((id) => id.includes('graticule'))).toBe(false);
  });

  it('never paints the basemap with the reserved story yellow', () => {
    for (const [variant, palette] of [
      ['night', atlasMapPalette],
      ['day', atlasMapPaletteDay],
    ] as const) {
      const serialized = JSON.stringify(createAtlasStyle({ variant }).layers).toUpperCase();
      expect(serialized).not.toContain(palette.highlight.toUpperCase());
    }
  });
});

describe('resolveAtlasStyle', () => {
  it('returns the full override URL unchanged', () => {
    expect(resolveAtlasStyle({ VITE_ATLAS_MAP_STYLE_URL: ' https://example.com/style.json ' })).toBe(
      'https://example.com/style.json',
    );
  });

  it('generates the Atlas style when no override is set', () => {
    const style = resolveAtlasStyle({ VITE_ATLAS_MAP_STYLE_URL: '' });
    expect(typeof style).toBe('object');
    expect((style as StyleSpecification).sources).toHaveProperty(ATLAS_DEM_SOURCE_ID);
  });

  it('maps environment variables to style options', () => {
    const style = resolveAtlasStyle({
      VITE_ATLAS_TILES_URL: 'https://tiles.example.com/planet',
      VITE_ATLAS_GLYPHS_URL: 'https://fonts.example.com/{fontstack}/{range}.pbf',
      VITE_ATLAS_DEM_URL: 'none',
      VITE_ATLAS_BUILDINGS: 'false',
      VITE_ATLAS_MAP_VARIANT: 'light',
    }) as StyleSpecification;
    expect(style.sources[ATLAS_VECTOR_SOURCE_ID]).toMatchObject({ url: 'https://tiles.example.com/planet' });
    expect(style.glyphs).toBe('https://fonts.example.com/{fontstack}/{range}.pbf');
    expect(style.sources).not.toHaveProperty(ATLAS_DEM_SOURCE_ID);
    expect(layerIds(style)).not.toContain('atlas-building-3d');
    expect(style.name).toBe('Ray|Atlas Day');
  });

  it('treats an empty DEM variable as disabled', () => {
    const style = resolveAtlasStyle({ VITE_ATLAS_DEM_URL: '' }) as StyleSpecification;
    expect(style.sources).not.toHaveProperty(ATLAS_TERRAIN_SOURCE_ID);
  });
});

describe('applyAtlasTerrain', () => {
  const mapWith = (hasTerrainSource: boolean) => ({
    getSource: vi.fn((id: string) => (hasTerrainSource && id === ATLAS_TERRAIN_SOURCE_ID ? {} : undefined)),
    setTerrain: vi.fn(),
  });

  it('enables terrain on the dedicated source', () => {
    const map = mapWith(true);
    expect(applyAtlasTerrain(map, true, 2)).toBe(true);
    expect(map.setTerrain).toHaveBeenCalledWith({ source: ATLAS_TERRAIN_SOURCE_ID, exaggeration: 2 });
  });

  it('disables terrain on request or when the style has no DEM', () => {
    const map = mapWith(true);
    expect(applyAtlasTerrain(map, false)).toBe(false);
    expect(map.setTerrain).toHaveBeenLastCalledWith(null);

    const flat = mapWith(false);
    expect(applyAtlasTerrain(flat, true)).toBe(false);
    expect(flat.setTerrain).toHaveBeenLastCalledWith(null);
  });
});
