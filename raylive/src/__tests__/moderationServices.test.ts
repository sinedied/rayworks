import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteAnswer, deleteWordCloudEntry } from '@/services/answers';
import { deleteQuestion } from '@/services/questions';
import { activity, answer, backend, client, data, question, room, seed, vote } from './helpers/roomData';

vi.mock('@/services/rayfinClient', () => ({ getRayfinClient: () => client }));

beforeEach(() => {
  seed();
  data.Activity.rows.set(activity.id, { ...activity, kind: 'openText', state: 'live', answerResetId: 'unchanged' });
  data.Answer.rows.set(answer.id, { ...answer, textValue: 'Remove me', createdAt: new Date(200) });
});

describe('Open text deletion', () => {
  it('removes older versions but preserves newer responses and existing activity controls', async () => {
    data.Answer.rows.set('older', { ...answer, id: 'older', textValue: 'Old version', createdAt: new Date(100) });
    data.Answer.rows.set('newer', { ...answer, id: 'newer', textValue: 'New version', createdAt: new Date(300) });
    data.Answer.rows.set('other-person', { ...answer, id: 'other-person', participantKey: 'other', textValue: 'Remove me' });
    const previous = { ...data.Activity.rows.get(activity.id)! };
    await deleteAnswer(activity.id, answer.id);
    expect([...data.Answer.rows.keys()]).toEqual(['newer', 'other-person']);
    expect(backend.writes.map((write) => write.id)).toEqual(['older', answer.id]);
    expect(data.Activity.rows.get(activity.id)).toEqual(previous);
  });

  it('preserves a latest response when an older-history deletion fails, then retries cleanly', async () => {
    data.Answer.rows.set('older', { ...answer, id: 'older', textValue: 'Old version', createdAt: new Date(100) });
    backend.failure = { table: 'Answer', operation: 'delete', remaining: 1 };
    await expect(deleteAnswer(activity.id, answer.id)).rejects.toThrow('Could not finish deleting');
    expect(data.Answer.rows.has(answer.id)).toBe(true);
    await deleteAnswer(activity.id, answer.id);
    expect(data.Answer.rows.size).toBe(0);
  });

  it.each(['non-owner', 'wrong-type', 'wrong-activity', 'resetting', 'already-deleted'])(
    'rejects %s without writing', async (scenario) => {
      if (scenario === 'non-owner') backend.userId = 'other-owner';
      if (scenario === 'wrong-type') data.Activity.rows.set(activity.id, { ...activity, kind: 'quiz' });
      if (scenario === 'wrong-activity') data.Answer.rows.set(answer.id, { ...answer, activity_id: 'another' });
      if (scenario === 'resetting') data.Room.rows.set(room.id, { ...room, isResetting: true });
      if (scenario === 'already-deleted') data.Answer.rows.clear();
      await expect(deleteAnswer(activity.id, answer.id)).rejects.toThrow();
      expect(backend.writes).toEqual([]);
    }
  );

  it('only removes the selected entry when multiple independent entries are enabled', async () => {
    data.Activity.rows.set(activity.id, { ...activity, kind: 'openText', allowMultiple: true });
    data.Answer.rows.set('older', { ...answer, id: 'older', createdAt: new Date(100) });
    await deleteAnswer(activity.id, answer.id);
    expect([...data.Answer.rows.keys()]).toEqual(['older']);
  });
});

describe('word-cloud deletion', () => {
  beforeEach(() => {
    data.Activity.rows.set(activity.id, { ...activity, kind: 'wordCloud', allowMultiple: true });
    data.Answer.rows.clear();
  });

  it('removes all matching pages, including hidden rows, but not other activities or text', async () => {
    for (let i = 0; i < 205; i++) {
      data.Answer.rows.set(`matching-${i}`, {
        ...answer, id: `matching-${i}`, textValue: i % 2 ? ' HELLO world ' : 'hello WORLD',
        isHidden: i % 2 === 0,
      });
    }
    for (const text of ['hello  world', 'hello world!', 'hello']) {
      data.Answer.rows.set(text, { ...answer, id: text, textValue: text });
    }
    data.Answer.rows.set('other-activity', { ...answer, id: 'other-activity', activity_id: 'other', textValue: 'hello world' });
    data.Answer.rows.set('other-room', { ...answer, id: 'other-room', room_id: 'other', textValue: 'hello world' });
    await deleteWordCloudEntry(activity.id, 'Hello world');
    expect([...data.Answer.rows.keys()]).toEqual(['hello  world', 'hello world!', 'hello', 'other-activity', 'other-room']);
    expect(backend.writes).toHaveLength(205);
  });

  it('preserves responses received after the deletion snapshot', async () => {
    data.Answer.rows.set(answer.id, { ...answer, textValue: 'term' });
    backend.before = (table, op) => {
      if (table === 'Answer' && op === 'delete') {
        data.Answer.rows.set('later', { ...answer, id: 'later', textValue: 'term' });
      }
    };
    await deleteWordCloudEntry(activity.id, 'term');
    expect([...data.Answer.rows.keys()]).toEqual(['later']);
  });

  it('also clears older non-matching replacements when deleting an active cloud entry', async () => {
    data.Activity.rows.set(activity.id, { ...activity, kind: 'wordCloud', allowMultiple: false });
    data.Answer.rows.set('older', { ...answer, id: 'older', textValue: 'previous', createdAt: new Date(100) });
    data.Answer.rows.set('current', { ...answer, id: 'current', textValue: 'term', createdAt: new Date(200) });
    await deleteWordCloudEntry(activity.id, 'term');
    expect(data.Answer.rows.size).toBe(0);
  });

  it('reports partial failure and permits retry of remaining matches', async () => {
    data.Answer.rows.set('a', { ...answer, id: 'a', textValue: 'term' });
    data.Answer.rows.set('b', { ...answer, id: 'b', textValue: 'term' });
    backend.failure = { table: 'Answer', operation: 'delete', remaining: 2 };
    await expect(deleteWordCloudEntry(activity.id, 'term')).rejects.toThrow('1 of 2');
    await deleteWordCloudEntry(activity.id, 'term');
    expect(data.Answer.rows.size).toBe(0);
  });
});

describe('Q&A deletion', () => {
  it('removes every vote before a hidden/answered question without touching other questions', async () => {
    for (let i = 0; i < 205; i++) data.Vote.rows.set(`vote-${i}`, { ...vote, id: `vote-${i}` });
    data.Vote.rows.set('other', { ...vote, id: 'other', question_id: 'other' });
    await deleteQuestion(question.id);
    expect([...data.Vote.rows.keys()]).toEqual(['other']);
    expect(data.Question.rows.size).toBe(0);
    expect(backend.writes.at(-1)).toEqual({ table: 'Question', operation: 'delete', id: question.id });
  });

  it.each(['non-owner', 'resetting', 'missing'])('rejects %s before deleting votes', async (scenario) => {
    if (scenario === 'non-owner') backend.userId = 'other';
    if (scenario === 'resetting') data.Room.rows.set(room.id, { ...room, isResetting: true });
    if (scenario === 'missing') data.Question.rows.clear();
    await expect(deleteQuestion(question.id)).rejects.toThrow();
    expect(backend.writes).toEqual([]);
  });

  it('keeps the parent question available for retry after a failed vote deletion', async () => {
    backend.failure = { table: 'Vote', operation: 'delete', remaining: 1 };
    await expect(deleteQuestion(question.id)).rejects.toThrow('Some votes may have been removed');
    expect(data.Question.rows.has(question.id)).toBe(true);
    await deleteQuestion(question.id);
    expect(data.Question.rows.has(question.id)).toBe(false);
  });
});
