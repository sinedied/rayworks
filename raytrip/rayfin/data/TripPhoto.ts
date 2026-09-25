import {
  authenticated,
  date,
  entity,
  int,
  one,
  text,
  uuid,
} from '@microsoft/rayfin-core';

import { Trip } from './Trip.js';
import { TripDay } from './TripDay.js';

@entity()
@authenticated(['create', 'read', 'delete'], {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('update', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
  exclude: ['owner_id', 'trip_id', 'tripDay_id'],
})
export class TripPhoto {
  @uuid() id!: string;
  @text({ max: 300 }) storageName!: string;
  @text({ max: 120 }) contentType!: string;
  @text({ optional: true, max: 500 }) caption?: string;
  @text({ optional: true, max: 16 }) storageBackend?: string;
  @text({ optional: true, max: 16 }) uploadState?: string;
  @text({ optional: true, max: 255 }) fileName?: string;
  @int({ optional: true, min: 1, max: 524288 }) byteLength?: number;
  @int({ optional: true, min: 1, max: 1600 }) width?: number;
  @int({ optional: true, min: 1, max: 1600 }) height?: number;
  @int({ optional: true, min: 1, max: 175 }) chunkCount?: number;
  @text({ optional: true, max: 64 }) sha256?: string;
  @date() createdAt!: Date;
  @uuid() trip_id!: string;
  @one(() => Trip, { optional: true }) trip?: Trip;
  @uuid({ optional: true }) tripDay_id?: string;
  @one(() => TripDay, { optional: true }) tripDay?: TripDay;
  @text({ max: 200 }) owner_id!: string;
}
