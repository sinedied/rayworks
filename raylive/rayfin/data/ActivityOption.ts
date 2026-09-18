import {
  entity,
  authenticated,
  anonymous,
  uuid,
  text,
  boolean,
  int,
  one,
} from '@microsoft/rayfin-core';

import { Activity } from './Activity.js';

/**
 * A selectable choice on a multiple-choice, ranking, or quiz activity.
 *
 * `isCorrect` is the quiz answer key and is **excluded from anonymous reads**, so the
 * audience cannot inspect it before answering. When the presenter reveals the answer they
 * flip `revealedCorrect`, which is public — field-level visibility is static and cannot
 * depend on activity state, so the reveal needs its own field.
 */
@entity()
@anonymous('read', {
  exclude: ['isCorrect'],
})
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('read')
@authenticated('update', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('delete', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class ActivityOption {
  @uuid() id!: string;
  @text({ min: 1, max: 200 }) label!: string;
  @int() position!: number;
  /** Quiz answer key — never readable by anonymous callers. */
  @boolean() isCorrect!: boolean;
  /** Public copy of the answer key, set when the presenter reveals results. */
  @boolean() revealedCorrect!: boolean;
  @uuid() activity_id!: string;
  @one(() => Activity) activity?: Activity;
  @uuid() room_id!: string;
  @text({ max: 200 }) owner_id!: string;
}
