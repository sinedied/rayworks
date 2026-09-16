import { describe, expect, it } from 'vitest';

import {
  QUIZ_BASE_POINTS,
  buildLeaderboard,
  buildWordCloud,
  countChoices,
  countParticipants,
  listOpenText,
  rankOptions,
  scoreAnswer,
  summarizeRating,
  type OptionLike,
} from '@/lib/aggregate';

const options: OptionLike[] = [
  { id: 'a', label: 'Alpha', position: 0 },
  { id: 'b', label: 'Beta', position: 1 },
  { id: 'c', label: 'Gamma', position: 2 },
];

describe('countChoices', () => {
  it('counts votes and computes percentages', () => {
    const results = countChoices(options, [
      { option_id: 'a' },
      { option_id: 'a' },
      { option_id: 'b' },
      { option_id: 'a' },
    ]);

    expect(results).toEqual([
      { optionId: 'a', label: 'Alpha', count: 3, percentage: 75 },
      { optionId: 'b', label: 'Beta', count: 1, percentage: 25 },
      { optionId: 'c', label: 'Gamma', count: 0, percentage: 0 },
    ]);
  });

  it('returns zeroes rather than NaN when nobody has answered', () => {
    const results = countChoices(options, []);

    expect(results.every((result) => result.count === 0)).toBe(true);
    expect(results.every((result) => result.percentage === 0)).toBe(true);
  });

  it('keeps options in their configured order', () => {
    const shuffled: OptionLike[] = [
      { id: 'c', label: 'Gamma', position: 2 },
      { id: 'a', label: 'Alpha', position: 0 },
      { id: 'b', label: 'Beta', position: 1 },
    ];

    expect(countChoices(shuffled, []).map((r) => r.optionId)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('buildWordCloud', () => {
  it('groups answers case-insensitively and weights them', () => {
    const cloud = buildWordCloud([
      { textValue: 'Rayfin' },
      { textValue: 'rayfin' },
      { textValue: ' RAYFIN ' },
      { textValue: 'Fabric' },
    ]);

    expect(cloud).toHaveLength(2);
    expect(cloud[0]).toMatchObject({ word: 'Rayfin', count: 3, weight: 1 });
    expect(cloud[1]).toMatchObject({ word: 'Fabric', count: 1 });
    expect(cloud[1].weight).toBeCloseTo(1 / 3);
  });

  it('ignores blank submissions', () => {
    expect(buildWordCloud([{ textValue: '   ' }, {}])).toEqual([]);
  });
});

describe('summarizeRating', () => {
  it('averages ratings and builds a full distribution', () => {
    const summary = summarizeRating(
      [{ ratingValue: 5 }, { ratingValue: 4 }, { ratingValue: 5 }],
      5
    );

    expect(summary.count).toBe(3);
    expect(summary.average).toBeCloseTo(14 / 3);
    expect(summary.distribution).toHaveLength(5);
    expect(summary.distribution[4]).toEqual({ value: 5, count: 2 });
    expect(summary.distribution[0]).toEqual({ value: 1, count: 0 });
  });

  it('avoids dividing by zero', () => {
    expect(summarizeRating([], 5).average).toBe(0);
  });
});

describe('rankOptions', () => {
  it('applies Borda scoring and sorts best first', () => {
    // Two voters both put Gamma first, Alpha second, Beta third.
    const answers = [
      { option_id: 'c', rankPosition: 1 },
      { option_id: 'a', rankPosition: 2 },
      { option_id: 'b', rankPosition: 3 },
      { option_id: 'c', rankPosition: 1 },
      { option_id: 'a', rankPosition: 2 },
      { option_id: 'b', rankPosition: 3 },
    ];

    const results = rankOptions(options, answers);

    expect(results.map((result) => result.optionId)).toEqual(['c', 'a', 'b']);
    expect(results[0].score).toBe(4);
    expect(results[0].averageRank).toBe(1);
    expect(results[2].score).toBe(0);
  });
});

describe('listOpenText', () => {
  it('drops hidden and empty answers, newest first', () => {
    const results = listOpenText([
      { textValue: 'older', createdAt: new Date('2026-01-01T10:00:00Z') },
      { textValue: 'newer', createdAt: new Date('2026-01-01T12:00:00Z') },
      { textValue: 'hidden', isHidden: true, createdAt: new Date() },
      { textValue: '  ', createdAt: new Date() },
    ]);

    expect(results.map((answer) => answer.textValue)).toEqual([
      'newer',
      'older',
    ]);
  });
});

describe('scoreAnswer', () => {
  it('awards full points when there is no time limit', () => {
    expect(scoreAnswer(9999, 0)).toBe(QUIZ_BASE_POINTS);
    expect(scoreAnswer(undefined, undefined)).toBe(QUIZ_BASE_POINTS);
  });

  it('awards full points for an instant answer', () => {
    expect(scoreAnswer(0, 20)).toBe(QUIZ_BASE_POINTS);
  });

  it('decays to half the base score at the time limit', () => {
    expect(scoreAnswer(20_000, 20)).toBe(QUIZ_BASE_POINTS / 2);
    expect(scoreAnswer(10_000, 20)).toBe(QUIZ_BASE_POINTS * 0.75);
  });

  it('clamps answers that arrive after the limit', () => {
    expect(scoreAnswer(999_999, 20)).toBe(QUIZ_BASE_POINTS / 2);
  });
});

describe('buildLeaderboard', () => {
  const quizOptions: OptionLike[] = [
    { id: 'right', label: 'Right', position: 0, isCorrect: true },
    { id: 'wrong', label: 'Wrong', position: 1, isCorrect: false },
  ];

  it('scores correct answers and ranks participants', () => {
    const board = buildLeaderboard([
      {
        id: 'q1',
        timeLimitSeconds: 20,
        options: quizOptions,
        answers: [
          {
            participantKey: 'fast',
            participantName: 'Ada',
            option_id: 'right',
            elapsedMs: 0,
          },
          {
            participantKey: 'slow',
            participantName: 'Bob',
            option_id: 'right',
            elapsedMs: 20_000,
          },
          {
            participantKey: 'nope',
            participantName: 'Eve',
            option_id: 'wrong',
            elapsedMs: 0,
          },
        ],
      },
    ]);

    expect(board.map((entry) => entry.name)).toEqual(['Ada', 'Bob', 'Eve']);
    expect(board[0].score).toBe(QUIZ_BASE_POINTS);
    expect(board[1].score).toBe(QUIZ_BASE_POINTS / 2);
    expect(board[2].score).toBe(0);
    expect(board[2].correctCount).toBe(0);
  });

  it('requires the exact correct set on multi-answer questions', () => {
    const multi: OptionLike[] = [
      { id: 'a', label: 'A', position: 0, isCorrect: true },
      { id: 'b', label: 'B', position: 1, isCorrect: true },
      { id: 'c', label: 'C', position: 2, isCorrect: false },
    ];

    const board = buildLeaderboard([
      {
        id: 'q1',
        options: multi,
        answers: [
          { participantKey: 'both', participantName: 'Full', option_id: 'a' },
          { participantKey: 'both', participantName: 'Full', option_id: 'b' },
          { participantKey: 'partial', participantName: 'Half', option_id: 'a' },
        ],
      },
    ]);

    expect(board[0].name).toBe('Full');
    expect(board[0].correctCount).toBe(1);
    expect(board.find((entry) => entry.name === 'Half')?.correctCount).toBe(0);
  });

  it('accumulates scores across several quiz activities', () => {
    const board = buildLeaderboard([
      {
        id: 'q1',
        options: quizOptions,
        answers: [
          { participantKey: 'p', participantName: 'Ada', option_id: 'right' },
        ],
      },
      {
        id: 'q2',
        options: quizOptions,
        answers: [
          { participantKey: 'p', participantName: 'Ada', option_id: 'right' },
        ],
      },
    ]);

    expect(board).toHaveLength(1);
    expect(board[0].score).toBe(QUIZ_BASE_POINTS * 2);
    expect(board[0].answeredCount).toBe(2);
  });

  it('skips activities with no answer key, since attendees cannot read it', () => {
    const board = buildLeaderboard([
      {
        id: 'q1',
        options: [{ id: 'a', label: 'A', position: 0 }],
        answers: [{ participantKey: 'p', option_id: 'a' }],
      },
    ]);

    expect(board).toEqual([]);
  });
});

describe('countParticipants', () => {
  it('counts distinct participants when keys are visible', () => {
    expect(
      countParticipants([
        { participantKey: 'a' },
        { participantKey: 'a' },
        { participantKey: 'b' },
      ])
    ).toBe(2);
  });

  it('falls back to row count when keys are hidden from anonymous readers', () => {
    expect(countParticipants([{}, {}, {}])).toBe(3);
  });
});
