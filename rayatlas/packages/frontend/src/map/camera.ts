import type { NetworkData } from '@rayfin-app/shared';

import { networkBounds, type LngLatBounds } from '@/lib/network';
import { roundCamera } from '@/story/draft';
import type { StoryScene } from '@/story/scenes';
import type { StoryCamera } from '@/story/types';

import { resolveFocusCodes } from './story-layers';

export interface CameraPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const ZERO_PADDING: CameraPadding = { top: 0, right: 0, bottom: 0, left: 0 };

/** Where a scene wants the camera: a fixed view, or bounds to frame with the scene's bearing/pitch. */
export type CameraTarget =
  | { kind: 'camera'; camera: StoryCamera }
  | { kind: 'bounds'; bounds: LngLatBounds; bearing: number; pitch: number; fallback: StoryCamera };

export function sceneCameraTarget(scene: StoryScene, network: NetworkData): CameraTarget {
  if (!scene.fit) return { kind: 'camera', camera: scene.camera };
  const codes = resolveFocusCodes(network, scene.focus);
  const bounds = networkBounds(network, { siteCodes: [...codes.siteCodes], routeCodes: codes.routeCodes });
  if (!bounds) return { kind: 'camera', camera: scene.camera };
  return { kind: 'bounds', bounds, bearing: scene.camera.bearing, pitch: scene.camera.pitch, fallback: scene.camera };
}

/** Globe flights need a gentler arc than Mercator: too high a curve zooms out to space. */
export function flightCurve(fromZoom: number, toZoom: number): number {
  return Math.abs(toZoom - fromZoom) > 6 ? 1.6 : 1.25;
}

export function samePadding(a: CameraPadding, b: CameraPadding): boolean {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}

/** Minimal camera surface read by `readCamera`, so it is testable without WebGL. */
export interface CameraSource {
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  getBearing(): number;
  getPitch(): number;
}

/** The live camera, rounded for storage and export. Longitude is wrapped into [-180, 180]. */
export function readCamera(map: CameraSource): StoryCamera {
  const center = map.getCenter();
  let lng = center.lng;
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return roundCamera({
    center: [lng, center.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  });
}

/** "1.85° N, 76.05° W" for a camera readout. */
export function formatCoordinates([lng, lat]: [number, number]): string {
  const format = (value: number) => Math.abs(value).toFixed(2);
  return `${format(lat)}° ${lat >= 0 ? 'N' : 'S'}, ${format(lng)}° ${lng >= 0 ? 'E' : 'W'}`;
}
