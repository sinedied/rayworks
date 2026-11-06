import {
  authenticated,
  date,
  decimal,
  entity,
  int,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

/**
 * A place in the supply chain told by the story: a farm, port, roastery,
 * distribution center, or customer cluster. Shared read-only reference data.
 */
@entity()
@authenticated('read')
export class Site {
  @uuid() id!: string;
  @text({ min: 1, max: 60 }) code!: string;
  @text({ min: 1, max: 120 }) name!: string;
  @set('origin', 'port', 'plant', 'distribution', 'customer')
  role!: 'origin' | 'port' | 'plant' | 'distribution' | 'customer';
  @text({ min: 1, max: 80 }) city!: string;
  @text({ min: 1, max: 80 }) country!: string;
  @decimal() latitude!: number;
  @decimal() longitude!: number;
  @text({ optional: true, max: 600 }) summary?: string;
  @int({ optional: true }) capacityTonnes?: number;
  @int({ optional: true }) outlets?: number;
  @int({ optional: true }) elevationMeters?: number;
  @date() updatedAt!: Date;
}
