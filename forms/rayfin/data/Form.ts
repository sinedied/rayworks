import {
  entity,
  authenticated,
  uuid,
  text,
  boolean,
  date,
  many,
} from '@microsoft/rayfin-core';
import { anonymous } from '@microsoft/rayfin-core/experimental';
import { FormField } from './FormField.js';

/**
 * A shareable form. `shareToken` is the unguessable slug used in share links (`/f/:token`).
 *
 * Anonymous read is granted for open forms so recipients can fill one in without signing in.
 * See README "Security model": this requires the `anonymous-data-access` CLI feature flag.
 */
@entity()
@anonymous('read', {
  policy: (_claims, item) => item.isClosed.eq(false),
})
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('read', {
  policy: (claims, item) =>
    claims.sub.eq(item.owner_id).or(item.isClosed.eq(false)),
})
@authenticated('update', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('delete', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class Form {
  @uuid() id!: string;
  @text({ min: 1, max: 200 }) title!: string;
  @text({ optional: true, max: 2000 }) description?: string;
  @text({ min: 8, max: 64, unique: true }) shareToken!: string;
  @boolean() isClosed!: boolean;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
  @text({ max: 200 }) owner_id!: string;
  @many(() => FormField) fields?: FormField[];
}
