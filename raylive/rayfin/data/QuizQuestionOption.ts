import { entity, anonymous, authenticated, uuid, text, int, boolean } from '@microsoft/rayfin-core';

@entity()
@anonymous('read', { exclude: ['isCorrect'], policy: (_claims, item) => item.published.eq(true) })
@authenticated('read')
@authenticated(['create', 'update', 'delete'], { policy: (claims, item) => claims.sub.eq(item.owner_id) })
export class QuizQuestionOption {
  @uuid() id!: string;
  @uuid() question_id!: string;
  @uuid() run_id!: string;
  @uuid() activity_id!: string;
  @uuid() option_id!: string;
  @uuid() room_id!: string;
  @text({ max: 200 }) owner_id!: string;
  @text({ max: 80, unique: true }) snapshotKey!: string;
  @text({ max: 200 }) label!: string;
  @int() position!: number;
  @boolean() isCorrect!: boolean;
  @boolean() revealedCorrect!: boolean;
  @boolean() published!: boolean;
}
