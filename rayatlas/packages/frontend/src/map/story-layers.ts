import type { NetworkData, RouteMode } from '@rayfin-app/shared';
import type {
  CircleLayerSpecification,
  ExpressionSpecification,
  FilterSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl';

import { selectRoutes, selectSites } from '@/story/metrics';
import type { StoryFocus } from '@/story/types';

import type { AtlasMapPalette } from './atlas-style';

/*
 * Story overlay layers. Everything here is plain data so it can be unit-tested without WebGL; the
 * engine only adds these specs and swaps filters and gradients as chapters change.
 */

export const STORY_SITES_SOURCE_ID = 'story-sites';
export const STORY_ROUTES_SOURCE_ID = 'story-routes';
export const STORY_SHIPMENTS_SOURCE_ID = 'story-shipments';
export const STORY_LABEL_BLOCKS_SOURCE_ID = 'story-label-blocks';

export const ROUTE_MODES: readonly RouteMode[] = ['sea', 'rail', 'road', 'air'];

export const STORY_LAYER_IDS = {
  base: 'story-route-base',
  glow: (mode: RouteMode) => `story-route-glow-${mode}`,
  line: (mode: RouteMode) => `story-route-line-${mode}`,
  shipmentHalo: 'story-shipment-halo',
  shipmentCore: 'story-shipment-core',
  labelBlocks: 'story-label-blocks',
} as const;

const TRANSPARENT = 'rgba(0, 0, 0, 0)';
/** Bright leading edge of a route while it draws. */
const DRAW_HEAD = '#FFF6D8';

export interface ChapterFocusCodes {
  siteCodes: Set<string>;
  routeCodes: string[];
}

/** Resolve a story focus to concrete site and route codes in the loaded network. */
export function resolveFocusCodes(network: NetworkData, focus: StoryFocus): ChapterFocusCodes {
  return {
    siteCodes: new Set(selectSites(network, focus).map((site) => site.code)),
    routeCodes: selectRoutes(network, focus).map((route) => route.code).sort(),
  };
}

/** Routes of one mode whose code is in the focused set. */
export function focusedRouteFilter(mode: RouteMode, routeCodes: readonly string[]): FilterSpecification {
  return [
    'all',
    ['==', ['get', 'mode'], mode],
    ['in', ['get', 'code'], ['literal', [...routeCodes]]],
  ];
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

/**
 * `line-gradient` that reveals a route from origin (`line-progress` 0) to destination (1). Below
 * full progress the drawn part ends in a bright head, and everything past the head is transparent.
 */
export function routeDrawGradient(color: string, progress: number): ExpressionSpecification {
  const p = clamp01(progress);
  if (p >= 1) return ['interpolate', ['linear'], ['line-progress'], 0, color, 1, color];
  if (p <= 0.0005) return ['interpolate', ['linear'], ['line-progress'], 0, TRANSPARENT, 1, TRANSPARENT];
  const head = Math.min(p, 0.999);
  const body = Math.max(0.0001, head - 0.035);
  const stops: (string | number)[] = [];
  if (body > 0.0001) stops.push(0, color);
  stops.push(body, color, head, DRAW_HEAD, head + 0.0005, TRANSPARENT, 1, TRANSPARENT);
  return ['interpolate', ['linear'], ['line-progress'], ...stops] as ExpressionSpecification;
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

const routeColor = (palette: AtlasMapPalette): ExpressionSpecification => [
  'match',
  ['get', 'mode'],
  'sea', palette.route.sea,
  'rail', palette.route.rail,
  'road', palette.route.road,
  'air', palette.route.air,
  palette.highlight,
];

const zoomRamp = (...stops: number[]): ExpressionSpecification =>
  ['interpolate', ['linear'], ['zoom'], ...stops] as ExpressionSpecification;

/** All story layers, bottom to top. Insert them below the basemap labels. */
export function createStoryLayers(palette: AtlasMapPalette): Array<LineLayerSpecification | CircleLayerSpecification> {
  const base: LineLayerSpecification = {
    id: STORY_LAYER_IDS.base,
    type: 'line',
    source: STORY_ROUTES_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': routeColor(palette),
      'line-width': zoomRamp(1, 0.7, 4, 1.1, 10, 1.6),
      'line-opacity': 0.3,
      'line-opacity-transition': { duration: 600, delay: 0 },
    },
  };

  const routeLayers = ROUTE_MODES.flatMap((mode): LineLayerSpecification[] => [
    {
      id: STORY_LAYER_IDS.glow(mode),
      type: 'line',
      source: STORY_ROUTES_SOURCE_ID,
      filter: focusedRouteFilter(mode, []),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-gradient': routeDrawGradient(palette.route[mode], 1),
        'line-width': zoomRamp(1, 8, 5, 12, 12, 20),
        'line-blur': zoomRamp(1, 6, 5, 9, 12, 13),
        'line-opacity': 0.5,
      },
    },
    {
      id: STORY_LAYER_IDS.line(mode),
      type: 'line',
      source: STORY_ROUTES_SOURCE_ID,
      filter: focusedRouteFilter(mode, []),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-gradient': routeDrawGradient(palette.route[mode], 1),
        'line-width': zoomRamp(1, 2, 5, 2.8, 12, 5),
      },
    },
  ]);

  const shipmentColor: ExpressionSpecification = [
    'match',
    ['get', 'mode'],
    'sea', palette.route.sea,
    'rail', palette.route.rail,
    'road', palette.route.road,
    'air', palette.route.air,
    palette.highlight,
  ];

  const halo: CircleLayerSpecification = {
    id: STORY_LAYER_IDS.shipmentHalo,
    type: 'circle',
    source: STORY_SHIPMENTS_SOURCE_ID,
    paint: {
      'circle-color': shipmentColor,
      'circle-radius': zoomRamp(1, 6, 6, 9, 12, 12),
      'circle-blur': 1,
      'circle-opacity': 0.55,
      'circle-pitch-alignment': 'map',
    },
  };
  const core: CircleLayerSpecification = {
    id: STORY_LAYER_IDS.shipmentCore,
    type: 'circle',
    source: STORY_SHIPMENTS_SOURCE_ID,
    paint: {
      'circle-color': DRAW_HEAD,
      'circle-radius': zoomRamp(1, 1.8, 6, 2.6, 12, 3.6),
      'circle-stroke-color': shipmentColor,
      'circle-stroke-width': 1.2,
      'circle-pitch-alignment': 'map',
    },
  };

  return [base, ...routeLayers, halo, core];
}

/** Opacity of the faint whole-network layer: quieter while a chapter highlights routes. */
export function baseNetworkOpacity(hasFocusedRoutes: boolean): number {
  return hasFocusedRoutes ? 0.16 : 0.34;
}

/** Screen footprint (CSS pixels, relative to the site's point) of a focused marker and its label. */
export interface LabelBlock {
  lngLat: [number, number];
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Block sizes snap to this grid so a handful of transparent images cover every label. */
const LABEL_BLOCK_GRID = 8;

const snapUp = (value: number) => Math.max(LABEL_BLOCK_GRID, Math.ceil(value / LABEL_BLOCK_GRID) * LABEL_BLOCK_GRID);

/** The transparent image a block of this size uses, snapped to the grid. */
export function labelBlockImage(width: number, height: number): { id: string; width: number; height: number } {
  const w = snapUp(width);
  const h = snapUp(height);
  return { id: `story-label-block-${w}x${h}`, width: w, height: h };
}

/** Point features for the invisible label blockers, each carrying its image and offset. */
export function labelBlockFeatures(blocks: readonly LabelBlock[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: blocks.map((block) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: block.lngLat },
      properties: {
        image: labelBlockImage(block.width, block.height).id,
        offset: [Math.round(block.x), Math.round(block.y)],
      },
    })),
  };
}

/**
 * Invisible symbols over each focused marker and its HTML label. Added above every basemap layer,
 * they win symbol placement, so basemap place names that would collide with story labels fade out.
 */
export function createLabelBlockLayer(): SymbolLayerSpecification {
  return {
    id: STORY_LAYER_IDS.labelBlocks,
    type: 'symbol',
    source: STORY_LABEL_BLOCKS_SOURCE_ID,
    layout: {
      'icon-image': ['get', 'image'],
      'icon-anchor': 'top-left',
      'icon-offset': ['get', 'offset'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': false,
      'icon-padding': 2,
      'icon-pitch-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
    },
    paint: { 'icon-opacity': 0 },
  };
}
