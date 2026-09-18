import {
  authenticated,
  date,
  entity,
  one,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import { Trip } from './Trip.js';
import { TripDay } from './TripDay.js';

@entity()
@authenticated('*', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class TripPhoto {
  @uuid() id!: string;
  @text({ max: 300 }) storageName!: string;
  @text({ max: 120 }) contentType!: string;
  @text({ optional: true, max: 500 }) caption?: string;
  @date() createdAt!: Date;
  @uuid() trip_id!: string;
  @one(() => Trip, { optional: true }) trip?: Trip;
  @uuid({ optional: true }) tripDay_id?: string;
  @one(() => TripDay, { optional: true }) tripDay?: TripDay;
  @text({ max: 200 }) owner_id!: string;
}
