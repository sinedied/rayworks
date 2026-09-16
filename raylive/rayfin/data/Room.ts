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

import { Question } from './Question.js';

/**
 * A live Q&A room for one talk. `code` is the short slug the audience types or scans
 * (`/r/:code`), and the presenter drives the live view at `/present/:code`.
 *
 * Anonymous read is granted while the room is open so the audience and the embedded
 * live view work without signing in. See "Security model" in README.md.
 */
@entity()
@anonymous('read', {
  policy: (_claims, item) => item.isOpen.eq(true),
})
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('read', {
  policy: (claims, item) =>
    claims.sub.eq(item.owner_id).or(item.isOpen.eq(true)),
})
@authenticated('update', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('delete', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class Room {
  @uuid() id!: string;
  @text({ min: 1, max: 200 }) title!: string;
  @text({ optional: true, max: 500 }) description?: string;
  @text({ min: 4, max: 32, unique: true }) code!: string;
  /** Closing a room ends it: anonymous callers can no longer read it at all. */
  @boolean() isOpen!: boolean;
  /** Pauses new questions while keeping the live results visible. */
  @boolean() isAcceptingQuestions!: boolean;
  /**
   * Whether the Q&A feed is part of this room at all. Optional so the column can be added to
   * existing rows; `undefined` is treated as enabled.
   */
  @boolean({ optional: true, default: true }) qnaEnabled?: boolean;
  /** Named theme preset, or `custom` when the colours were hand-picked. */
  @text({ optional: true, max: 32 }) themePreset?: string;
  /** Replaces the Ray|Live wordmark on the audience and projected views. */
  @text({ optional: true, max: 60 }) brandTitle?: string;
  /**
   * Whether the projected view shows the join link, QR, and code. Stored on the room so the
   * projector, console, and phone remote agree. Optional: `undefined` means shown.
   */
  @boolean({ optional: true, default: true }) showJoinInfo?: boolean;
  @text({ optional: true, max: 9, regex: /^#[0-9a-fA-F]{6}$/ })
  themeBackground?: string;
  @text({ optional: true, max: 9, regex: /^#[0-9a-fA-F]{6}$/ })
  themeText?: string;
  @text({ optional: true, max: 9, regex: /^#[0-9a-fA-F]{6}$/ })
  themeAccent?: string;
  @date() createdAt!: Date;
  @text({ max: 200 }) owner_id!: string;
  @many(() => Question) questions?: Question[];
}
