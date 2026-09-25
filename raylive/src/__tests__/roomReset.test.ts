import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRoomResponses } from '@/services/roomReset';
import { clearAnswers, listActivities, listOptions } from '@/services/activities';
import { listAnswers } from '@/services/answers';
import { listQuestions, listVotes } from '@/services/questions';
import { readAll } from '@/services/paging';
import { activity, answer, backend, client, data, option, question, room, seed, vote } from './helpers/roomData';

vi.mock('@/services/rayfinClient', () => ({ getRayfinClient: () => client }));

beforeEach(seed);

describe('resetRoomResponses', () => {
  it('clears every page, including hidden data, while preserving the room and configuration', async () => {
    data.Room.rows.set(room.id, { ...room, isOpen: false, qnaEnabled: false });
    for (let i = 0; i < 205; i++) {
      data.Answer.rows.set(`answer-${i}`, { ...answer, id: `answer-${i}`, submissionId: `submission-${i}` });
      data.Question.rows.set(`question-${i}`, { ...question, id: `question-${i}` });
      data.Vote.rows.set(`vote-${i}`, { ...vote, id: `vote-${i}` });
    }
    for (let i = 0; i < 105; i++) {
      data.Activity.rows.set(`activity-${i}`, { ...activity, id: `activity-${i}`, position: i });
      data.ActivityOption.rows.set(`option-${i}`, { ...option, id: `option-${i}`, activity_id: `activity-${i}` });
    }
    const activitiesBefore = [...data.Activity.rows.values()];
    const optionsBefore = [...data.ActivityOption.rows.values()];
    data.Answer.rows.set('other-answer', { ...answer, id: 'other-answer', room_id: 'other-room' });
    data.Question.rows.set('other-question', { ...question, id: 'other-question', room_id: 'other-room' });
    data.Vote.rows.set('other-vote', { ...vote, id: 'other-vote', room_id: 'other-room' });

    expect(await listActivities(room.id)).toHaveLength(105);
    expect(await listOptions(room.id)).toHaveLength(105);
    expect(await listAnswers(room.id)).toHaveLength(205);
    expect(await listQuestions(room.id)).toHaveLength(205);
    expect(await listVotes(room.id)).toHaveLength(205);
    await resetRoomResponses(room.id);

    expect([...data.Answer.rows.keys()]).toEqual(['other-answer']);
    expect([...data.Question.rows.keys()]).toEqual(['other-question']);
    expect([...data.Vote.rows.keys()]).toEqual(['other-vote']);
    expect(data.Room.rows.get(room.id)).toEqual({
      ...room, isOpen: false, qnaEnabled: false, isResetting: false, resetResumeQuestions: true,
    });
    for (const previous of activitiesBefore) {
      expect(data.Activity.rows.get(previous.id)).toEqual({
        ...previous, state: 'draft', isPrepared: false, startedAt: null,
        answerResetId: expect.any(String),
      });
    }
    for (const previous of optionsBefore) {
      expect(data.ActivityOption.rows.get(previous.id)).toEqual({ ...previous, revealedCorrect: false });
    }
    const deleted = backend.writes.filter((write) => write.operation === 'delete');
    expect(deleted.findIndex((write) => write.table === 'Question')).toBe(205);
    expect(deleted.some((write) => write.table === 'Activity' || write.table === 'ActivityOption')).toBe(false);
  });

  it.each([
    ['Activity', 'update', 1], ['Vote', 'delete', 1], ['Question', 'delete', 1],
    ['Answer', 'delete', 1], ['ActivityOption', 'update', 1],
    ['Activity', 'update', 2], ['Room', 'update', 2],
  ] as const)('recovers after %s.%s fails at call %s', async (table, operation, remaining) => {
    backend.failure = { table, operation, remaining };
    await expect(resetRoomResponses(room.id)).rejects.toThrow('Reset incomplete');
    expect(data.Room.rows.get(room.id)).toMatchObject({
      isResetting: true, isAcceptingQuestions: false, resetResumeQuestions: true,
    });
    await resetRoomResponses(room.id);
    expect(data.Room.rows.get(room.id)).toMatchObject({ isResetting: false, isAcceptingQuestions: true });
    expect(data.Answer.rows.size + data.Question.rows.size + data.Vote.rows.size).toBe(0);
  });

  it('preserves originally paused questions across retries and repeated resets', async () => {
    data.Room.rows.set(room.id, { ...room, isAcceptingQuestions: false });
    backend.failure = { table: 'Answer', operation: 'delete', remaining: 1 };
    await expect(resetRoomResponses(room.id)).rejects.toThrow();
    await resetRoomResponses(room.id);
    await resetRoomResponses(room.id);
    expect(data.Room.rows.get(room.id)).toMatchObject({ isAcceptingQuestions: false, isResetting: false });
  });

  it('refuses success if an answer arrives during the reset', async () => {
    backend.before = (table, op) => {
      if (table === 'Activity' && op === 'update' && data.Answer.rows.size === 0) {
        data.Answer.rows.set('late', { ...answer, id: 'late' });
      }
    };
    await expect(resetRoomResponses(room.id)).rejects.toThrow('Room data changed');
    expect(data.Room.rows.get(room.id)?.isResetting).toBe(true);
  });

  it.each([null, 'another-owner'])('rejects a non-owner before writing (%s)', async (user) => {
    backend.userId = user;
    await expect(resetRoomResponses(room.id)).rejects.toThrow();
    expect(backend.writes).toEqual([]);
  });

  it('handles a room with no activities or audience content', async () => {
    for (const name of ['Activity', 'ActivityOption', 'Answer', 'Question', 'Vote'] as const) data[name].rows.clear();
    await resetRoomResponses(room.id);
    expect(data.Room.rows.get(room.id)?.isResetting).toBe(false);
  });
});

it('clears every answer for one activity and rotates only its answer lock', async () => {
  for (let i = 0; i < 205; i++) data.Answer.rows.set(`answer-${i}`, { ...answer, id: `answer-${i}` });
  data.Answer.rows.set('other', { ...answer, id: 'other', activity_id: 'other-activity' });
  await clearAnswers(activity.id);
  expect([...data.Answer.rows.keys()]).toEqual(['other']);
  expect(data.Activity.rows.get(activity.id)).toMatchObject({ state: activity.state, answerResetId: expect.any(String) });
});

it('fails explicitly for a non-advancing pagination cursor', async () => {
  const query = {
    first: () => query, after: () => query,
    executePaginated: async () => ({ items: [], hasNextPage: true, endCursor: 'same' }),
  };
  await expect(readAll(query)).rejects.toThrow('invalid pagination cursor');
});
