import { authenticated, entity, int, one, text, uuid } from '@microsoft/rayfin-core';
import { TripPhoto } from './TripPhoto.js';

@entity()
@authenticated(['create', 'read', 'delete'], {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class TripPhotoChunk {
  @uuid() id!: string;
  @uuid() photo_id!: string;
  @one(() => TripPhoto, { optional: true }) photo?: TripPhoto;
  @int({ min: 0, max: 174 }) partIndex!: number;
  @text({ unique: true, max: 48 }) partKey!: string;
  @text({ min: 4, max: 4000 }) content!: string;
  @text({ max: 200 }) owner_id!: string;
}
