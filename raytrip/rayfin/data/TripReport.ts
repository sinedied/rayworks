import {
  authenticated,
  boolean,
  date,
  entity,
  int,
  one,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import { Trip } from './Trip.js';

@entity()
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('read', {
  policy: (claims, item) =>
    claims.sub.eq(item.owner_id).or(item.status.eq('finalized')),
})
@authenticated(['update', 'delete'], {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class TripReport {
  @uuid() id!: string;
  @text({ min: 1, max: 160 }) title!: string;
  @text({ min: 1, max: 2500, optional: true }) content?: string;
  @text({ min: 1, max: 4000, optional: true }) summary?: string;
  @text({ min: 1, max: 4000, optional: true }) keyTakeaways?: string;
  @boolean({ optional: true, default: false }) includePhotoHeader?: boolean;
  @int({ optional: true, min: 1, max: 32768 }) headerImageBytes?: number;
  @int({ optional: true, min: 1, max: 1200 }) headerImageWidth?: number;
  @int({ optional: true, min: 1, max: 360 }) headerImageHeight?: number;
  @text({ optional: true, max: 64 }) headerImageHash?: string;
  @text({ optional: true, max: 4000 }) headerImagePart01?: string;
  @text({ optional: true, max: 4000 }) headerImagePart02?: string;
  @text({ optional: true, max: 4000 }) headerImagePart03?: string;
  @text({ optional: true, max: 4000 }) headerImagePart04?: string;
  @text({ optional: true, max: 4000 }) headerImagePart05?: string;
  @text({ optional: true, max: 4000 }) headerImagePart06?: string;
  @text({ optional: true, max: 4000 }) headerImagePart07?: string;
  @text({ optional: true, max: 4000 }) headerImagePart08?: string;
  @text({ optional: true, max: 4000 }) headerImagePart09?: string;
  @text({ optional: true, max: 4000 }) headerImagePart10?: string;
  @text({ optional: true, max: 4000 }) headerImagePart11?: string;
  @set('draft', 'finalized') status!: 'draft' | 'finalized';
  @text({ unique: true, max: 64 }) shareId!: string;
  @date() generatedAt!: Date;
  @date({ optional: true }) finalizedAt?: Date;
  @uuid() trip_id!: string;
  @one(() => Trip, { optional: true }) trip?: Trip;
  @text({ max: 200 }) owner_id!: string;
}

// SDK decorators use undefined for optional fields; SQL also returns and accepts null.
export type TripReportRecord = {
  [K in keyof TripReport]: undefined extends TripReport[K] ? TripReport[K] | null : TripReport[K];
};
