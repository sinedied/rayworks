import {
  entity,
  authenticated,
  anonymous,
  uuid,
  text,
  boolean,
  int,
  date,
  one,
} from '@microsoft/rayfin-core';

import { Activity } from './Activity.js';
import { ActivityOption } from './ActivityOption.js';

/**
 * One submitted answer. Multi-select and ranking activities produce several rows per
 * participant — one per option — so every activity kind shares this shape.
 *
 * `participantKey` is a browser-local id used to group a participant's answers, de-duplicate
 * submissions, and build leaderboards. It is deliberately **readable by anonymous callers**:
 * the audience needs it to keep only each participant's latest submission when tallying, and
 * a create mutation selects back every field it writes — excluding it would make submitting an
 * answer fail with `AUTH_NOT_AUTHORIZED`. It is a random pseudonymous id, not a credential.
 */
@entity()
@anonymous('create')
@anonymous('read', {
  policy: (_claims, item) => item.isHidden.eq(false),
})
@authenticated('create')
@authenticated('read')
@authenticated('update', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('delete', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class Answer {
  @uuid() id!: string;
  @text({ min: 1, max: 64 }) participantKey!: string;
  /**
   * Shared by every row written in one submission, so a changed answer supersedes the previous
   * one as a whole. Optional because rows created before answer-changing existed have none.
   */
  @uuid({ optional: true }) submissionId?: string;
  /** Nickname shown on quiz leaderboards. */
  @text({ optional: true, max: 80 }) participantName?: string;
  /** Set for choice, ranking, and quiz answers. */
  @uuid({ optional: true }) option_id?: string;
  @one(() => ActivityOption, { optional: true }) option?: ActivityOption;
  /** Set for word cloud and open text answers. */
  @text({ optional: true, max: 500 }) textValue?: string;
  /** Set for rating answers. */
  @int({ optional: true }) ratingValue?: number;
  /** 1-based position for ranking answers. */
  @int({ optional: true }) rankPosition?: number;
  /** Milliseconds between the activity going live and this answer, for quiz scoring. */
  @int({ optional: true }) elapsedMs?: number;
  /** Moderation flag for open text answers. */
  @boolean() isHidden!: boolean;
  @date() createdAt!: Date;
  @uuid() activity_id!: string;
  @one(() => Activity) activity?: Activity;
  @uuid() room_id!: string;
  @text({ max: 200 }) owner_id!: string;
}
