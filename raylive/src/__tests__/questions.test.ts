import { describe, expect, it } from 'vitest';

import type { Question } from '../../rayfin/data/Question';

import { tallyQuestions } from '@/services/questions';

function makeQuestion(id: string, createdAt: string): Question {
  return {
    id,
    content: `Question ${id}`,
    isAnswered: false,
    isHidden: false,
    createdAt: new Date(createdAt),
    room_id: 'room-1',
    owner_id: 'owner-1',
  } as Question;
}

describe('tallyQuestions', () => {
  const older = makeQuestion('a', '2026-01-01T10:00:00Z');
  const newer = makeQuestion('b', '2026-01-01T11:00:00Z');

  it('counts votes per question', () => {
    const result = tallyQuestions(
      [older, newer],
      [
        { question_id: 'a' },
        { question_id: 'a' },
        { question_id: 'b' },
      ],
      new Set()
    );

    expect(result.map((q) => [q.id, q.voteCount])).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
  });

  it('sorts most-upvoted first and breaks ties by newest', () => {
    const result = tallyQuestions([older, newer], [], new Set());

    expect(result.map((q) => q.id)).toEqual(['b', 'a']);
  });

  it('reports zero for questions with no votes', () => {
    const [question] = tallyQuestions([older], [], new Set());

    expect(question.voteCount).toBe(0);
    expect(question.hasVoted).toBe(false);
  });

  it('flags questions this browser already upvoted', () => {
    const result = tallyQuestions(
      [older, newer],
      [{ question_id: 'a' }],
      new Set(['a'])
    );

    expect(result.find((q) => q.id === 'a')?.hasVoted).toBe(true);
    expect(result.find((q) => q.id === 'b')?.hasVoted).toBe(false);
  });
});
