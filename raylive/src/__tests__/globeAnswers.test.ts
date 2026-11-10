import { beforeEach, expect, it, vi } from 'vitest';

import { getActivity } from '@/services/activities';
import { listAnswers, submitPlace } from '@/services/answers';
import { activityAnswerKey, getAnsweredActivityIds } from '@/services/identity';
import { tallyAnswers } from '@/lib/aggregate';
import { activity, backend, client, data, seed } from './helpers/roomData';

vi.mock('@/services/rayfinClient', () => ({ getRayfinClient: () => client }));

beforeEach(() => {
  seed();
  data.Answer.rows.clear();
  data.Activity.rows.set(activity.id, {
    ...activity, kind: 'globe', state: 'live', allowChangeAnswer: true,
    answerResetId: 'current-reset', timeLimitSeconds: undefined, venuePlaceId: '2988507',
  });
});

it('stores one row per submission with only the city id', async () => {
  const current = await getActivity(activity.id);
  await submitPlace(current, ' 5128581 ');
  const rows = [...data.Answer.rows.values()];
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ placeId: '5128581', activity_id: activity.id });
  expect(rows[0].submissionId).toBeTruthy();
  expect(rows[0]).not.toHaveProperty('textValue');
  expect(getAnsweredActivityIds().has(activityAnswerKey(activity.id, 'current-reset'))).toBe(true);
});

it('keeps only the newest city when a participant changes their answer', async () => {
  const current = await getActivity(activity.id);
  await submitPlace(current, '5128581');
  await new Promise((resolve) => setTimeout(resolve, 2));
  await submitPlace(current, '2643743');
  const answers = await listAnswers(activity.room_id, activity.id);
  expect(answers).toHaveLength(2);
  const tallied = tallyAnswers({ ...current, allowMultiple: true }, answers);
  expect(tallied.map((answer) => answer.placeId)).toEqual(['2643743']);
});

it.each(['', 'Paris', '1'.repeat(21)])('rejects a malformed city %j without writing', async (placeId) => {
  await expect(submitPlace(await getActivity(activity.id), placeId)).rejects.toThrow('Pick a city');
  expect(backend.writes).toEqual([]);
});

it('rejects a city for another activity kind', async () => {
  const current = await getActivity(activity.id);
  await expect(submitPlace({ ...current, kind: 'rating' }, '5128581')).rejects.toThrow();
  expect(backend.writes).toEqual([]);
});
