import { role } from '@microsoft/rayfin-core';
import { blob, StorageObject } from '@microsoft/rayfin-core/experimental';

@blob()
@role('authenticated', '*', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class TripPhotos extends StorageObject {}
