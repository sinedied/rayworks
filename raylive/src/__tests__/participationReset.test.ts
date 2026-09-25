import { beforeEach, expect, it, vi } from 'vitest';

import { getActivity } from '@/services/activities';
import { submitChoice } from '@/services/answers';
import { askQuestion, upvoteQuestion } from '@/services/questions';
import { activityAnswerKey, getAnsweredActivityIds } from '@/services/identity';
import { activity, backend, client, data, question, room, seed } from './helpers/roomData';

vi.mock('@/services/rayfinClient', () => ({ getRayfinClient: () => client }));

beforeEach(() => {
  seed();
  data.Answer.rows.clear();
  data.Question.rows.set(question.id, { ...question, isHidden: false });
  data.Activity.rows.set(activity.id, {
    ...activity, state: 'live', answerResetId: 'current-reset', timeLimitSeconds: 0,
  });
});

it('records the current answer generation after a successful submission', async () => {
  const current = await getActivity(activity.id);
  await submitChoice(current, ['option-1']);
  expect(getAnsweredActivityIds().has(activityAnswerKey(activity.id, 'current-reset'))).toBe(true);
  expect(data.Answer.rows.size).toBe(1);
});

it.each(['resetting', 'draft', 'marker', 'restarted'])('rejects a stale submission: %s', async (change) => {
  const previous = await getActivity(activity.id);
  if (change === 'resetting') data.Room.rows.set(room.id, { ...room, isResetting: true });
  if (change === 'draft') data.Activity.rows.set(activity.id, { ...previous, state: 'draft' });
  if (change === 'marker') data.Activity.rows.set(activity.id, { ...previous, answerResetId: 'new-reset' });
  if (change === 'restarted') data.Activity.rows.set(activity.id, { ...previous, startedAt: new Date(Date.now() + 10000) });
  await expect(submitChoice(previous, ['option-1'])).rejects.toThrow();
  expect(backend.writes).toEqual([]);
});

it('checks quiz expiry against fresh server state', async () => {
  const previous = await getActivity(activity.id);
  data.Activity.rows.set(activity.id, {
    ...previous, startedAt: new Date(Date.now() - 60000), timeLimitSeconds: 1,
  });
  await expect(submitChoice(await getActivity(activity.id), ['option-1'])).rejects.toThrow('closed');
});

it('rejects stale Q&A asks and votes while a reset is pending', async () => {
  data.Room.rows.set(room.id, { ...room, isResetting: true });
  await expect(askQuestion(room, { content: 'Too late' })).rejects.toThrow('resetting');
  await expect(upvoteQuestion(question)).rejects.toThrow('resetting');
  expect(backend.writes).toEqual([]);
});

it('rejects a vote for a question removed by a completed reset', async () => {
  data.Question.rows.clear();
  await expect(upvoteQuestion(question)).rejects.toThrow('no longer available');
  expect(backend.writes).toEqual([]);
});
