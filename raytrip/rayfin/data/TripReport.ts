import {
  authenticated,
  date,
  entity,
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
  @text({ min: 1, max: 4000 }) summary!: string;
  @text({ min: 1, max: 4000 }) keyTakeaways!: string;
  @set('draft', 'finalized') status!: 'draft' | 'finalized';
  @text({ unique: true, max: 64 }) shareId!: string;
  @date() generatedAt!: Date;
  @date({ optional: true }) finalizedAt?: Date;
  @uuid() trip_id!: string;
  @one(() => Trip, { optional: true }) trip?: Trip;
  @text({ max: 200 }) owner_id!: string;
}
