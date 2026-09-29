import { entity, anonymous, authenticated, uuid, text, set, date } from '@microsoft/rayfin-core';

@entity()
@anonymous('read')
@authenticated('read')
@authenticated(['create', 'update', 'delete'], { policy: (claims, item) => claims.sub.eq(item.owner_id) })
export class QuizRun {
  @uuid() id!: string;
  @uuid() room_id!: string;
  @text({ max: 200 }) owner_id!: string;
  @text({ max: 64 }) seriesKey!: string;
  @text({ max: 500 }) title!: string;
  @set('building', 'lobby', 'running', 'finished') state!: 'building' | 'lobby' | 'running' | 'finished';
  @date() createdAt!: Date;
  @date({ optional: true }) startedAt?: Date;
  @date({ optional: true }) endedAt?: Date;
}
