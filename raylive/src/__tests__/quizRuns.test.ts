import { describe, expect, it } from 'vitest';
import type { QuizQuestionRun } from '../../rayfin/data/QuizQuestionRun';
import type { QuizQuestionParticipant } from '../../rayfin/data/QuizQuestionParticipant';
import {
  combinedQuizLeaderboard, completeQuizAnswers, quizOptions, quizSeries,
  shouldAutoReveal, visibleQuizAnswers, type QuizRunData,
} from '@/lib/quizRuns';
import { nextActivity, previousActivity } from '@/lib/runOrder';
import { activity, answer, room } from './helpers/roomData';

const question: QuizQuestionRun = {
  id: 'q1', run_id: 'run', activity_id: activity.id, room_id: room.id, owner_id: room.owner_id,
  snapshotKey: 'run:q1', prompt: 'Snapshot', position: 0, timeLimitSeconds: 20,
  allowMultiple: true, allowChangeAnswer: true, showResults: true, published: true, state: 'running',
  startedAt: new Date(1000),
};
const member: QuizQuestionParticipant = {
  id: 'member', question_id: question.id, run_id: question.run_id, room_id: room.id, owner_id: room.owner_id,
  participantKey: answer.participantKey, participantName: 'Ada', membershipKey: 'q1:ada',
  scored: false, score: 0, correct: false, answered: false,
};
const response = {
  ...answer, quizQuestionId: question.id, submissionId: 'submission', submissionSize: 2,
  createdAt: new Date(1500), elapsedMs: 500,
};

it('resolves only the adjacent quiz block and navigates after a closed displayed question', () => {
  const activities = [
    { ...activity, id: 'q1', position: 0 },
    { ...activity, id: 'q2', position: 1 },
    { ...activity, id: 'poll', kind: 'rating' as const, position: 2 },
    { ...activity, id: 'q3', position: 3 },
  ];
  expect(quizSeries(activities, 'q2').map((item) => item.id)).toEqual(['q1', 'q2']);
  expect(quizSeries(activities, 'q3').map((item) => item.id)).toEqual(['q3']);
  expect(nextActivity(activities, 'q2')?.id).toBe('poll');
  expect(previousActivity(activities, 'q2')?.id).toBe('q1');
});

describe('complete quiz submissions', () => {
  it('ignores partial multi-select writes, duplicate options, and old attempts', () => {
    expect(completeQuizAnswers(question, [response])).toEqual([]);
    expect(completeQuizAnswers(question, [response, { ...response, id: 'two' }])).toEqual([]);
    expect(completeQuizAnswers(question, [{ ...response, submissionSize: 1, quizQuestionId: 'previous-run' }])).toEqual([]);
  });
  it('does not let an incomplete replacement suppress the last whole submission', () => {
    const first = { ...response, submissionSize: 1 };
    const partial = { ...response, id: 'partial', submissionId: 'newer', createdAt: new Date(2000) };
    expect(completeQuizAnswers(question, [first, partial])).toEqual([first]);
  });
  it('rejects post-deadline and post-close data', () => {
    expect(completeQuizAnswers(question, [{ ...response, submissionSize: 1, createdAt: new Date(21001) }])).toEqual([]);
    expect(completeQuizAnswers({ ...question, closedAt: new Date(1200) }, [{ ...response, submissionSize: 1 }])).toEqual([]);
  });
});

describe('auto reveal', () => {
  it('waits for the whole nonempty frozen group, not a raw answer-row count', () => {
    expect(shouldAutoReveal(question, [member], [response], 1600)).toBe(false);
    expect(shouldAutoReveal(question, [member], [response, { ...response, id: 'two', option_id: 'option-2' }], 1600)).toBe(true);
    expect(shouldAutoReveal(question, [member, { ...member, id: 'other', participantKey: 'other' }], [
      response, { ...response, id: 'two', option_id: 'option-2' },
    ], 1600)).toBe(false);
  });
  it('does not reveal an empty group except at a real timeout', () => {
    expect(shouldAutoReveal(question, [], [], 2000)).toBe(false);
    expect(shouldAutoReveal(question, [], [], 21000)).toBe(true);
    expect(shouldAutoReveal({ ...question, timeLimitSeconds: 0 }, [], [], 999999)).toBe(false);
  });
  it('never automatically reveals a lobby or a reviewed question', () => {
    expect(shouldAutoReveal({ ...question, state: 'lobby' }, [member], [], 999999)).toBe(false);
    expect(shouldAutoReveal({ ...question, state: 'closed' }, [member], [], 999999)).toBe(false);
  });
});

function run(id: string, seriesKey: string, started: number, participants: [string, number][]): QuizRunData {
  return {
    run: { id, room_id: room.id, owner_id: room.owner_id, seriesKey, title: id, state: 'finished', createdAt: new Date(started), startedAt: new Date(started) },
    questions: [{ ...question, run_id: id }],
    options: [], answers: [],
    participants: participants.map(([key]) => ({
      id: `${id}:${key}`, run_id: id, room_id: room.id, owner_id: room.owner_id,
      participantKey: key, participantName: key, joinKey: `${id}:${key}`, createdAt: new Date(started),
    })),
    members: participants.map(([key, score]) => ({
      ...member, id: `${id}:${key}`, run_id: id, participantKey: key, participantName: key,
      scored: true, answered: score > 0, correct: score > 0, score,
    })),
  };
}

it('combines each attendee’s latest participation per series, even if lower or zero', () => {
  const results = combinedQuizLeaderboard([
    run('old', 'series-a', 100, [['Ada', 1000], ['Ben', 900]]),
    run('new', 'series-a', 200, [['Ada', 0]]),
    run('different', 'series-b', 150, [['Ada', 500], ['Ben', 100]]),
  ]);
  expect(results.map((entry) => [entry.name, entry.score])).toEqual([['Ben', 1000], ['Ada', 500]]);
});

it('uses finalized accepted submissions and never exposes correctness during partial reveal', () => {
  const data = run('run', 'series', 100, [[answer.participantKey, 1000]]);
  data.answers = [
    { ...response, submissionSize: 1 }, { ...response, id: 'late', submissionSize: 1, submissionId: 'late' },
  ];
  data.members[0].acceptedSubmissionId = 'submission';
  expect(visibleQuizAnswers(data, { ...question, state: 'revealed' })).toEqual([data.answers[0]]);
  data.options = [{
    id: 'snapshot-option', question_id: question.id, run_id: 'run', activity_id: activity.id,
    option_id: 'option-1', room_id: room.id, owner_id: room.owner_id, snapshotKey: 'key',
    label: 'Correct', position: 0, isCorrect: true, revealedCorrect: true, published: true,
  }];
  expect(quizOptions({ ...question, state: 'revealing' }, data.options)[0].revealedCorrect).toBe(false);
  expect(quizOptions({ ...question, state: 'running' }, data.options)[0].revealedCorrect).toBe(false);
  expect(quizOptions({ ...question, state: 'revealed' }, data.options)[0].revealedCorrect).toBe(true);
});
