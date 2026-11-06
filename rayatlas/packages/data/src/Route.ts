import {
  authenticated,
  date,
  entity,
  int,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

/**
 * A leg between two sites, referenced by `Site.code`. Shared read-only
 * reference data.
 */
@entity()
@authenticated('read')
export class Route {
  @uuid() id!: string;
  @text({ min: 1, max: 60 }) code!: string;
  @text({ min: 1, max: 120 }) name!: string;
  @set('sea', 'rail', 'road', 'air')
  mode!: 'sea' | 'rail' | 'road' | 'air';
  @text({ min: 1, max: 60 }) originCode!: string;
  @text({ min: 1, max: 60 }) destinationCode!: string;
  /** JSON array of intermediate `[longitude, latitude]` points. */
  @text({ optional: true, max: 4000 }) waypoints?: string;
  @int() annualVolumeTonnes!: number;
  @int() transitDays!: number;
  @int({ optional: true }) co2Tonnes?: number;
  @date() updatedAt!: Date;
}
