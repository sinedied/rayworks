import type { NetworkData } from '@rayfin-app/shared';
import {
  LngLat,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapEventType,
  type StyleSpecification,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

import { networkToGeoJson } from '@/lib/network';
import type { StoryScene } from '@/story/scenes';
import type { StoryCamera } from '@/story/types';

import {
  applyAtlasTerrain,
  ATLAS_FIRST_LABEL_LAYER_ID,
  ATLAS_VECTOR_SOURCE_ID,
  type AtlasMapPalette,
} from './atlas-style';
import { flightCurve, readCamera, samePadding, sceneCameraTarget, type CameraPadding } from './camera';
import { routePathsFromFeatures, shipmentPositions, type RoutePath } from './route-paths';
import { SiteMarkers } from './site-markers';
import {
  baseNetworkOpacity,
  createLabelBlockLayer,
  createStoryLayers,
  easeInOutCubic,
  focusedRouteFilter,
  labelBlockFeatures,
  labelBlockImage,
  resolveFocusCodes,
  ROUTE_MODES,
  routeDrawGradient,
  STORY_LABEL_BLOCKS_SOURCE_ID,
  STORY_LAYER_IDS,
  STORY_ROUTES_SOURCE_ID,
  STORY_SHIPMENTS_SOURCE_ID,
  type LabelBlock,
} from './story-layers';

setWorkerUrl(workerUrl);

export type EngineStatus =
  | { kind: 'ready' }
  /** `fatal`: the map could not start. Otherwise the map works but tiles are failing. */
  | { kind: 'error'; fatal: boolean; message: string };

export interface StoryMapEngineOptions {
  container: HTMLElement;
  network: NetworkData;
  style: string | StyleSpecification;
  palette: AtlasMapPalette;
  scene: StoryScene;
  padding: CameraPadding;
  reducedMotion: boolean;
  interactive: boolean;
  onStatus: (status: EngineStatus) => void;
}

const DRAW_MS = 2600;
const SHIPMENT_FRAME_MS = 33;
const SPIN_DEGREES_PER_SECOND = 2.4;
const TILE_ERROR_THRESHOLD = 3;
const GLOBE_FIT_ZOOM_OFFSET = 0.6;

type MapErrorEvent = MapEventType['error'];

const emptyCollection = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] });

/** Keep marker labels out from under the story column, toolbar, rail, and captions. */
function labelInsets(padding: CameraPadding) {
  return {
    top: Math.max(0, padding.top - 16),
    right: Math.max(0, padding.right - 48),
    bottom: Math.max(28, padding.bottom - 40),
    left: Math.max(0, padding.left + 8),
  };
}

/**
 * The single MapLibre instance behind the reader, presentation, and editor. React owns layout;
 * this class owns the map: sources, story layers, markers, camera choreography, and animation.
 */
export class StoryMapEngine {
  readonly map: MapLibreMap;
  private readonly options: StoryMapEngineOptions;
  private network: NetworkData;
  private paths = new Map<string, RoutePath>();
  private markers: SiteMarkers | null = null;
  private navigation: NavigationControl | null = null;
  private scene: StoryScene;
  private padding: CameraPadding;
  private reducedMotion: boolean;
  private interactive = false;
  private styleLoaded = false;
  private loaded = false;
  private destroyed = false;
  private tileErrors = 0;
  private cameraKey = '';
  private focusKey = '';
  private focusedPaths: RoutePath[] = [];
  private moveToken = 0;
  private animationFrame = 0;
  private animationStart = 0;
  private drawDelay = 0;
  private drawProgress = 1;
  private lastShipmentFrame = 0;
  private spinFrame = 0;
  private spinLast = 0;

  constructor(options: StoryMapEngineOptions) {
    this.options = options;
    this.network = options.network;
    this.scene = options.scene;
    this.padding = options.padding;
    this.reducedMotion = options.reducedMotion;
    const { camera } = options.scene;
    this.map = new MapLibreMap({
      container: options.container,
      style: options.style,
      center: camera.center,
      zoom: camera.zoom,
      bearing: camera.bearing,
      pitch: camera.pitch,
      attributionControl: { compact: true },
      maplibreLogo: false,
      maxPitch: 80,
      renderWorldCopies: false,
      fadeDuration: 240,
      keyboard: false,
      canvasContextAttributes: { antialias: true },
    });
    this.map.setPadding(options.padding);
    this.setInteractive(options.interactive);

    this.map.on('style.load', () => { this.styleLoaded = true; });
    this.map.on('load', this.handleLoad);
    this.map.on('error', this.handleError);
    this.map.on('movestart', () => {
      if (!this.spinFrame) this.markers?.setMoving(true);
    });
    this.map.on('moveend', () => {
      if (this.spinFrame) this.markers?.scheduleLabels();
      else this.markers?.setMoving(false);
    });
    this.map.on('dragstart', this.stopSpin);
    this.map.on('resize', this.collapseAttribution);
    this.map.on('wheel', this.stopSpin);
  }

  private handleLoad = () => {
    if (this.destroyed) return;
    this.loaded = true;
    const geo = networkToGeoJson(this.network);
    this.paths = routePathsFromFeatures(geo.routes.features);
    this.map.addSource(STORY_ROUTES_SOURCE_ID, { type: 'geojson', data: geo.routes, lineMetrics: true });
    this.map.addSource(STORY_SHIPMENTS_SOURCE_ID, { type: 'geojson', data: emptyCollection() });
    const before = this.map.getLayer(ATLAS_FIRST_LABEL_LAYER_ID) ? ATLAS_FIRST_LABEL_LAYER_ID : undefined;
    for (const layer of createStoryLayers(this.options.palette)) this.map.addLayer(layer, before);
    this.map.addSource(STORY_LABEL_BLOCKS_SOURCE_ID, { type: 'geojson', data: emptyCollection() });
    this.map.addLayer(createLabelBlockLayer());
    this.markers = new SiteMarkers(Marker, this.map, this.network.sites, this.options.palette, this.setLabelBlocks);
    this.markers.setLabelInsets(labelInsets(this.padding));
    this.applyScene(true);
    this.collapseAttribution();
    this.options.onStatus({ kind: 'ready' });
  };

  /** Reserve the focused markers' label areas so colliding basemap place names step aside. */
  private setLabelBlocks = (blocks: LabelBlock[]) => {
    if (this.destroyed || !this.loaded) return;
    for (const block of blocks) {
      const { id, width, height } = labelBlockImage(block.width, block.height);
      if (this.map.hasImage(id)) continue;
      this.map.addImage(id, { width, height, data: new Uint8Array(width * height * 4) });
    }
    this.map.getSource<GeoJSONSource>(STORY_LABEL_BLOCKS_SOURCE_ID)?.setData(labelBlockFeatures(blocks));
  };

  /** Keep attribution as the compact (i) control so it never covers the story; it opens on demand. */
  private collapseAttribution = () => {
    const control = this.options.container.querySelector('.maplibregl-ctrl-attrib.maplibregl-compact');
    if (!control) return;
    control.classList.remove('maplibregl-compact-show');
    control.removeAttribute('open');
  };

  private handleError = (event: MapErrorEvent) => {
    if (this.destroyed) return;
    console.error('Ray|Atlas map error:', event.error);
    if (!this.styleLoaded) {
      this.options.onStatus({
        kind: 'error',
        fatal: true,
        message: 'The map style could not load. Check your connection or the configured map style, then try again.',
      });
      return;
    }
    const sourceId = (event as MapErrorEvent & { sourceId?: string }).sourceId;
    if (sourceId === ATLAS_VECTOR_SOURCE_ID || !this.loaded) {
      this.tileErrors += 1;
      if (this.tileErrors === TILE_ERROR_THRESHOLD) {
        this.options.onStatus({
          kind: 'error',
          fatal: false,
          message: 'Map tiles are not loading, so parts of the map may be blank. The story still works.',
        });
      }
    }
  };

  getCamera(): StoryCamera {
    return readCamera(this.map);
  }

  setNetwork(network: NetworkData) {
    if (network === this.network) return;
    this.network = network;
    if (!this.loaded) return;
    const geo = networkToGeoJson(network);
    this.paths = routePathsFromFeatures(geo.routes.features);
    this.map.getSource<GeoJSONSource>(STORY_ROUTES_SOURCE_ID)?.setData(geo.routes);
    this.markers?.destroy();
    this.markers = new SiteMarkers(Marker, this.map, network.sites, this.options.palette, this.setLabelBlocks);
    this.markers.setLabelInsets(labelInsets(this.padding));
    this.focusKey = '';
    this.applyScene(false);
  }

  setScene(scene: StoryScene, padding: CameraPadding, reducedMotion: boolean) {
    this.scene = scene;
    if (!samePadding(padding, this.padding)) this.markers?.setLabelInsets(labelInsets(padding));
    this.padding = padding;
    this.reducedMotion = reducedMotion;
    if (this.loaded) this.applyScene(false);
  }

  /** Free camera control for editing; the reader and presentation keep the map still. */
  setInteractive(interactive: boolean) {
    const wasInteractive = this.interactive;
    this.interactive = interactive;
    const handlers = [
      this.map.scrollZoom, this.map.dragPan, this.map.dragRotate, this.map.doubleClickZoom,
      this.map.touchZoomRotate, this.map.touchPitch, this.map.boxZoom, this.map.keyboard,
    ];
    for (const handler of handlers) {
      if (interactive) handler.enable();
      else handler.disable();
    }
    if (interactive && !this.navigation) {
      this.navigation = new NavigationControl({ visualizePitch: true, showCompass: true });
      this.map.addControl(this.navigation, 'top-right');
    } else if (!interactive && this.navigation) {
      this.map.removeControl(this.navigation);
      this.navigation = null;
    }
    if (interactive) this.stopSpin();
    this.map.getCanvas().tabIndex = interactive ? 0 : -1;
    if (wasInteractive && !interactive && this.loaded) {
      // Leaving edit mode: return to the chapter's saved view.
      this.cameraKey = '';
      this.applyScene(false);
    }
  }

  /** Fly back to the current scene's view, e.g. after free panning in edit mode. */
  returnToScene() {
    if (!this.loaded) return;
    this.cameraKey = '';
    this.applyScene(false);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animationFrame);
    this.stopSpin();
    this.markers?.destroy();
    this.map.remove();
  }

  private applyScene(force: boolean) {
    const scene = this.scene;
    const codes = resolveFocusCodes(this.network, scene.focus);
    const focusKey = `${scene.key}|${[...codes.siteCodes].sort().join(',')}|${codes.routeCodes.join(',')}`;
    if (force || focusKey !== this.focusKey) {
      this.focusKey = focusKey;
      for (const mode of ROUTE_MODES) {
        const filter = focusedRouteFilter(mode, codes.routeCodes);
        this.map.setFilter(STORY_LAYER_IDS.glow(mode), filter);
        this.map.setFilter(STORY_LAYER_IDS.line(mode), filter);
      }
      this.map.setPaintProperty(STORY_LAYER_IDS.base, 'line-opacity', baseNetworkOpacity(codes.routeCodes.length > 0));
      this.markers?.setFocus(scene.kind === 'intro' ? null : codes.siteCodes);
      this.focusedPaths = codes.routeCodes
        .map((code) => this.paths.get(code))
        .filter((path): path is RoutePath => Boolean(path));
    }

    const { top, right, bottom, left } = this.padding;
    const cameraKey = [
      scene.key, scene.fit, ...scene.camera.center, scene.camera.zoom, scene.camera.bearing, scene.camera.pitch,
      top, right, bottom, left, this.reducedMotion,
    ].join('|');
    if (!force && cameraKey === this.cameraKey) return;
    const sceneChanged = force || !this.cameraKey.startsWith(`${scene.key}|`);
    this.cameraKey = cameraKey;
    this.moveCamera(scene);
    if (sceneChanged) this.startAnimation(scene);
  }

  private moveCamera(scene: StoryScene) {
    this.stopSpin();
    const token = ++this.moveToken;
    const target = sceneCameraTarget(scene, this.network);
    let camera = target.kind === 'camera' ? target.camera : target.fallback;
    if (target.kind === 'bounds') {
      const fit = this.map.cameraForBounds(target.bounds, {
        padding: {
          top: this.padding.top + 48,
          right: this.padding.right + 48,
          bottom: this.padding.bottom + 48,
          left: this.padding.left + 48,
        },
        bearing: target.bearing,
        absolutePadding: true,
      });
      if (fit?.center) {
        const center = LngLat.convert(fit.center);
        // Globe views render larger than the Mercator fit assumes; ease out so the frame holds.
        const fitZoom = fit.zoom ?? camera.zoom;
        camera = {
          center: [center.lng, center.lat],
          zoom: Math.min(fitZoom < 5 ? fitZoom - GLOBE_FIT_ZOOM_OFFSET : fitZoom, 12),
          bearing: target.bearing,
          pitch: target.pitch,
        };
      }
    }

    if (scene.terrain) applyAtlasTerrain(this.map, true);
    const arrive = () => {
      if (token !== this.moveToken || this.destroyed) return;
      if (!this.scene.terrain) applyAtlasTerrain(this.map, false);
      if (this.scene.spin && !this.reducedMotion && !this.interactive) this.startSpin();
    };

    const options = {
      center: camera.center,
      zoom: camera.zoom,
      bearing: camera.bearing,
      pitch: camera.pitch,
      padding: this.padding,
    };
    if (this.reducedMotion) {
      this.map.jumpTo(options);
      arrive();
      return;
    }
    this.map.flyTo({
      ...options,
      duration: scene.duration,
      curve: flightCurve(this.map.getZoom(), camera.zoom),
      essential: true,
    });
    // Registered after flyTo: interrupting a running flight fires its moveend synchronously.
    if (this.map.isMoving()) this.map.once('moveend', arrive);
    else arrive();
  }

  private setDrawProgress(progress: number) {
    for (const mode of ROUTE_MODES) {
      const gradient = routeDrawGradient(this.options.palette.route[mode], progress);
      this.map.setPaintProperty(STORY_LAYER_IDS.line(mode), 'line-gradient', gradient);
      this.map.setPaintProperty(STORY_LAYER_IDS.glow(mode), 'line-gradient', gradient);
    }
  }

  private startAnimation(scene: StoryScene) {
    cancelAnimationFrame(this.animationFrame);
    const shipments = this.map.getSource<GeoJSONSource>(STORY_SHIPMENTS_SOURCE_ID);
    shipments?.setData(emptyCollection());
    const animate = scene.animateRoutes && !this.reducedMotion && this.focusedPaths.length > 0;
    if (!animate) {
      this.drawProgress = 1;
      this.setDrawProgress(1);
      return;
    }
    this.drawProgress = 0;
    this.setDrawProgress(0);
    this.drawDelay = Math.min(scene.duration * 0.55, 3200);
    this.animationStart = performance.now();
    this.lastShipmentFrame = 0;
    const tick = (now: number) => {
      if (this.destroyed) return;
      const elapsed = now - this.animationStart;
      if (this.drawProgress < 1) {
        const progress = easeInOutCubic((elapsed - this.drawDelay) / DRAW_MS);
        if (progress !== this.drawProgress) {
          this.drawProgress = progress;
          this.setDrawProgress(progress);
        }
      }
      if (now - this.lastShipmentFrame >= SHIPMENT_FRAME_MS) {
        this.lastShipmentFrame = now;
        const loopSeconds = Math.max(0, elapsed - this.drawDelay - DRAW_MS) / 1000;
        shipments?.setData(shipmentPositions(this.focusedPaths, loopSeconds, this.drawProgress));
      }
      this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  private startSpin() {
    this.stopSpin();
    this.spinLast = performance.now();
    const spin = (now: number) => {
      if (this.destroyed) return;
      const seconds = Math.min(0.1, (now - this.spinLast) / 1000);
      this.spinLast = now;
      const center = this.map.getCenter();
      this.map.jumpTo({ center: [center.lng + seconds * SPIN_DEGREES_PER_SECOND, center.lat] });
      this.spinFrame = requestAnimationFrame(spin);
    };
    this.spinFrame = requestAnimationFrame(spin);
  }

  private stopSpin = () => {
    cancelAnimationFrame(this.spinFrame);
    this.spinFrame = 0;
  };
}
