import { entity, anonymous, authenticated, uuid, text, date } from '@microsoft/rayfin-core';

@entity()
@anonymous(['create', 'read'])
@authenticated(['create', 'read'])
@authenticated('delete', { policy: (claims, item) => claims.sub.eq(item.owner_id) })
export class QuizParticipant {
  @uuid() id!: string;
  @uuid() run_id!: string;
  @uuid() room_id!: string;
  @text({ max: 200 }) owner_id!: string;
  @text({ max: 64 }) participantKey!: string;
  @text({ max: 80 }) participantName!: string;
  @text({ max: 110, unique: true }) joinKey!: string;
  @date() createdAt!: Date;
}
