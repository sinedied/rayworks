import { entity, anonymous, authenticated, uuid, text, int, boolean } from '@microsoft/rayfin-core';

@entity()
@anonymous('read', { exclude: ['score', 'correct'] })
@authenticated('read')
@authenticated(['create', 'update', 'delete'], { policy: (claims, item) => claims.sub.eq(item.owner_id) })
export class QuizQuestionParticipant {
  @uuid() id!: string;
  @uuid() question_id!: string;
  @uuid() run_id!: string;
  @uuid() room_id!: string;
  @text({ max: 200 }) owner_id!: string;
  @text({ max: 64 }) participantKey!: string;
  @text({ max: 80 }) participantName!: string;
  @text({ max: 110, unique: true }) membershipKey!: string;
  @boolean() scored!: boolean;
  @boolean() answered!: boolean;
  @boolean() correct!: boolean;
  @int() score!: number;
  @uuid({ optional: true }) acceptedSubmissionId?: string;
}
