import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  autoRevealQuiz, clearQuizHistory, closeQuizQuestion, finishQuiz, joinQuiz, loadQuizRun,
  openQuizQuestion, openQuizSeries, requireInactiveQuiz, startQuizQuestion, validateQuizSubmission,
} from '@/services/quizRuns';
import { getActivity } from '@/services/activities';
import { submitChoice } from '@/services/answers';
import { getRoomById, updateRoom } from '@/services/rooms';
import { getParticipantKey } from '@/services/identity';
import { resetRoomResponses } from '@/services/roomReset';
import { quizOptions } from '@/lib/quizRuns';
import { activity, answer, backend, client, data, option, room, seed } from './helpers/roomData';

vi.mock('@/services/rayfinClient', () => ({ getRayfinClient: () => client }));

beforeEach(() => {
  seed();
  vi.stubGlobal('crypto', webcrypto);
  data.Answer.rows.clear();
  data.Activity.rows.set(activity.id, { ...activity, state: 'draft', startedAt: undefined });
  data.Activity.rows.set('second', { ...activity, id: 'second', position: 1, state: 'draft', startedAt: undefined });
  data.ActivityOption.rows.set('second-a', { ...option, id: 'second-a', activity_id: 'second' });
  data.ActivityOption.rows.set('second-b', { ...option, id: 'second-b', activity_id: 'second', position: 1, isCorrect: false });
});
afterEach(() => vi.unstubAllGlobals());

async function current() {
  const currentRoom = (await getRoomById(room.id))!;
  return loadQuizRun(currentRoom, currentRoom.quizRunId!);
}
async function start() {
  await openQuizSeries(room.id, 'second');
  await joinQuiz(room.id, (await current()).run.id, 'Ada');
  const quiz = await current();
  await startQuizQuestion(room.id, quiz.run.id, quiz.questions[0].id);
  return current();
}

describe('continuous quiz lifecycle', () => {
  it('opens only the first lobby, continues directly, and reviews without a new timer', async () => {
    await openQuizSeries(room.id, 'second');
    let quiz = await current();
    expect(quiz.run.state).toBe('lobby');
    expect(data.Room.rows.get(room.id)?.displayedActivityId).toBe(activity.id);
    expect(quiz.questions.map((question) => question.state)).toEqual(['lobby', 'pending']);
    await joinQuiz(room.id, quiz.run.id, 'Ada');
    await joinQuiz(room.id, quiz.run.id, 'Ada again');
    expect(data.QuizParticipant.rows.size).toBe(1);
    await startQuizQuestion(room.id, quiz.run.id, quiz.questions[0].id);
    const originalStart = (await current()).questions[0].startedAt;
    await openQuizQuestion(room.id, quiz.run.id, 'second');
    quiz = await current();
    expect(quiz.questions.map((question) => question.state)).toEqual(['closed', 'running']);
    expect(quiz.members).toHaveLength(2);
    await openQuizQuestion(room.id, quiz.run.id, activity.id);
    quiz = await current();
    expect(quiz.questions.map((question) => question.state)).toEqual(['closed', 'closed']);
    expect(quiz.questions[0].startedAt).toEqual(originalStart);
    await expect(startQuizQuestion(room.id, quiz.run.id, quiz.questions[0].id)).rejects.toThrow('already started');
  });

  it('freezes eligible members per question and admits a late join to the next one', async () => {
    const quiz = await start();
    data.QuizParticipant.rows.set('late', {
      id: 'late', run_id: quiz.run.id, room_id: room.id, owner_id: room.owner_id,
      participantKey: 'late-key', participantName: 'Late', joinKey: `${quiz.run.id}:late-key`, createdAt: new Date(),
    });
    expect((await current()).members.filter((member) => member.question_id === quiz.questions[0].id)).toHaveLength(1);
    await openQuizQuestion(room.id, quiz.run.id, 'second');
    expect((await current()).members.filter((member) => member.question_id === quiz.questions[1].id)).toHaveLength(2);
  });

  it('reveals on whole-group completion and archives the previous run on restart', async () => {
    await updateRoom(room.id, { quizAutoReveal: true });
    let quiz = await start();
    await submitChoice(await getActivity(activity.id), ['option-1']);
    await autoRevealQuiz(room.id, quiz.run.id, quiz.questions[0].id);
    quiz = await current();
    expect(quiz.questions[0].state).toBe('revealed');
    expect(quiz.members[0]).toMatchObject({ scored: true, correct: true, answered: true });
    expect(quizOptions(quiz.questions[0], quiz.options)[0].revealedCorrect).toBe(true);
    const old = quiz;
    await openQuizSeries(room.id, activity.id, true);
    quiz = await current();
    expect(quiz.run.id).not.toBe(old.run.id);
    expect(quiz.participants).toEqual([]);
    expect(quiz.answers).toEqual([]);
    expect(quiz.options.every((entry) => !entry.revealedCorrect)).toBe(true);
    expect(data.Answer.rows.size).toBe(1);
    expect(data.QuizRun.rows.get(old.run.id)?.state).toBe('finished');
    await expect(autoRevealQuiz(room.id, old.run.id, old.questions[0].id)).rejects.toThrow('changed');
    expect((await current()).questions[0].state).toBe('lobby');
    await expect(validateQuizSubmission({ ...activity, quizQuestionId: old.questions[0].id }, ['option-1'])).rejects.toThrow('changed');
  });

  it('auto-reveals an empty timed question only after its deadline', async () => {
    await updateRoom(room.id, { quizAutoReveal: true });
    await openQuizSeries(room.id, activity.id);
    let quiz = await current();
    await startQuizQuestion(room.id, quiz.run.id, quiz.questions[0].id);
    await autoRevealQuiz(room.id, quiz.run.id, quiz.questions[0].id);
    expect((await current()).questions[0].state).toBe('running');
    await data.QuizQuestionRun.update({ id: quiz.questions[0].id }, { startedAt: new Date(Date.now() - 30000) });
    await autoRevealQuiz(room.id, quiz.run.id, quiz.questions[0].id);
    quiz = await current();
    expect(quiz.questions[0].state).toBe('revealed');
    expect(data.Room.rows.get(room.id)?.displayedQuestionId).toBe(quiz.questions[0].id);
  });

  it('leaves manual reveal available with auto-reveal off', async () => {
    const quiz = await start();
    await submitChoice(await getActivity(activity.id), ['option-1']);
    await autoRevealQuiz(room.id, quiz.run.id, quiz.questions[0].id);
    expect((await current()).questions[0].state).toBe('running');
    await closeQuizQuestion(room.id, quiz.run.id, quiz.questions[0].id, true);
    expect((await current()).questions[0].state).toBe('revealed');
    await expect(submitChoice(await getActivity(activity.id), ['option-1'])).rejects.toThrow('closed');
  });

  it('does not count a partial multi-select as a completed answer', async () => {
    await updateRoom(room.id, { quizAutoReveal: true });
    const quiz = await start();
    data.Answer.rows.set('partial', {
      ...answer, id: 'partial', quizQuestionId: quiz.questions[0].id, participantKey: getParticipantKey(),
      submissionSize: 2, submissionId: 'partial-submission', createdAt: new Date(),
    });
    await autoRevealQuiz(room.id, quiz.run.id, quiz.questions[0].id);
    expect((await current()).questions[0].state).toBe('running');
  });
});

describe('quiz persistence and failures', () => {
  it('resumes activation after the timer was persisted without restarting it', async () => {
    await openQuizSeries(room.id, activity.id);
    const quiz = await current();
    await joinQuiz(room.id, quiz.run.id, 'Ada');
    backend.failure = { table: 'Activity', operation: 'update', remaining: 1 };
    await expect(startQuizQuestion(room.id, quiz.run.id, quiz.questions[0].id)).rejects.toThrow();
    const afterFailure = await current();
    const startedAt = afterFailure.questions[0].startedAt;
    expect(afterFailure.questions[0].state).toBe('running');
    await startQuizQuestion(room.id, quiz.run.id, quiz.questions[0].id);
    expect((await current()).questions[0].startedAt).toEqual(startedAt);
    expect((await getActivity(activity.id)).startedAt).toEqual(startedAt);
    expect((await getActivity(activity.id)).isPrepared).toBe(false);
  });

  it('resumes incomplete initialization without duplicating questions or options', async () => {
    backend.failure = { table: 'QuizQuestionOption', operation: 'create', remaining: 2 };
    await expect(openQuizSeries(room.id, activity.id)).rejects.toThrow();
    expect((await current()).run.state).toBe('building');
    await openQuizSeries(room.id, activity.id);
    expect(data.QuizRun.rows.size).toBe(1);
    expect(data.QuizQuestionRun.rows.size).toBe(2);
    expect(data.QuizQuestionOption.rows.size).toBe(4);
    expect((await current()).run.state).toBe('lobby');
  });

  it('does not expose partial correctness after reveal failure, and retries scores idempotently', async () => {
    const quiz = await start();
    await submitChoice(await getActivity(activity.id), ['option-1']);
    backend.failure = { table: 'QuizQuestionOption', operation: 'update', remaining: 2 };
    await expect(closeQuizQuestion(room.id, quiz.run.id, quiz.questions[0].id, true)).rejects.toThrow();
    const partial = await current();
    expect(partial.questions[0].state).toBe('revealing');
    expect(quizOptions(partial.questions[0], partial.options).every((entry) => !entry.revealedCorrect)).toBe(true);
    const score = partial.members[0].score;
    await closeQuizQuestion(room.id, quiz.run.id, quiz.questions[0].id, true);
    await closeQuizQuestion(room.id, quiz.run.id, quiz.questions[0].id, true);
    expect((await current()).members[0].score).toBe(score);
    expect((await current()).questions[0].state).toBe('revealed');
  });

  it('freezes more than one page of attendees and blocks active-series edits', async () => {
    await openQuizSeries(room.id, activity.id);
    let quiz = await current();
    for (let i = 0; i < 105; i++) {
      data.QuizParticipant.rows.set(`participant-${i}`, {
        id: `participant-${i}`, run_id: quiz.run.id, room_id: room.id, owner_id: room.owner_id,
        participantKey: `key-${i}`, participantName: `P${i}`, joinKey: `${quiz.run.id}:${i}`, createdAt: new Date(),
      });
    }
    await startQuizQuestion(room.id, quiz.run.id, quiz.questions[0].id);
    quiz = await current();
    expect(quiz.members).toHaveLength(105);
    await expect(requireInactiveQuiz(room.id, [activity.id])).rejects.toThrow('Finish the quiz');
    await finishQuiz(room.id, quiz.run.id);
    await requireInactiveQuiz(room.id, [activity.id]);
  });

  it('clears one activity’s outcomes without deleting other question history', async () => {
    const quiz = await start();
    await finishQuiz(room.id, quiz.run.id);
    await clearQuizHistory(room.id, activity.id);
    const after = await current();
    expect(after.questions[0].state).toBe('cleared');
    expect(after.questions[1].state).toBe('pending');
    expect(after.members).toEqual([]);
    expect(after.run.id).toBe(quiz.run.id);
  });

  it('cleans every run, roster, and snapshot during an explicit event reset', async () => {
    await start();
    await submitChoice(await getActivity(activity.id), ['option-1']);
    await openQuizSeries(room.id, activity.id, true);
    await resetRoomResponses(room.id);
    for (const name of ['QuizRun', 'QuizQuestionRun', 'QuizQuestionOption', 'QuizParticipant', 'QuizQuestionParticipant'] as const) {
      expect(data[name].rows.size).toBe(0);
    }
    expect(data.Answer.rows.size).toBe(0);
    expect(data.Room.rows.get(room.id)).toMatchObject({ quizRunId: null, displayedQuestionId: null, isResetting: false });
    expect(data.Activity.rows.get(activity.id)).toMatchObject({ state: 'draft', quizQuestionId: null });
  });

  it.each(['anonymous', 'non-owner', 'resetting'])('denies presenter transitions for %s', async (mode) => {
    if (mode === 'anonymous') backend.userId = null;
    if (mode === 'non-owner') backend.userId = 'other';
    if (mode === 'resetting') data.Room.rows.set(room.id, { ...room, isResetting: true });
    await expect(openQuizSeries(room.id, activity.id)).rejects.toThrow();
    expect(backend.writes).toEqual([]);
  });
});
