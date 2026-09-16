import {
  entity,
  authenticated,
  uuid,
  text,
  date,
  one,
} from '@microsoft/rayfin-core';
import { anonymous } from '@microsoft/rayfin-core/experimental';

import { Question } from './Question.js';

/**
 * One upvote on a question.
 *
 * Vote totals are aggregated client-side from these rows: the fluent client has no
 * `count()`, and letting anonymous callers increment a denormalized counter on
 * `Question` would make the tally forgeable. `room_id` is denormalized so a live view
 * can fetch every vote for a room in a single query.
 *
 * `voterKey` is a browser-local id used for best-effort de-duplication. It stays readable by
 * anonymous callers because a create mutation selects back every field it writes — excluding it
 * would make upvoting fail with `AUTH_NOT_AUTHORIZED`.
 */
@entity()
@anonymous('create')
@anonymous('read')
@authenticated('create')
@authenticated('read')
@authenticated('delete', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class Vote {
  @uuid() id!: string;
  @text({ min: 1, max: 64 }) voterKey!: string;
  @date() createdAt!: Date;
  @uuid() question_id!: string;
  @one(() => Question) question?: Question;
  @uuid() room_id!: string;
  @text({ max: 200 }) owner_id!: string;
}
