/**
 * Ray|Atlas basemap: a programmatic MapLibre style over OpenFreeMap vector tiles.
 *
 * The primary "night" variant sets desaturated slate land on a deep navy ocean with seafloor relief,
 * soft hillshade, and restrained labels, so the Atlas yellow story layers stay the brightest thing
 * on the map. A lighter "day" variant shares the same layer stack and differs only by palette.
 *
 * Terrain is deliberately not part of the base style. 3D terrain on a globe costs extra DEM
 * fetches and GPU time on every frame, so the style only declares a dedicated `atlas-terrain`
 * source and story chapters opt in with `applyAtlasTerrain(map, true)` when they pitch into the
 * mountains. Hillshade and seafloor relief use a separate DEM source, as MapLibre recommends.
 *
 * MapLibre leaves the space around the globe transparent: give the map container
 * `atlasMapPalette.space` as its background.
 */
import type {
  ExpressionSpecification,
  LayerSpecification,
  RasterDEMSourceSpecification,
  SourceSpecification,
  StyleSpecification,
  TerrainSpecification,
  VectorSourceSpecification,
} from 'maplibre-gl';

export const ATLAS_DEFAULT_TILES_URL = 'https://tiles.openfreemap.org/planet';
export const ATLAS_DEFAULT_GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const ATLAS_DEFAULT_DEM_URL =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

export const ATLAS_VECTOR_SOURCE_ID = 'openmaptiles';
export const ATLAS_DEM_SOURCE_ID = 'atlas-dem';
export const ATLAS_TERRAIN_SOURCE_ID = 'atlas-terrain';
export const ATLAS_GRATICULE_SOURCE_ID = 'atlas-graticule';

/** Insert story layers (routes, markers, highlights) before this layer so place names stay readable. */
export const ATLAS_FIRST_LABEL_LAYER_ID = 'atlas-label-waterway';

export const ATLAS_DEFAULT_TERRAIN_EXAGGERATION = 1.35;

const OPENFREEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>';
const OPENMAPTILES_ATTRIBUTION =
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">&copy; OpenMapTiles</a>';
const OSM_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">&copy; OpenStreetMap contributors</a>';
const TERRAIN_ATTRIBUTION =
  'Terrain: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Mapzen Terrain Tiles</a> via AWS Open Data (USGS SRTM &amp; GMTED2010, NOAA ETOPO1, Copernicus EU-DEM and others)';

/** HTML attribution carried by the style sources (shown by MapLibre's AttributionControl) plus a plain-text summary. */
export const atlasStyleAttribution = {
  vector: `${OPENFREEMAP_ATTRIBUTION} ${OPENMAPTILES_ATTRIBUTION} ${OSM_ATTRIBUTION}`,
  terrain: TERRAIN_ATTRIBUTION,
  text: 'OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors · Terrain: Mapzen Terrain Tiles via AWS Open Data (USGS, NOAA, Copernicus and others)',
} as const;

export type AtlasStyleVariant = 'night' | 'day';
export type AtlasDemEncoding = 'terrarium' | 'mapbox';
export type AtlasRouteMode = 'sea' | 'rail' | 'road' | 'air';
export type AtlasSiteRole = 'origin' | 'port' | 'plant' | 'distribution' | 'customer';

export interface AtlasMapPalette {
  /** Page/container colour around the globe; MapLibre leaves space transparent. */
  space: string;
  ocean: string;
  /** Water at street zoom, where large flat areas of `ocean` read too saturated. */
  oceanCity: string;
  lake: string;
  river: string;
  coastline: string;
  land: string;
  landUrban: string;
  landWood: string;
  landSand: string;
  landIce: string;
  hillshadeShadow: string;
  hillshadeHighlight: string;
  hillshadeAccent: string;
  /** Overlay colours for the continental shelf, deep water, and high ground (`color-relief`). */
  seafloorShelf: string;
  seafloorDeep: string;
  seafloorAbyss: string;
  highland: string;
  /** Faint 15° graticule and the emphasised Equator/Tropics (the coffee belt). */
  graticule: string;
  graticuleEmphasis: string;
  labelGraticule: string;
  boundaryCountry: string;
  boundaryState: string;
  roadMajor: string;
  roadMedium: string;
  roadMinor: string;
  rail: string;
  ferry: string;
  runway: string;
  buildingLow: string;
  buildingHigh: string;
  buildingLight: string;
  labelCountry: string;
  labelCityMajor: string;
  labelCity: string;
  labelTown: string;
  labelVillage: string;
  labelDistrict: string;
  labelWater: string;
  labelRoad: string;
  labelPeak: string;
  labelHalo: string;
  labelWaterHalo: string;
  sky: string;
  horizon: string;
  fog: string;
  /** Atlas yellow. Reserved for story emphasis; the basemap never uses it. */
  highlight: string;
  highlightSoft: string;
  highlightHalo: string;
  route: Record<AtlasRouteMode, string>;
  marker: Record<AtlasSiteRole, string>;
  markerStroke: string;
}

export const atlasMapPalette: AtlasMapPalette = {
  space: '#030814',
  ocean: '#0A1C3E',
  oceanCity: '#0B1A33',
  lake: '#0C2247',
  river: '#14315E',
  coastline: '#4E6E9C',
  land: '#1F2B3D',
  landUrban: '#253246',
  landWood: '#1A2636',
  landSand: '#242833',
  landIce: '#2B394D',
  hillshadeShadow: 'rgba(2, 6, 16, 0.62)',
  hillshadeHighlight: 'rgba(168, 190, 226, 0.26)',
  hillshadeAccent: 'rgba(2, 6, 16, 0.25)',
  seafloorShelf: 'rgba(40, 78, 140, 0.32)',
  seafloorDeep: 'rgba(4, 10, 26, 0.30)',
  seafloorAbyss: 'rgba(2, 6, 18, 0.55)',
  highland: 'rgba(176, 194, 222, 0.10)',
  graticule: 'rgba(120, 152, 204, 0.16)',
  graticuleEmphasis: 'rgba(150, 178, 222, 0.42)',
  labelGraticule: '#6F8DB9',
  boundaryCountry: '#62789B',
  boundaryState: '#34465E',
  roadMajor: '#3E5170',
  roadMedium: '#34455F',
  roadMinor: '#2E3B50',
  rail: '#3B4B63',
  ferry: '#2A4A78',
  runway: '#2C3B52',
  buildingLow: '#2A3242',
  buildingHigh: '#4A5466',
  buildingLight: '#F3F1EC',
  labelCountry: '#9DAFC8',
  labelCityMajor: '#EEF2F8',
  labelCity: '#CCD6E5',
  labelTown: '#A0AFC4',
  labelVillage: '#8494AB',
  labelDistrict: '#7E8EA6',
  labelWater: '#5F86BD',
  labelRoad: '#8191A8',
  labelPeak: '#8C9CB3',
  labelHalo: 'rgba(10, 18, 34, 0.9)',
  labelWaterHalo: 'rgba(8, 22, 50, 0.85)',
  sky: '#06122C',
  horizon: '#1F3D74',
  fog: '#101C30',
  highlight: '#FFC629',
  highlightSoft: 'rgba(255, 198, 41, 0.28)',
  highlightHalo: 'rgba(255, 198, 41, 0.12)',
  route: {
    sea: '#FFC629',
    rail: '#4FD8C4',
    road: '#FF9F5A',
    air: '#AFC0FF',
  },
  marker: {
    origin: '#A6D98A',
    port: '#6CB8FF',
    plant: '#FFC629',
    distribution: '#FF9F5A',
    customer: '#F2A9C9',
  },
  markerStroke: '#0A1426',
};

export const atlasMapPaletteDay: AtlasMapPalette = {
  space: '#E7EDF5',
  ocean: '#B9CBE3',
  oceanCity: '#BDCDE2',
  lake: '#C2D3E8',
  river: '#A9BFDD',
  coastline: '#8EA8CC',
  land: '#F1F3F6',
  landUrban: '#E8EBF0',
  landWood: '#E9EDEF',
  landSand: '#F3F0EA',
  landIce: '#FBFCFD',
  hillshadeShadow: 'rgba(28, 44, 72, 0.22)',
  hillshadeHighlight: 'rgba(255, 255, 255, 0.35)',
  hillshadeAccent: 'rgba(28, 44, 72, 0.08)',
  seafloorShelf: 'rgba(214, 228, 245, 0.45)',
  seafloorDeep: 'rgba(60, 96, 150, 0.10)',
  seafloorAbyss: 'rgba(40, 72, 128, 0.22)',
  highland: 'rgba(120, 132, 150, 0.08)',
  graticule: 'rgba(61, 102, 153, 0.16)',
  graticuleEmphasis: 'rgba(61, 102, 153, 0.42)',
  labelGraticule: '#3D6699',
  boundaryCountry: '#8B9BB3',
  boundaryState: '#C3CCD9',
  roadMajor: '#FFFFFF',
  roadMedium: '#FFFFFF',
  roadMinor: '#FAFBFC',
  rail: '#C4CCD8',
  ferry: '#94AED2',
  runway: '#DDE2EA',
  buildingLow: '#DCE1E9',
  buildingHigh: '#C7D0DD',
  buildingLight: '#FFFFFF',
  labelCountry: '#4B5D7A',
  labelCityMajor: '#0B2A5B',
  labelCity: '#1F2937',
  labelTown: '#3B4A61',
  labelVillage: '#566477',
  labelDistrict: '#5E6B7E',
  labelWater: '#3D6699',
  labelRoad: '#5E6B7E',
  labelPeak: '#5E6B7E',
  labelHalo: 'rgba(255, 255, 255, 0.92)',
  labelWaterHalo: 'rgba(205, 220, 240, 0.85)',
  sky: '#BFD3EE',
  horizon: '#F4F7FB',
  fog: '#EEF2F7',
  highlight: '#FFC629',
  highlightSoft: 'rgba(154, 103, 0, 0.22)',
  highlightHalo: 'rgba(154, 103, 0, 0.10)',
  route: {
    sea: '#9A6700',
    rail: '#00806F',
    road: '#C2410C',
    air: '#4F46E5',
  },
  marker: {
    origin: '#3F7D2A',
    port: '#246BDB',
    plant: '#9A6700',
    distribution: '#C2410C',
    customer: '#B83280',
  },
  markerStroke: '#FFFFFF',
};

export interface AtlasStyleOptions {
  variant?: AtlasStyleVariant;
  /** TileJSON URL or `{z}/{x}/{y}` template for OpenMapTiles-schema vector tiles. */
  tilesUrl?: string;
  glyphsUrl?: string;
  /**
   * TileJSON URL or `{z}/{x}/{y}` template for a raster DEM. `null`, `''`, or `'none'` disables
   * hillshade, seafloor relief, and the terrain source.
   */
  demUrl?: string | null;
  demEncoding?: AtlasDemEncoding;
  /** 3D building extrusions from zoom 14. Defaults to true. */
  buildings?: boolean;
  /** Faint graticule with the Equator and Tropics marking the coffee belt at low zoom. Defaults to true. */
  graticule?: boolean;
  /** Defaults to `globe`, which MapLibre blends into Mercator at high zoom. */
  projection?: 'globe' | 'mercator';
}

/** The subset of `import.meta.env` read by `resolveAtlasStyle`. */
export interface AtlasStyleEnv {
  VITE_ATLAS_MAP_STYLE_URL?: string;
  VITE_ATLAS_TILES_URL?: string;
  VITE_ATLAS_GLYPHS_URL?: string;
  VITE_ATLAS_DEM_URL?: string;
  VITE_ATLAS_DEM_ENCODING?: string;
  VITE_ATLAS_BUILDINGS?: string;
  VITE_ATLAS_MAP_VARIANT?: string;
}

export function getAtlasPalette(variant: AtlasStyleVariant = 'night'): AtlasMapPalette {
  return variant === 'day' ? atlasMapPaletteDay : atlasMapPalette;
}

const FONT_REGULAR = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];
const FONT_ITALIC = ['Noto Sans Italic'];
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const NAME: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']];
const RANK: ExpressionSpecification = ['coalesce', ['get', 'rank'], 99];
// Low-zoom tiles bucket every small country into the same rank, so microstates are named explicitly.
const NOT_MICROSTATE: ExpressionSpecification = [
  '!',
  ['in', ['get', 'iso_a2'], ['literal', ['AD', 'GI', 'LI', 'MC', 'MT', 'SM', 'VA', 'LU', 'SG', 'BH', 'XK']]],
];

const isTemplateUrl = (url: string) => url.includes('{z}');

const isDisabled = (value: string | null | undefined): value is null | undefined =>
  value === null ||
  value === undefined ||
  ['', 'none', 'off', 'false'].includes(value.trim().toLowerCase());

const zoomRamp = (...stops: number[]): ExpressionSpecification =>
  ['interpolate', ['linear'], ['zoom'], ...stops] as ExpressionSpecification;

const zoomRampExp = (base: number, ...stops: number[]): ExpressionSpecification =>
  ['interpolate', ['exponential', base], ['zoom'], ...stops] as ExpressionSpecification;

function vectorSource(tilesUrl: string): VectorSourceSpecification {
  if (isTemplateUrl(tilesUrl)) {
    return { type: 'vector', tiles: [tilesUrl], minzoom: 0, maxzoom: 14, attribution: atlasStyleAttribution.vector };
  }
  return { type: 'vector', url: tilesUrl, attribution: atlasStyleAttribution.vector };
}

function demSource(demUrl: string, encoding: AtlasDemEncoding): RasterDEMSourceSpecification {
  const base = { type: 'raster-dem' as const, encoding, attribution: atlasStyleAttribution.terrain };
  if (isTemplateUrl(demUrl)) {
    return { ...base, tiles: [demUrl], tileSize: 256, minzoom: 0, maxzoom: 15 };
  }
  return { ...base, url: demUrl };
}

function graticuleData(): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  const range = (from: number, to: number, step: number) =>
    Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

  for (const lng of range(-180, 165, 15)) {
    features.push({
      type: 'Feature',
      properties: { kind: 'meridian' },
      geometry: { type: 'LineString', coordinates: range(-80, 80, 10).map((lat) => [lng, lat]) },
    });
  }
  const parallels: Array<[number, string, string]> = [
    ...range(-75, 75, 15)
      .filter((lat) => lat !== 0)
      .map((lat): [number, string, string] => [lat, 'parallel', '']),
    [0, 'equator', 'Equator'],
    [23.4362, 'tropic', 'Tropic of Cancer'],
    [-23.4362, 'tropic', 'Tropic of Capricorn'],
  ];
  for (const [lat, kind, name] of parallels) {
    features.push({
      type: 'Feature',
      properties: { kind, name },
      geometry: { type: 'LineString', coordinates: range(-180, 180, 10).map((lng) => [lng, lat]) },
    });
  }
  return { type: 'FeatureCollection', features };
}

function graticuleLayers(p: AtlasMapPalette): LayerSpecification[] {
  return [
    {
      id: 'atlas-graticule',
      type: 'line',
      source: ATLAS_GRATICULE_SOURCE_ID,
      maxzoom: 7,
      filter: ['in', ['get', 'kind'], ['literal', ['meridian', 'parallel']]],
      paint: {
        'line-color': p.graticule,
        'line-width': 0.6,
        'line-opacity': zoomRamp(0, 1, 4, 0.8, 6.5, 0),
      },
    },
    {
      id: 'atlas-graticule-equator',
      type: 'line',
      source: ATLAS_GRATICULE_SOURCE_ID,
      maxzoom: 8,
      filter: ['==', ['get', 'kind'], 'equator'],
      paint: {
        'line-color': p.graticuleEmphasis,
        'line-width': zoomRamp(0, 0.7, 6, 1),
        'line-opacity': zoomRamp(0, 1, 5, 0.8, 7.5, 0),
      },
    },
    {
      id: 'atlas-graticule-tropics',
      type: 'line',
      source: ATLAS_GRATICULE_SOURCE_ID,
      maxzoom: 8,
      filter: ['==', ['get', 'kind'], 'tropic'],
      paint: {
        'line-color': p.graticuleEmphasis,
        'line-width': zoomRamp(0, 0.7, 6, 1),
        'line-dasharray': [4, 3],
        'line-opacity': zoomRamp(0, 1, 5, 0.8, 7.5, 0),
      },
    },
  ];
}

function baseLayers(p: AtlasMapPalette, hasDem: boolean, graticule: boolean): LayerSpecification[] {
  const layers: LayerSpecification[] = [
    { id: 'atlas-background', type: 'background', paint: { 'background-color': p.land } },
    {
      id: 'atlas-landcover-ice',
      type: 'fill',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'ice'],
      paint: { 'fill-color': p.landIce, 'fill-opacity': zoomRamp(0, 0.85, 8, 0.6), 'fill-antialias': false },
    },
    {
      id: 'atlas-landcover-wood',
      type: 'fill',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['wood', 'forest']]],
      paint: { 'fill-color': p.landWood, 'fill-opacity': zoomRamp(4, 0, 7, 0.7), 'fill-antialias': false },
    },
    {
      id: 'atlas-landcover-sand',
      type: 'fill',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'sand'],
      paint: { 'fill-color': p.landSand, 'fill-opacity': 0.7, 'fill-antialias': false },
    },
    {
      id: 'atlas-landuse-urban',
      type: 'fill',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'landuse',
      minzoom: 6,
      filter: [
        'in',
        ['get', 'class'],
        ['literal', ['residential', 'suburb', 'neighbourhood', 'commercial', 'industrial', 'retail', 'railway']],
      ],
      paint: {
        'fill-color': p.landUrban,
        'fill-opacity': zoomRamp(6, 0, 9, 0.75, 15, 0.55),
        'fill-antialias': false,
      },
    },
    {
      id: 'atlas-water',
      type: 'fill',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'water',
      filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'], ['!=', ['get', 'class'], 'swimming_pool']],
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10,
          ['match', ['get', 'class'], 'ocean', p.ocean, p.lake],
          15,
          ['match', ['get', 'class'], 'ocean', p.oceanCity, p.oceanCity],
        ],
      },
    },
  ];

  if (hasDem) {
    layers.push(
      {
        id: 'atlas-seafloor-relief',
        type: 'color-relief',
        source: ATLAS_DEM_SOURCE_ID,
        paint: {
          'color-relief-color': [
            'interpolate',
            ['linear'],
            ['elevation'],
            -9000,
            p.seafloorAbyss,
            -4500,
            p.seafloorAbyss,
            -2200,
            p.seafloorDeep,
            -400,
            TRANSPARENT,
            -120,
            p.seafloorShelf,
            -30,
            TRANSPARENT,
            1200,
            TRANSPARENT,
            3800,
            p.highland,
          ],
          'color-relief-opacity': zoomRamp(0, 1, 8, 0.85, 12, 0.4),
        },
      },
      {
        id: 'atlas-hillshade',
        type: 'hillshade',
        source: ATLAS_DEM_SOURCE_ID,
        paint: {
          'hillshade-method': 'igor',
          'hillshade-exaggeration': zoomRamp(0, 0.55, 6, 0.5, 9, 0.62, 12, 0.48, 15, 0.3),
          'hillshade-shadow-color': p.hillshadeShadow,
          'hillshade-highlight-color': p.hillshadeHighlight,
          'hillshade-accent-color': p.hillshadeAccent,
          'hillshade-illumination-direction': 315,
          'hillshade-illumination-anchor': 'map',
        },
      },
    );
  }

  if (graticule) layers.push(...graticuleLayers(p));

  layers.push(
    {
      id: 'atlas-coastline',
      type: 'line',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'water',
      filter: ['all', ['==', ['get', 'class'], 'ocean'], ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: {
        'line-color': p.coastline,
        'line-width': zoomRamp(0, 0.4, 6, 0.8, 14, 1.2),
        'line-opacity': zoomRamp(0, 0.45, 6, 0.6, 14, 0.35),
        'line-blur': 0.4,
      },
    },
    {
      id: 'atlas-waterway',
      type: 'line',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'waterway',
      minzoom: 6,
      filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'], ['!=', ['get', 'intermittent'], 1]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['interpolate', ['linear'], ['zoom'], 10, p.river, 13, p.oceanCity],
        'line-width': [
          'interpolate',
          ['exponential', 1.4],
          ['zoom'],
          6,
          ['match', ['get', 'class'], 'river', 0.6, 0.2],
          12,
          ['match', ['get', 'class'], 'river', 2, 0.8],
          16,
          ['match', ['get', 'class'], 'river', 6, 2],
        ],
        'line-opacity': zoomRamp(6, 0.5, 10, 0.9),
      },
    },
    {
      id: 'atlas-aeroway-runway',
      type: 'line',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'aeroway',
      minzoom: 11,
      filter: ['in', ['get', 'class'], ['literal', ['runway', 'taxiway']]],
      paint: {
        'line-color': p.runway,
        'line-width': [
          'interpolate',
          ['exponential', 1.6],
          ['zoom'],
          11,
          ['match', ['get', 'class'], 'runway', 1, 0.5],
          16,
          ['match', ['get', 'class'], 'runway', 24, 8],
        ],
      },
    },
    {
      id: 'atlas-ferry',
      type: 'line',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'transportation',
      minzoom: 8,
      filter: ['==', ['get', 'class'], 'ferry'],
      paint: {
        'line-color': p.ferry,
        'line-width': zoomRamp(8, 0.5, 14, 1.2),
        'line-dasharray': [3, 3],
        'line-opacity': 0.7,
      },
    },
    ...roadLayers(p),
    {
      id: 'atlas-rail',
      type: 'line',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'transportation',
      minzoom: 9,
      filter: [
        'all',
        ['==', ['get', 'class'], 'rail'],
        ['!=', ['get', 'brunnel'], 'tunnel'],
        ['!', ['in', ['coalesce', ['get', 'service'], ''], ['literal', ['yard', 'siding', 'spur']]]],
      ],
      paint: {
        'line-color': p.rail,
        'line-width': zoomRamp(9, 0.5, 16, 1.6),
        'line-dasharray': [4, 2],
        'line-opacity': zoomRamp(9, 0, 10, 0.8),
      },
    },
    {
      id: 'atlas-boundary-state',
      type: 'line',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'boundary',
      minzoom: 4,
      filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': p.boundaryState,
        'line-width': zoomRamp(4, 0.4, 10, 1),
        'line-dasharray': [2, 2],
        'line-opacity': zoomRamp(4, 0, 5, 0.8),
      },
    },
    {
      id: 'atlas-boundary-country',
      type: 'line',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'boundary',
      filter: [
        'all',
        ['==', ['get', 'admin_level'], 2],
        ['!=', ['get', 'maritime'], 1],
        ['!=', ['get', 'disputed'], 1],
      ],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': p.boundaryCountry,
        'line-width': zoomRamp(0, 0.5, 4, 0.8, 10, 1.6),
        'line-opacity': zoomRamp(0, 0.55, 5, 0.75),
      },
    },
    {
      id: 'atlas-boundary-disputed',
      type: 'line',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'boundary',
      filter: [
        'all',
        ['==', ['get', 'admin_level'], 2],
        ['!=', ['get', 'maritime'], 1],
        ['==', ['get', 'disputed'], 1],
      ],
      paint: {
        'line-color': p.boundaryCountry,
        'line-width': zoomRamp(0, 0.5, 10, 1.4),
        'line-dasharray': [2, 2],
        'line-opacity': 0.6,
      },
    },
  );

  return layers;
}

function roadLayers(p: AtlasMapPalette): LayerSpecification[] {
  const road = (
    id: string,
    classes: string[],
    minzoom: number,
    color: string,
    widths: number[],
    opacity: number[],
  ): LayerSpecification => ({
    id: `atlas-road-${id}`,
    type: 'line',
    source: ATLAS_VECTOR_SOURCE_ID,
    'source-layer': 'transportation',
    minzoom,
    filter: ['all', ['in', ['get', 'class'], ['literal', classes]], ['!=', ['get', 'brunnel'], 'tunnel']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': color,
      'line-width': zoomRampExp(1.5, ...widths),
      'line-opacity': zoomRamp(...opacity),
    },
  });

  return [
    road('path', ['path', 'track'], 15, p.roadMinor, [15, 0.5, 18, 1.5], [15, 0, 16, 0.6]),
    road('minor', ['minor', 'service'], 12, p.roadMinor, [12, 0.4, 14, 1.2, 16, 4, 18, 12], [12, 0, 13, 0.9]),
    road('secondary', ['secondary', 'tertiary'], 9, p.roadMedium, [9, 0.4, 12, 1.2, 14, 2.4, 16, 6, 18, 16], [9, 0, 10, 0.9]),
    road('primary', ['primary', 'trunk'], 6, p.roadMedium, [6, 0.4, 10, 1, 14, 3, 16, 8, 18, 20], [6, 0, 8, 0.85]),
    road('motorway', ['motorway'], 5, p.roadMajor, [5, 0.4, 10, 1.4, 14, 3.6, 16, 9, 18, 22], [5, 0, 7, 0.9]),
  ];
}

function buildingLayers(p: AtlasMapPalette): LayerSpecification[] {
  const height: ExpressionSpecification = ['coalesce', ['get', 'render_height'], 8];
  return [
    {
      id: 'atlas-building-footprint',
      type: 'fill',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'building',
      minzoom: 13,
      maxzoom: 15,
      paint: { 'fill-color': p.buildingLow, 'fill-opacity': zoomRamp(13, 0, 13.5, 0.7, 14.5, 0.7, 15, 0) },
    },
    {
      id: 'atlas-building-3d',
      type: 'fill-extrusion',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'building',
      minzoom: 14,
      filter: ['!=', ['get', 'hide_3d'], true],
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], height, 0, p.buildingLow, 60, p.buildingHigh],
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, height],
        'fill-extrusion-base': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          0,
          15,
          ['coalesce', ['get', 'render_min_height'], 0],
        ],
        'fill-extrusion-opacity': zoomRamp(14, 0, 15, 0.92),
        'fill-extrusion-vertical-gradient': true,
      },
    },
  ];
}

function labelLayers(p: AtlasMapPalette, graticule: boolean): LayerSpecification[] {
  const halo = { 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4, 'text-halo-blur': 0.6 };
  const waterHalo = { 'text-halo-color': p.labelWaterHalo, 'text-halo-width': 1, 'text-halo-blur': 0.8 };

  const layers: LayerSpecification[] = [
    {
      id: ATLAS_FIRST_LABEL_LAYER_ID,
      type: 'symbol',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'waterway',
      minzoom: 12,
      filter: ['==', ['get', 'class'], 'river'],
      layout: {
        'symbol-placement': 'line',
        'text-field': NAME,
        'text-font': FONT_ITALIC,
        'text-size': 11,
        'text-letter-spacing': 0.15,
      },
      paint: { 'text-color': p.labelWater, ...waterHalo },
    },
    ...(graticule ? [graticuleLabelLayer(p)] : []),
    {
      id: 'atlas-label-road',
      type: 'symbol',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'transportation_name',
      minzoom: 14,
      filter: [
        'in',
        ['get', 'class'],
        ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']],
      ],
      layout: {
        'symbol-placement': 'line',
        'text-field': NAME,
        'text-font': FONT_REGULAR,
        'text-size': zoomRamp(14, 9.5, 17, 12),
        'text-letter-spacing': 0.04,
      },
      paint: { 'text-color': p.labelRoad, ...halo },
    },
    {
      id: 'atlas-label-water-line',
      type: 'symbol',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'water_name',
      minzoom: 7,
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: {
        'symbol-placement': 'line',
        'text-field': NAME,
        'text-font': FONT_ITALIC,
        'text-size': 12,
        'text-letter-spacing': 0.2,
      },
      paint: { 'text-color': p.labelWater, ...waterHalo },
    },
    {
      id: 'atlas-label-water-sea',
      type: 'symbol',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'water_name',
      minzoom: 3,
      filter: [
        'all',
        ['==', ['geometry-type'], 'Point'],
        ['in', ['get', 'class'], ['literal', ['sea', 'bay', 'strait', 'lake']]],
      ],
      layout: {
        'text-field': NAME,
        'text-font': FONT_ITALIC,
        'text-size': zoomRamp(3, 10, 8, 13),
        'text-letter-spacing': 0.18,
        'text-max-width': 8,
      },
      paint: { 'text-color': p.labelWater, 'text-opacity': zoomRamp(3, 0, 3.6, 1), ...waterHalo },
    },
    {
      id: 'atlas-label-water-ocean',
      type: 'symbol',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'water_name',
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'class'], 'ocean']],
      layout: {
        'text-field': NAME,
        'text-font': FONT_ITALIC,
        'text-transform': 'uppercase',
        'text-size': zoomRamp(1, 10, 4, 14),
        'text-letter-spacing': 0.42,
        'text-max-width': 6,
        'text-line-height': 1.5,
      },
      paint: { 'text-color': p.labelWater, ...waterHalo },
    },
    {
      id: 'atlas-label-peak',
      type: 'symbol',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'mountain_peak',
      minzoom: 10,
      filter: ['all', ['has', 'name'], ['has', 'ele'], ['>=', ['length', NAME], 3], ['<=', RANK, 3]],
      layout: {
        'text-field': [
          'format',
          NAME,
          {},
          '\n',
          {},
          ['concat', ['to-string', ['get', 'ele']], ' m'],
          { 'font-scale': 0.82 },
        ],
        'text-font': FONT_ITALIC,
        'text-size': 10.5,
        'text-max-width': 8,
        'text-letter-spacing': 0.05,
      },
      paint: { 'text-color': p.labelPeak, ...halo },
    },
    {
      id: 'atlas-label-district',
      type: 'symbol',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'place',
      minzoom: 12,
      filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood']]],
      layout: {
        'text-field': NAME,
        'text-font': FONT_REGULAR,
        'text-transform': 'uppercase',
        'text-size': zoomRamp(12, 9, 16, 11.5),
        'text-letter-spacing': 0.18,
        'text-max-width': 7,
      },
      paint: { 'text-color': p.labelDistrict, ...halo },
    },
    {
      id: 'atlas-label-village',
      type: 'symbol',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'place',
      minzoom: 11,
      filter: [
        'step',
        ['zoom'],
        ['==', ['get', 'class'], 'village'],
        13.5,
        ['in', ['get', 'class'], ['literal', ['village', 'hamlet']]],
      ],
      layout: {
        'text-field': NAME,
        'text-font': FONT_REGULAR,
        'text-size': zoomRamp(11, 10, 15, 12.5),
        'text-max-width': 7,
      },
      paint: { 'text-color': p.labelVillage, ...halo },
    },
    {
      id: 'atlas-label-town',
      type: 'symbol',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'place',
      minzoom: 8.5,
      filter: ['==', ['get', 'class'], 'town'],
      layout: {
        'text-field': NAME,
        'text-font': FONT_REGULAR,
        'text-size': zoomRamp(8.5, 10, 14, 13.5),
        'text-max-width': 7,
      },
      paint: { 'text-color': p.labelTown, ...halo },
    },
    {
      id: 'atlas-label-city',
      type: 'symbol',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'place',
      minzoom: 5.5,
      filter: ['==', ['get', 'class'], 'city'],
      layout: {
        'text-field': NAME,
        'text-font': FONT_REGULAR,
        'text-size': zoomRamp(5.5, 11, 10, 15, 14, 18),
        'text-max-width': 8,
        'symbol-sort-key': RANK,
      },
      paint: { 'text-color': ['case', ['<=', RANK, 3], p.labelCityMajor, p.labelCity], ...halo },
    },
    {
      id: 'atlas-label-city-major',
      type: 'symbol',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'place',
      minzoom: 3.2,
      maxzoom: 5.5,
      filter: ['all', ['==', ['get', 'class'], 'city'], ['any', ['<=', RANK, 2], ['==', ['get', 'capital'], 2]]],
      layout: {
        'text-field': NAME,
        'text-font': FONT_REGULAR,
        'text-size': zoomRamp(3.2, 10, 5.5, 11.5),
        'text-max-width': 8,
        'symbol-sort-key': RANK,
      },
      paint: { 'text-color': p.labelCityMajor, 'text-opacity': zoomRamp(3.2, 0, 3.8, 1), ...halo },
    },
    {
      id: 'atlas-label-state',
      type: 'symbol',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'place',
      minzoom: 6,
      maxzoom: 8,
      filter: ['in', ['get', 'class'], ['literal', ['state', 'province']]],
      layout: {
        'text-field': NAME,
        'text-font': FONT_REGULAR,
        'text-transform': 'uppercase',
        'text-size': 9.5,
        'text-letter-spacing': 0.2,
        'text-max-width': 8,
      },
      paint: { 'text-color': p.labelDistrict, 'text-opacity': zoomRamp(6, 0, 6.5, 0.7), ...halo },
    },
    {
      id: 'atlas-label-country',
      type: 'symbol',
      source: ATLAS_VECTOR_SOURCE_ID,
      'source-layer': 'place',
      minzoom: 1.5,
      maxzoom: 9,
      filter: [
        'all',
        ['==', ['get', 'class'], 'country'],
        [
          'step',
          ['zoom'],
          ['<=', RANK, 1],
          2.6,
          ['<=', RANK, 2],
          3.6,
          ['all', ['<=', RANK, 3], NOT_MICROSTATE],
          5.5,
          ['all', ['<=', RANK, 4], NOT_MICROSTATE],
          7,
          true,
        ],
      ],
      layout: {
        'text-field': NAME,
        'text-font': FONT_BOLD,
        'text-transform': 'uppercase',
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          1.5,
          9,
          4,
          ['step', RANK, 11.5, 3, 10.5],
          7,
          ['step', RANK, 14, 3, 13, 5, 11.5],
        ],
        'text-letter-spacing': 0.24,
        'text-max-width': 6.5,
        'symbol-sort-key': RANK,
      },
      paint: {
        'text-color': p.labelCountry,
        'text-opacity': zoomRamp(1.5, 0.9, 8, 0.9, 9, 0),
        ...halo,
      },
    },
  ];
  return layers;
}

function graticuleLabelLayer(p: AtlasMapPalette): LayerSpecification {
  return {
    id: 'atlas-label-graticule',
    type: 'symbol',
    source: ATLAS_GRATICULE_SOURCE_ID,
    minzoom: 1,
    maxzoom: 7,
    filter: ['in', ['get', 'kind'], ['literal', ['equator', 'tropic']]],
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 900,
      'text-field': ['get', 'name'],
      'text-font': FONT_ITALIC,
      'text-transform': 'uppercase',
      'text-size': 9,
      'text-letter-spacing': 0.32,
      'text-offset': [0, -0.7],
      'text-padding': 8,
    },
    paint: {
      'text-color': p.labelGraticule,
      'text-opacity': zoomRamp(1, 0, 1.6, 0.85, 6, 0.6, 7, 0),
      'text-halo-color': p.labelWaterHalo,
      'text-halo-width': 1,
    },
  };
}

/** Builds the Ray|Atlas basemap style. */
export function createAtlasStyle(options: AtlasStyleOptions = {}): StyleSpecification {
  const variant = options.variant ?? 'night';
  const palette = getAtlasPalette(variant);
  const tilesUrl = options.tilesUrl?.trim() || ATLAS_DEFAULT_TILES_URL;
  const glyphsUrl = options.glyphsUrl?.trim() || ATLAS_DEFAULT_GLYPHS_URL;
  const demUrl = options.demUrl === undefined ? ATLAS_DEFAULT_DEM_URL : options.demUrl;
  const encoding = options.demEncoding ?? 'terrarium';

  const graticule = options.graticule !== false;
  const sources: Record<string, SourceSpecification> = {
    [ATLAS_VECTOR_SOURCE_ID]: vectorSource(tilesUrl),
  };
  if (graticule) sources[ATLAS_GRATICULE_SOURCE_ID] = { type: 'geojson', data: graticuleData() };
  const hasDem = !isDisabled(demUrl);
  if (!isDisabled(demUrl)) {
    sources[ATLAS_DEM_SOURCE_ID] = demSource(demUrl.trim(), encoding);
    sources[ATLAS_TERRAIN_SOURCE_ID] = demSource(demUrl.trim(), encoding);
  }

  return {
    version: 8,
    name: variant === 'day' ? 'Ray|Atlas Day' : 'Ray|Atlas Night',
    metadata: { 'rayatlas:variant': variant, 'rayatlas:space-color': palette.space },
    glyphs: glyphsUrl,
    projection: { type: options.projection ?? 'globe' },
    sky: {
      'sky-color': palette.sky,
      'horizon-color': palette.horizon,
      'fog-color': palette.fog,
      'sky-horizon-blend': 0.65,
      'horizon-fog-blend': 0.55,
      'fog-ground-blend': 0.75,
      'atmosphere-blend': zoomRamp(0, 0.95, 4, 0.7, 7, 0),
    },
    light: {
      anchor: 'viewport',
      color: palette.buildingLight,
      intensity: variant === 'day' ? 0.25 : 0.45,
      position: [1.5, 200, 25],
    },
    sources,
    layers: [
      ...baseLayers(palette, hasDem, graticule),
      ...(options.buildings === false ? [] : buildingLayers(palette)),
      ...labelLayers(palette, graticule),
    ],
  };
}

const envFlag = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value.trim() === '') return fallback;
  return !['false', '0', 'off', 'no'].includes(value.trim().toLowerCase());
};

/**
 * Returns `VITE_ATLAS_MAP_STYLE_URL` unchanged when set (full override), otherwise the generated
 * Ray|Atlas style configured from the remaining `VITE_ATLAS_*` variables.
 */
export function resolveAtlasStyle(env: AtlasStyleEnv = {}): string | StyleSpecification {
  const styleUrl = env.VITE_ATLAS_MAP_STYLE_URL?.trim();
  if (styleUrl) return styleUrl;

  const encoding = env.VITE_ATLAS_DEM_ENCODING?.trim().toLowerCase();
  const variant = env.VITE_ATLAS_MAP_VARIANT?.trim().toLowerCase();
  return createAtlasStyle({
    tilesUrl: env.VITE_ATLAS_TILES_URL,
    glyphsUrl: env.VITE_ATLAS_GLYPHS_URL,
    demUrl: env.VITE_ATLAS_DEM_URL,
    demEncoding: encoding === 'mapbox' ? 'mapbox' : 'terrarium',
    buildings: envFlag(env.VITE_ATLAS_BUILDINGS, true),
    variant: variant === 'day' || variant === 'light' ? 'day' : 'night',
  });
}

/** Minimal map surface needed to toggle terrain, so this module never imports maplibre-gl at runtime. */
export interface AtlasTerrainTarget {
  getSource(id: string): unknown;
  setTerrain(terrain: TerrainSpecification | null): unknown;
}

/**
 * Turns 3D terrain on or off and returns whether it is now active. Terrain stays off when the
 * style has no `atlas-terrain` source (DEM disabled or a custom `VITE_ATLAS_MAP_STYLE_URL`).
 */
export function applyAtlasTerrain(
  map: AtlasTerrainTarget,
  enabled: boolean,
  exaggeration: number = ATLAS_DEFAULT_TERRAIN_EXAGGERATION,
): boolean {
  if (enabled && map.getSource(ATLAS_TERRAIN_SOURCE_ID)) {
    map.setTerrain({ source: ATLAS_TERRAIN_SOURCE_ID, exaggeration });
    return true;
  }
  map.setTerrain(null);
  return false;
}
