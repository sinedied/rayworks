/**
 * Imperative MapLibre globe behind `GlobeResults`. React owns the layout; this owns the map,
 * the HTML labels and a single animation loop (rotation, comets, bubble pops, label collisions).
 */
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';

import type { GlobeCity, GlobeTally } from '@/lib/globe';
import {
  arcFeatures,
  buildGlobePalette,
  buildGlobeStyle,
  cityFeatures,
  cometGradient,
  cometProgress,
  COMET_PERIOD_MS,
  globeFitZoom,
  initialView,
  paletteProperties,
  readThemeColors,
  viewZoom,
  zoomedRadius,
  type GlobePalette,
} from '@/lib/globeStyle';
import type { MapLibre } from '@/lib/maplibre';
import type { WorldFeatureCollection } from '@/lib/places';

export type GlobeVariant = 'stage' | 'card';

export interface GlobeControllerOptions {
  variant: GlobeVariant;
  reducedMotion: boolean;
  /** Left inset (px) covered by the stats panel, so the globe centres in the free space. */
  getInset: () => number;
}

/** Top cities that get an HTML label; more than this turns into clutter on a projector. */
export const LABELED_CITIES = 8;

const SPIN_DEG_PER_SEC = 4.5;
const SWAY_DEG = 32;
const SWAY_PERIOD_MS = 70_000;
const RESUME_AFTER_MS = 12_000;
const POP_MS = 850;
const COMET_FRAME_MS = 33;
const COLLIDE_MS = 220;
const EASE_MS = 1800;
/** Labels this far (degrees) from the view centre sit on the limb and read as floating. */
const LIMB_DEG = 76;

type CameraTarget = { center: [number, number]; zoom: number };

function angularDistance(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const cos =
    Math.sin(a[1] * rad) * Math.sin(b[1] * rad) +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos((a[0] - b[0]) * rad);
  return Math.acos(Math.max(-1, Math.min(1, cos))) / rad;
}

const easeOutBack = (t: number) => {
  const c1 = 1.9;
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

interface Label {
  marker: Marker;
  inner: HTMLElement;
  priority: number;
  r: number;
  side: 'left' | 'right';
}

function labelClasses(stage: boolean) {
  return stage
    ? 'text-[clamp(0.8rem,1.35cqi,1.05rem)] px-2.5 py-1'
    : 'text-xs px-2 py-0.5';
}

export class GlobeController {
  readonly map: MapLibreMap;
  readonly ready: Promise<void>;

  private readonly ml: MapLibre;
  private readonly container: HTMLElement;
  private readonly options: GlobeControllerOptions;
  private readonly stage: boolean;
  private palette: GlobePalette;
  private paletteKey: string;
  private loaded = false;
  private destroyed = false;
  private tally: GlobeTally | null = null;
  private signature = '';
  private knownCities = new Set<string>();
  private firstData = true;
  private labels = new Map<string, Label>();
  private venueMarker: Marker | null = null;
  private venueKey = '';
  private venueRing: HTMLElement | null = null;
  private pops = new Map<string, number>();
  private raf = 0;
  private lastFrame = 0;
  private lastComet = 0;
  private lastCollide = 0;
  private lastProgress = 0;
  private startedAt = 0;
  private hasArcs = false;
  private userMoved = false;
  private pausedUntil = 0;
  private spin = false;
  private swayOrigin = 0;
  private swayDeg = SWAY_DEG;
  private target: CameraTarget | null = null;
  private swayStart = 0;
  private lastIdlePulse = 0;
  private themeObserver: MutationObserver | null = null;

  constructor(
    maplibre: MapLibre,
    container: HTMLElement,
    world: WorldFeatureCollection,
    options: GlobeControllerOptions
  ) {
    this.ml = maplibre;
    this.container = container;
    this.options = options;
    this.stage = options.variant === 'stage';
    this.palette = buildGlobePalette(readThemeColors(container));
    this.paletteKey = JSON.stringify(this.palette.raw);

    const { width, height } = container.getBoundingClientRect();
    this.map = new maplibre.Map({
      container,
      style: buildGlobeStyle(world, this.palette),
      center: [10, 25],
      zoom: globeFitZoom(Math.min(width, height) * 0.86),
      minZoom: -1,
      maxZoom: 6,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      keyboard: false,
      cooperativeGestures: !this.stage,
      fadeDuration: 0,
      canvasContextAttributes: { antialias: true },
    });

    this.map.touchZoomRotate.disableRotation();
    const canvas = this.map.getCanvas();
    canvas.setAttribute('aria-hidden', 'true');
    canvas.tabIndex = -1;

    const pause = () => {
      this.userMoved = true;
      this.pausedUntil = performance.now() + RESUME_AFTER_MS;
    };
    for (const type of ['mousedown', 'touchstart', 'wheel', 'dragstart'] as const) {
      this.map.on(type, pause);
    }
    this.map.on('zoomend', () => this.updateLabelOffsets());

    this.ready = new Promise<void>((resolve, reject) => {
      this.map.once('load', () => {
        if (this.destroyed) return;
        this.loaded = true;
        this.layout(true);
        if (this.tally) this.applyTally(this.tally);
        this.observeTheme();
        this.startedAt = performance.now();
        this.raf = requestAnimationFrame(this.frame);
        resolve();
      });
      this.map.on('error', (event) => {
        if (!this.loaded) reject(event.error ?? new Error('Map failed to load'));
      });
    });
  }

  update(tally: GlobeTally) {
    this.tally = tally;
    if (this.loaded) {
      this.applyTheme();
      this.applyTally(tally);
    }
  }

  /** Re-centres the globe in the space beside the stats panel; refits unless the user moved it. */
  layout(force = false) {
    if (!this.loaded) return;
    const inset = Math.max(0, this.options.getInset());
    const padding = { left: inset, right: 0, top: 0, bottom: 0 };
    this.map.setPadding(padding);
    if (!force && this.userMoved) return;
    this.fitCamera();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.themeObserver?.disconnect();
    for (const label of this.labels.values()) label.marker.remove();
    this.labels.clear();
    this.venueMarker?.remove();
    this.map.remove();
  }

  private observeTheme() {
    const target = this.container.closest('[data-ia-theme]') ?? this.container.ownerDocument.documentElement;
    this.themeObserver = new MutationObserver(() => this.applyTheme());
    this.themeObserver.observe(target, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  private applyTheme() {
    const palette = buildGlobePalette(readThemeColors(this.container));
    const key = JSON.stringify(palette.raw);
    if (key === this.paletteKey) return;
    this.palette = palette;
    this.paletteKey = key;
    for (const [layer, property, value] of paletteProperties(palette)) {
      this.map.setPaintProperty(layer, property as never, value as never);
    }
    this.map.setSky(palette.sky);
    if (this.options.reducedMotion) this.setStaticComets();
  }

  private setStaticComets() {
    const gradient = cometGradient(null, this.palette);
    this.map.setPaintProperty('comets', 'line-gradient', gradient);
    this.map.setPaintProperty('comet-glow', 'line-gradient', gradient);
  }

  /**
   * Frames the participants. Later calls ease to the new framing, and only when it moved
   * meaningfully, so a steady trickle of answers does not keep nudging the camera.
   */
  private fitCamera(animate = false) {
    if (!this.tally) return;
    const view = initialView(this.tally);
    const { width, height } = this.container.getBoundingClientRect();
    const inset = Math.max(0, this.options.getInset());
    const free = Math.max(160, width - inset);
    const wholeGlobe = view.spreadDeg >= 55;
    // A whole-globe view tilts toward the populated mid-latitudes rather than a pole.
    const lat = wholeGlobe ? Math.max(-35, Math.min(45, view.center[1])) : view.center[1];
    // On stage the sphere may slightly overflow the height; the container fades its edges.
    const diameter = this.stage ? Math.min(free * 0.86, height * 1.06) : Math.min(free, height) * 0.86;
    const target: CameraTarget = { center: [view.center[0], lat], zoom: viewZoom({ ...view, center: [view.center[0], lat] }, diameter) };

    if (animate && this.target) {
      const moved =
        Math.abs(target.zoom - this.target.zoom) > 0.2 || angularDistance(target.center, this.target.center) > 10;
      if (!moved) return;
    }
    this.target = target;
    this.spin = this.stage && view.spreadDeg >= 100;
    this.swayDeg = Math.max(4, Math.min(SWAY_DEG, view.spreadDeg * 0.5));
    this.swayOrigin = target.center[0];

    const ease = animate && !this.options.reducedMotion;
    this.swayStart = performance.now() + (ease ? EASE_MS : 0);
    if (ease) this.map.easeTo({ ...target, duration: EASE_MS });
    else this.map.jumpTo(target);
    this.updateLabelOffsets();
  }

  private applyTally(tally: GlobeTally) {
    const signature = `${tally.venue?.id ?? ''}|${tally.cities.map((c) => `${c.place.id}:${c.count}`).join(',')}`;
    if (signature === this.signature) return;
    this.signature = signature;

    const scale = this.stage ? 1.25 : 1;
    const cities = cityFeatures(tally.cities, scale);
    const arcs = arcFeatures(tally.cities, tally.venue);
    this.hasArcs = arcs.features.length > 0;
    (this.map.getSource('cities') as GeoJSONSource).setData(cities as never);
    (this.map.getSource('arcs') as GeoJSONSource).setData(arcs as never);
    if (this.options.reducedMotion) this.setStaticComets();

    // Pop new cities in; on the first load they cascade in one after another.
    const now = performance.now();
    if (!this.options.reducedMotion) {
      tally.cities.forEach((city, index) => {
        if (this.knownCities.has(city.place.id)) return;
        const delay = this.firstData ? Math.min(index * 45, 1400) : 0;
        this.pops.set(city.place.id, now + delay);
        this.map.setFeatureState({ source: 'cities', id: city.place.id }, { pop: 0 });
      });
    }
    this.knownCities = new Set(tally.cities.map((city) => city.place.id));
    this.firstData = false;

    const radii = new Map(cities.features.map((f) => [f.properties.id, f.properties.r]));
    this.syncLabels(tally, radii);
    this.syncVenue(tally);

    if (!this.userMoved) this.fitCamera(this.target !== null);
  }

  private syncLabels(tally: GlobeTally, radii: Map<string, number>) {
    const venueId = tally.venue?.id;
    const top = tally.cities.filter((city) => city.place.id !== venueId).slice(0, LABELED_CITIES);
    const keep = new Set(top.map((city) => city.place.id));

    for (const [id, label] of this.labels) {
      if (!keep.has(id)) {
        label.marker.remove();
        this.labels.delete(id);
      }
    }

    top.forEach((city, index) => {
      const r = radii.get(city.place.id) ?? 6;
      const existing = this.labels.get(city.place.id);
      if (existing) {
        existing.priority = 100 - index;
        existing.r = r;
        this.fillLabel(existing.inner, city);
        return;
      }
      const element = document.createElement('div');
      element.className = 'pointer-events-none h-0 w-0 transition-opacity duration-300';
      const inner = document.createElement('div');
      inner.className =
        'absolute top-0 -translate-y-1/2 whitespace-nowrap rounded-full font-semibold leading-tight shadow-[0_2px_10px_-2px_rgb(0_0_0/0.35)] transition-opacity duration-300 ' +
        'bg-[color-mix(in_srgb,var(--ia-bg)_78%,transparent)] text-[var(--ia-text)] backdrop-blur-[2px] ' +
        labelClasses(this.stage);
      element.appendChild(inner);
      this.fillLabel(inner, city);
      const marker = new this.ml.Marker({ element, anchor: 'center', opacityWhenCovered: '0' })
        .setLngLat([city.place.lon, city.place.lat])
        .addTo(this.map);
      this.labels.set(city.place.id, { marker, inner, priority: 100 - index, r, side: 'right' });
    });
    this.updateLabelOffsets();
  }

  private fillLabel(inner: HTMLElement, city: GlobeCity) {
    const text = `${city.place.name}\u2002${city.count}`;
    if (inner.dataset.text === text) return;
    inner.dataset.text = text;
    inner.replaceChildren();
    inner.append(city.place.name, '\u2002');
    const count = document.createElement('span');
    count.className = 'tabular-nums text-[var(--ia-accent)]';
    count.textContent = String(city.count);
    inner.appendChild(count);
  }

  private updateLabelOffsets() {
    for (const label of this.labels.values()) this.placeLabel(label, label.side);
  }

  /** Puts a label beside its bubble, on the right by default or the left to dodge a neighbour. */
  private placeLabel(label: Label, side: 'left' | 'right') {
    const offset = `${Math.round(zoomedRadius(label.r, this.map.getZoom()) + 6)}px`;
    label.side = side;
    label.inner.style.left = side === 'right' ? offset : '';
    label.inner.style.right = side === 'left' ? offset : '';
  }

  private syncVenue(tally: GlobeTally) {
    const venue = tally.venue;
    const key = venue ? venue.id : '';
    const here = venue ? tally.cities.find((city) => city.place.id === venue.id)?.count ?? 0 : 0;
    if (key !== this.venueKey) {
      this.venueKey = key;
      this.venueMarker?.remove();
      this.venueMarker = null;
      this.venueRing = null;
      if (!venue) return;

      const element = document.createElement('div');
      element.className = 'pointer-events-none h-0 w-0 transition-opacity duration-300';
      const dotSize = this.stage ? 'h-5 w-5' : 'h-4 w-4';
      element.innerHTML = `
        <span data-ring class="absolute left-0 top-0 ${this.stage ? 'h-11 w-11' : 'h-8 w-8'} -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--ia-text)] opacity-60"></span>
        <span class="absolute left-0 top-0 ${dotSize} -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--ia-text)] bg-[var(--ia-accent)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--ia-bg)_55%,transparent),0_0_22px_6px_color-mix(in_srgb,var(--ia-accent)_60%,transparent)]"></span>
        <span data-label class="absolute top-0 ${this.stage ? 'left-8' : 'left-6'} -translate-y-1/2 whitespace-nowrap rounded-full bg-[var(--ia-accent)] font-bold leading-tight text-[var(--ia-bg)] shadow-[0_4px_14px_-4px_rgb(0_0_0/0.45)] ${labelClasses(this.stage)}"></span>`;
      this.venueRing = element.querySelector<HTMLElement>('[data-ring]');
      this.venueMarker = new this.ml.Marker({ element, anchor: 'center', opacityWhenCovered: '0' })
        .setLngLat([venue.lon, venue.lat])
        .addTo(this.map);
    }
    const label = this.venueMarker?.getElement().querySelector<HTMLElement>('[data-label]');
    if (label && venue) label.textContent = here > 0 ? `${venue.name} · ${here}` : venue.name;
  }

  private pulseVenue(strength = 1) {
    if (!this.venueRing || this.options.reducedMotion || typeof this.venueRing.animate !== 'function') return;
    this.venueRing.animate(
      // `scale` composes with Tailwind's separate `translate` property, keeping the ring centred.
      [
        { scale: '1', opacity: 0.9 },
        { scale: String(1.6 + strength * 1.4), opacity: 0 },
      ],
      { duration: 1100, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    );
  }

  private readonly frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(100, now - (this.lastFrame || now));
    this.lastFrame = now;
    const motion = !this.options.reducedMotion;

    if (motion && this.stage && now >= this.pausedUntil && !this.map.isMoving()) {
      if (this.pausedUntil > 0) {
        this.pausedUntil = 0;
        this.swayOrigin = this.map.getCenter().lng;
        this.swayStart = now;
      }
      const center = this.map.getCenter();
      const lng = this.spin
        ? center.lng + (SPIN_DEG_PER_SEC * dt) / 1000
        : this.swayOrigin + this.swayDeg * Math.sin(((now - this.swayStart) / SWAY_PERIOD_MS) * Math.PI * 2);
      this.map.jumpTo({ center: [lng, center.lat] });
    }

    if (motion && this.hasArcs && now - this.lastComet >= COMET_FRAME_MS) {
      this.lastComet = now;
      const progress = cometProgress(now - this.startedAt);
      const gradient = cometGradient(progress, this.palette);
      this.map.setPaintProperty('comets', 'line-gradient', gradient);
      this.map.setPaintProperty('comet-glow', 'line-gradient', gradient);
      if (this.lastProgress < 1 && progress >= 1) this.pulseVenue(1);
      this.lastProgress = progress;
    } else if (motion && !this.hasArcs && this.venueRing && now - this.lastIdlePulse > COMET_PERIOD_MS * 0.7) {
      this.lastIdlePulse = now;
      this.pulseVenue(0.6);
    }

    if (motion && this.pops.size > 0) {
      for (const [id, start] of this.pops) {
        if (now < start) continue;
        const t = Math.min(1, (now - start) / POP_MS);
        this.map.setFeatureState({ source: 'cities', id }, { pop: Math.max(0, easeOutBack(t)) });
        if (t >= 1) this.pops.delete(id);
      }
    }

    if (now - this.lastCollide >= COLLIDE_MS) {
      this.lastCollide = now;
      this.resolveCollisions();
    }
  };

  /** Hides lower-priority labels that overlap a higher one or slide under the stats panel. */
  private resolveCollisions() {
    const bounds = this.container.getBoundingClientRect();
    const insetEdge = bounds.left + this.options.getInset();
    const kept: DOMRect[] = [];
    const venueLabel = this.venueMarker?.getElement().querySelector<HTMLElement>('[data-label]');
    if (venueLabel && this.venueMarker?.getElement().style.opacity !== '0') {
      kept.push(venueLabel.getBoundingClientRect());
    }
    const center = this.map.getCenter();
    const centerPx = this.map.project(center);
    const labels = [...this.labels.values()].sort((a, b) => b.priority - a.priority);
    for (const label of labels) {
      const outer = label.marker.getElement();
      if (outer.style.opacity === '0') continue;
      const at = label.marker.getLngLat();
      const fromCenter = angularDistance([at.lng, at.lat], [center.lng, center.lat]);
      if (fromCenter > LIMB_DEG) {
        label.inner.style.opacity = '0';
        continue;
      }
      // Near the limb, only the side facing the globe keeps the label on the sphere.
      const inward = this.map.project(at).x < centerPx.x ? 'right' : 'left';
      const fits = (rect: DOMRect) =>
        rect.left >= insetEdge - 4 &&
        rect.right <= bounds.right - 4 &&
        rect.top >= bounds.top &&
        rect.bottom <= bounds.bottom &&
        !kept.some(
          (other) =>
            rect.left < other.right + 4 &&
            rect.right > other.left - 4 &&
            rect.top < other.bottom + 2 &&
            rect.bottom > other.top - 2
        );
      let placed: DOMRect | null = null;
      const sides: ('left' | 'right')[] =
        fromCenter > LIMB_DEG - 26
          ? [inward]
          : label.side === 'right'
            ? ['right', 'left']
            : ['left', 'right'];
      for (const side of sides) {
        if (side !== label.side) this.placeLabel(label, side);
        const rect = label.inner.getBoundingClientRect();
        if (fits(rect)) {
          placed = rect;
          break;
        }
      }
      label.inner.style.opacity = placed ? '1' : '0';
      if (placed) kept.push(placed);
    }
  }
}
