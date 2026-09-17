import {
  authenticated,
  date,
  entity,
  set,
  text,
  uuid,
} from '@microsoft/rayfin-core';

@entity()
@authenticated('*', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class Trip {
  @uuid() id!: string;
  @text({ min: 1, max: 160 }) title!: string;
  @text({ max: 160 }) destination!: string;
  @text({ optional: true, max: 600 }) purpose?: string;
  @date() startDate!: Date;
  @date() endDate!: Date;
  @set('draft', 'active', 'completed')
  status!: 'draft' | 'active' | 'completed';
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
  @text({ max: 200 }) owner_id!: string;
}
