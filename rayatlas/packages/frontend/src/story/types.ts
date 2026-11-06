import type { RouteMode, SiteRole } from '@rayfin-app/shared';

/** MapLibre camera for a chapter. `center` is `[longitude, latitude]`. */
export interface StoryCamera {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

/**
 * Which sites and routes a chapter (or metric) is about.
 *
 * Selection uses union semantics: a site matches when its code is listed OR its role is listed;
 * a route matches when its code is listed OR its mode is listed OR its code starts with a listed
 * prefix. An empty focus selects nothing.
 */
export interface StoryFocus {
  siteCodes?: string[];
  siteRoles?: SiteRole[];
  routeCodes?: string[];
  routeModes?: RouteMode[];
  routeCodePrefixes?: string[];
  /** Fit the camera to the focus bounds instead of flying to the fixed chapter camera. */
  fit?: boolean;
}

export type SiteMetricField = 'capacityTonnes' | 'outlets' | 'elevationMeters';
export type RouteMetricField = 'annualVolumeTonnes' | 'transitDays' | 'co2Tonnes';
export type MetricAggregate = 'sum' | 'max' | 'min' | 'avg';

export type MetricSource =
  | { kind: 'count'; entity: 'site' | 'route'; filter: StoryFocus }
  | { kind: MetricAggregate; entity: 'site'; field: SiteMetricField; filter: StoryFocus }
  | { kind: MetricAggregate; entity: 'route'; field: RouteMetricField; filter: StoryFocus };

export type MetricFormat = 'number' | 'tonnes' | 'days' | 'meters' | 'count';

export interface StoryMetric {
  /** Stable within its chapter; used to match draft label edits. */
  id: string;
  label: string;
  source: MetricSource;
  format: MetricFormat;
}

export interface StoryChapter {
  /** Stable chapter id; drafts and exported prompts match chapters by this id. */
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  camera: StoryCamera;
  focus: StoryFocus;
  metrics: StoryMetric[];
  /** Show 3D terrain while this chapter is active. */
  terrain?: boolean;
  /** Animate the focused routes while this chapter is active. */
  animateRoutes?: boolean;
  /** Camera flight duration hint in milliseconds. */
  duration?: number;
}

export interface Story {
  id: string;
  /** Bump when chapters change shape; local drafts for other versions are discarded. */
  version: number;
  title: string;
  subtitle: string;
  chapters: StoryChapter[];
}
