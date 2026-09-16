import {
  entity,
  authenticated,
  uuid,
  text,
  boolean,
  date,
  one,
} from '@microsoft/rayfin-core';
import { anonymous } from '@microsoft/rayfin-core/experimental';

import { Room } from './Room.js';

/**
 * A question asked by an audience member.
 *
 * Anonymous callers may ask and read, but only the room owner can moderate.
 * `owner_id` is denormalized from the room because policies cannot traverse
 * relationships; hiding a question removes it from anonymous reads server-side.
 */
@entity()
@anonymous('create')
@anonymous('read', {
  policy: (_claims, item) => item.isHidden.eq(false),
})
@authenticated('create')
@authenticated('read', {
  policy: (claims, item) =>
    claims.sub.eq(item.owner_id).or(item.isHidden.eq(false)),
})
@authenticated('update', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('delete', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class Question {
  @uuid() id!: string;
  @text({ min: 1, max: 500 }) content!: string;
  /** Optional — questions are anonymous unless the asker types a name. */
  @text({ optional: true, max: 80 }) authorName?: string;
  @boolean() isAnswered!: boolean;
  /** Moderation flag: hidden questions disappear from anonymous reads. */
  @boolean() isHidden!: boolean;
  @date() createdAt!: Date;
  @uuid() room_id!: string;
  @one(() => Room) room?: Room;
  @text({ max: 200 }) owner_id!: string;
}
