import {
  authenticated,
  date,
  entity,
  one,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import { Trip } from './Trip.js';

@entity()
@authenticated('*', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class TripDay {
  @uuid() id!: string;
  @date() day!: Date;
  @text({ optional: true, max: 160 }) title?: string;
  @text({ min: 1, max: 4000 }) notes!: string;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
  @uuid() trip_id!: string;
  @one(() => Trip, { optional: true }) trip?: Trip;
  @text({ max: 200 }) owner_id!: string;
}
