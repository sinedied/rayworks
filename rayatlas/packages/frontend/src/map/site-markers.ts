import type { SiteRecord, SiteRole } from '@rayfin-app/shared';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';

import type { AtlasMapPalette } from './atlas-style';
import { LABEL_SIDES, labelOffset, placeLabels, type LabelCandidate, type LabelRect, type LabelSide } from './label-collision';
import type { LabelBlock } from './story-layers';

type MarkerConstructor = typeof Marker;

const ROLE_LABEL: Record<SiteRole, string> = {
  origin: 'Origin',
  port: 'Port',
  plant: 'Roastery',
  distribution: 'Distribution',
  customer: 'Cafés',
};

const ROLE_PRIORITY: Record<SiteRole, number> = {
  plant: 50,
  origin: 40,
  port: 30,
  distribution: 20,
  customer: 10,
};

/** Dot diameter in CSS pixels; customer clusters grow with the outlets they serve. */
export function siteDotSize(site: Pick<SiteRecord, 'role' | 'outlets'>): number {
  if (site.role === 'customer') {
    const outlets = typeof site.outlets === 'number' && site.outlets > 0 ? site.outlets : 0;
    return Math.round(7 + Math.sqrt(outlets) * 1.45);
  }
  return site.role === 'plant' ? 14 : 11;
}

export function siteLabelMeta(site: SiteRecord): string {
  if (site.role === 'origin' && typeof site.elevationMeters === 'number') {
    return `${ROLE_LABEL.origin} · ${new Intl.NumberFormat('en-US').format(site.elevationMeters)} m`;
  }
  if (site.role === 'customer' && typeof site.outlets === 'number') {
    return `${site.outlets} café outlets`;
  }
  if (site.role === 'distribution') return 'Distribution center';
  if (site.role === 'plant') return `${ROLE_LABEL.plant} · ${site.city}`;
  return `${ROLE_LABEL[site.role]} · ${site.country}`;
}

/** Short label title: cities for café clusters and hubs, full names for the sites the story names. */
export function siteLabelName(site: SiteRecord): string {
  if (site.role === 'customer') return site.city;
  if (site.role === 'distribution') return `${site.city} hub`;
  return site.name;
}

/** Below this zoom, dense European roles stay unlabeled so the globe view reads cleanly. */
const LABEL_MIN_ZOOM: Record<SiteRole, number> = {
  origin: 0,
  port: 0,
  plant: 0,
  distribution: 3.4,
  customer: 3.4,
};

export interface LabelArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type MarkerState = 'focus' | 'dim' | 'rest';

interface SiteMarker {
  site: SiteRecord;
  marker: Marker;
  root: HTMLElement;
  label: HTMLElement;
  size: number;
  state: MarkerState;
}

const LABEL_GAP = 8;
/** Page elements marked `data-map-obstacle` (e.g. the current chapter rail label) keep labels clear. */
const OBSTACLE_SELECTOR = '[data-map-obstacle]';
const OBSTACLE_GAP = 8;

/**
 * HTML site markers: role-colored dots with IBM Plex labels. Focused sites get the Atlas yellow
 * ring and a label; the rest dim. Labels are placed without overlaps after the camera settles.
 */
export class SiteMarkers {
  private readonly markers: SiteMarker[] = [];
  private labelFrame = 0;
  /** Insets where labels must not go, e.g. under the story column. */
  private labelInsets: LabelArea = { top: 0, right: 0, bottom: 0, left: 0 };

  constructor(
    MarkerClass: MarkerConstructor,
    private readonly map: MapLibreMap,
    sites: readonly SiteRecord[],
    palette: AtlasMapPalette,
    /** Receives the screen footprint of every focused marker and its placed label. */
    private readonly onLabelsPlaced?: (blocks: LabelBlock[]) => void,
  ) {
    for (const site of sites) {
      if (!Number.isFinite(site.longitude) || !Number.isFinite(site.latitude)) continue;
      const size = siteDotSize(site);
      const element = document.createElement('div');
      element.className = 'site-marker-anchor';
      element.setAttribute('aria-hidden', 'true');
      const root = document.createElement('div');
      root.className = 'site-marker';
      root.dataset.role = site.role;
      root.dataset.state = 'rest';
      element.style.setProperty('--site-size', `${size}px`);
      element.style.setProperty('--site-color', palette.marker[site.role]);
      element.style.setProperty('--site-stroke', palette.markerStroke);

      const dot = document.createElement('span');
      dot.className = 'site-marker-dot';
      const label = document.createElement('span');
      label.className = 'site-marker-label';
      const name = document.createElement('span');
      name.className = 'site-marker-name';
      name.textContent = siteLabelName(site);
      const meta = document.createElement('span');
      meta.className = 'site-marker-meta';
      meta.textContent = siteLabelMeta(site);
      label.append(name, meta);
      root.append(dot, label);
      element.append(root);

      const marker = new MarkerClass({ element, anchor: 'center', opacityWhenCovered: 0, subpixelPositioning: true })
        .setLngLat([site.longitude, site.latitude])
        .addTo(map);
      this.markers.push({ site, marker, root, label, size, state: 'rest' });
    }
  }

  /** `rest` shows every site evenly without labels (title card); otherwise focus vs dim. */
  setFocus(siteCodes: ReadonlySet<string> | null) {
    for (const item of this.markers) {
      const state: MarkerState = siteCodes === null ? 'rest' : siteCodes.has(item.site.code) ? 'focus' : 'dim';
      if (state !== item.state) {
        item.state = state;
        item.root.dataset.state = state;
      }
    }
    this.scheduleLabels();
  }

  setLabelInsets(insets: LabelArea) {
    this.labelInsets = insets;
    this.scheduleLabels();
  }

  setMoving(moving: boolean) {
    for (const item of this.markers) item.root.classList.toggle('is-moving', moving);
    if (!moving) this.scheduleLabels();
  }

  scheduleLabels() {
    cancelAnimationFrame(this.labelFrame);
    this.labelFrame = requestAnimationFrame(() => this.placeLabels());
  }

  private placeLabels() {
    const canvas = this.map.getCanvas();
    const { top, right, bottom, left } = this.labelInsets;
    const viewport = { width: canvas.clientWidth - left - right, height: canvas.clientHeight - top - bottom };
    const zoom = this.map.getZoom();
    const candidates: LabelCandidate[] = [];
    const obstacles: LabelRect[] = [];
    for (const item of this.markers) {
      const projected = this.map.project([item.site.longitude, item.site.latitude]);
      const point = { x: projected.x - left, y: projected.y - top };
      const half = item.size / 2;
      obstacles.push({ x: point.x - half, y: point.y - half, width: item.size, height: item.size });
      if (item.state !== 'focus' || zoom < LABEL_MIN_ZOOM[item.site.role]) continue;
      const width = item.label.offsetWidth;
      const height = item.label.offsetHeight;
      if (!width || !height) continue;
      candidates.push({
        id: item.site.code,
        priority: ROLE_PRIORITY[item.site.role] + (item.site.outlets ?? 0) / 100,
        options: LABEL_SIDES.map((side) => {
          const offset = labelOffset(side, half, LABEL_GAP, width, height);
          return { side, x: point.x + offset.x, y: point.y + offset.y, width, height };
        }),
      });
    }
    const canvasRect = canvas.getBoundingClientRect();
    for (const element of canvas.ownerDocument.querySelectorAll<HTMLElement>(OBSTACLE_SELECTOR)) {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      obstacles.push({
        x: rect.left - canvasRect.left - left - OBSTACLE_GAP,
        y: rect.top - canvasRect.top - top - OBSTACLE_GAP,
        width: rect.width + OBSTACLE_GAP * 2,
        height: rect.height + OBSTACLE_GAP * 2,
      });
    }
    const placed = placeLabels(candidates, viewport, obstacles);
    const blocks: LabelBlock[] = [];
    for (const item of this.markers) {
      const side = placed.get(item.site.code) ?? 'hidden';
      if (item.root.dataset.label !== side) item.root.dataset.label = side;
      if (item.state === 'focus') blocks.push(this.labelBlock(item, side === 'hidden' ? null : side));
    }
    this.onLabelsPlaced?.(blocks);
  }

  /** The marker dot plus its label, relative to the site's projected point. */
  private labelBlock(item: SiteMarker, side: LabelSide | null): LabelBlock {
    const half = item.size / 2;
    let x = -half;
    let y = -half;
    let right = half;
    let bottom = half;
    if (side) {
      const width = item.label.offsetWidth;
      const height = item.label.offsetHeight;
      const label = labelOffset(side, half, LABEL_GAP, width, height);
      x = Math.min(x, label.x);
      y = Math.min(y, label.y);
      right = Math.max(right, label.x + width);
      bottom = Math.max(bottom, label.y + height);
    }
    return {
      lngLat: [item.site.longitude, item.site.latitude],
      x,
      y,
      width: right - x,
      height: bottom - y,
    };
  }

  destroy() {
    cancelAnimationFrame(this.labelFrame);
    for (const item of this.markers) item.marker.remove();
    this.markers.length = 0;
  }
}
