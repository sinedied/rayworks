import {
  entity,
  authenticated,
  anonymous,
  uuid,
  text,
  boolean,
  int,
  date,
  set,
  one,
  many,
} from '@microsoft/rayfin-core';

import { ActivityOption } from './ActivityOption.js';
import { Room } from './Room.js';

/** Poll and quiz kinds an activity can take. */
export type ActivityKind =
  | 'multipleChoice'
  | 'wordCloud'
  | 'rating'
  | 'openText'
  | 'ranking'
  | 'quiz';

/** `draft` is presenter-only, `live` accepts answers, `ended` freezes them. */
export type ActivityState = 'draft' | 'live' | 'ended';

/**
 * One poll or quiz question inside a room.
 *
 * Anonymous callers may only read activities that have left `draft`, so questions the
 * presenter is still preparing — and upcoming quiz questions — never reach the audience.
 * At most one activity per room is `live` at a time; the live view follows it.
 */
@entity()
@anonymous('read', {
  policy: (_claims, item) => item.state.neq('draft'),
})
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('read', {
  policy: (claims, item) =>
    claims.sub.eq(item.owner_id).or(item.state.neq('draft')),
})
@authenticated('update', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('delete', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class Activity {
  @uuid() id!: string;
  @set('multipleChoice', 'wordCloud', 'rating', 'openText', 'ranking', 'quiz')
  kind!: ActivityKind;
  @text({ min: 1, max: 500 }) prompt!: string;
  @set('draft', 'live', 'ended') state!: ActivityState;
  @int() position!: number;
  /** Whether the audience sees results on their own device. */
  @boolean() showResults!: boolean;
  /** Multi-select for choice/quiz, or several submissions for word clouds. */
  @boolean() allowMultiple!: boolean;
  /**
   * Lets a participant replace their answer. Anonymous callers cannot update rows, so a change
   * writes a new submission and the tally keeps only the newest one per participant.
   */
  @boolean({ optional: true, default: false }) allowChangeAnswer?: boolean;
  /**
   * True while the activity is open but the question has not started: attendees can set a
   * nickname without seeing the question. Cleared when the presenter starts the question.
   */
  @boolean({ optional: true, default: false }) isPrepared?: boolean;
  /** Top of the rating scale; ignored by other kinds. */
  @int({ optional: true }) maxRating?: number;
  /** Quiz countdown in seconds; 0 or absent means untimed. */
  @int({ optional: true }) timeLimitSeconds?: number;
  /** Stamped when the activity goes live; anchors quiz timing. */
  @date({ optional: true }) startedAt?: Date;
  @date() createdAt!: Date;
  @uuid() room_id!: string;
  @one(() => Room) room?: Room;
  @text({ max: 200 }) owner_id!: string;
  @many(() => ActivityOption) options?: ActivityOption[];
}
