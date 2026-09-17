import { blob, role } from '@microsoft/rayfin-core';

@blob()
@role('authenticated', '*', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class TripPhotos {
  owner_id!: string;
}
