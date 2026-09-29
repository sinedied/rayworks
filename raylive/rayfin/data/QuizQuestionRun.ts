import { entity, anonymous, authenticated, uuid, text, set, int, boolean, date } from '@microsoft/rayfin-core';

export type QuizQuestionState = 'pending' | 'lobby' | 'starting' | 'running' | 'closing' | 'closed' | 'revealing' | 'revealed' | 'cleared';

@entity()
@anonymous('read', { policy: (_claims, item) => item.published.eq(true) })
@authenticated('read', { policy: (claims, item) => claims.sub.eq(item.owner_id).or(item.published.eq(true)) })
@authenticated(['create', 'update', 'delete'], { policy: (claims, item) => claims.sub.eq(item.owner_id) })
export class QuizQuestionRun {
  @uuid() id!: string;
  @uuid() run_id!: string;
  @uuid() activity_id!: string;
  @uuid() room_id!: string;
  @text({ max: 200 }) owner_id!: string;
  @text({ max: 80, unique: true }) snapshotKey!: string;
  @text({ max: 500 }) prompt!: string;
  @int() position!: number;
  @int() timeLimitSeconds!: number;
  @boolean() allowMultiple!: boolean;
  @boolean() allowChangeAnswer!: boolean;
  @boolean() showResults!: boolean;
  @boolean() published!: boolean;
  @set('pending', 'lobby', 'starting', 'running', 'closing', 'closed', 'revealing', 'revealed', 'cleared')
  state!: QuizQuestionState;
  @date({ optional: true }) startedAt?: Date;
  @date({ optional: true }) closedAt?: Date;
  @date({ optional: true }) revealedAt?: Date;
}
