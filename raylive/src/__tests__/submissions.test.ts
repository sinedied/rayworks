import { describe, expect, it } from 'vitest';

import {
  allowsMultipleSubmissions,
  buildLeaderboard,
  countChoices,
  hasAnswered,
  latestSubmissions,
  tallyAnswers,
  type AnswerLike,
  type OptionLike,
} from '@/lib/aggregate';

const at = (iso: string) => new Date(iso);

describe('latestSubmissions', () => {
  it('keeps only a participant\u2019s newest submission', () => {
    const answers: AnswerLike[] = [
      {
        participantKey: 'p1',
        submissionId: 's1',
        option_id: 'a',
        createdAt: at('2026-01-01T10:00:00Z'),
      },
      {
        participantKey: 'p1',
        submissionId: 's2',
        option_id: 'b',
        createdAt: at('2026-01-01T10:05:00Z'),
      },
    ];

    const result = latestSubmissions(answers);

    expect(result).toHaveLength(1);
    expect(result[0].option_id).toBe('b');
  });

  it('keeps every row of a multi-row submission', () => {
    const answers: AnswerLike[] = [
      {
        participantKey: 'p1',
        submissionId: 's1',
        option_id: 'a',
        createdAt: at('2026-01-01T10:00:00Z'),
      },
      {
        participantKey: 'p1',
        submissionId: 's2',
        option_id: 'b',
        createdAt: at('2026-01-01T10:05:00Z'),
      },
      {
        participantKey: 'p1',
        submissionId: 's2',
        option_id: 'c',
        createdAt: at('2026-01-01T10:05:00Z'),
      },
    ];

    const result = latestSubmissions(answers);

    expect(result.map((answer) => answer.option_id).sort()).toEqual(['b', 'c']);
  });

  it('keeps submissions from different participants', () => {
    const answers: AnswerLike[] = [
      {
        participantKey: 'p1',
        submissionId: 's1',
        option_id: 'a',
        createdAt: at('2026-01-01T10:00:00Z'),
      },
      {
        participantKey: 'p2',
        submissionId: 's2',
        option_id: 'a',
        createdAt: at('2026-01-01T10:01:00Z'),
      },
    ];

    expect(latestSubmissions(answers)).toHaveLength(2);
  });

  it('passes through rows with no participant key', () => {
    const answers: AnswerLike[] = [{ option_id: 'a' }, { option_id: 'b' }];

    expect(latestSubmissions(answers)).toHaveLength(2);
  });
});

describe('tallyAnswers', () => {
  const answers: AnswerLike[] = [
    {
      participantKey: 'p1',
      submissionId: 's1',
      textValue: 'first',
      createdAt: at('2026-01-01T10:00:00Z'),
    },
    {
      participantKey: 'p1',
      submissionId: 's2',
      textValue: 'second',
      createdAt: at('2026-01-01T10:01:00Z'),
    },
  ];

  it('keeps every entry when a word cloud invites several', () => {
    const activity = { kind: 'wordCloud', allowMultiple: true };

    expect(allowsMultipleSubmissions(activity)).toBe(true);
    expect(tallyAnswers(activity, answers)).toHaveLength(2);
  });

  it('de-duplicates a single-entry word cloud', () => {
    expect(
      tallyAnswers({ kind: 'wordCloud', allowMultiple: false }, answers)
    ).toHaveLength(1);
  });

  it('de-duplicates multi-select choices, which are one submission', () => {
    const activity = { kind: 'multipleChoice', allowMultiple: true };

    expect(allowsMultipleSubmissions(activity)).toBe(false);
    expect(tallyAnswers(activity, answers)).toHaveLength(1);
  });
});

describe('changed answers in tallies', () => {
  const options: OptionLike[] = [
    { id: 'a', label: 'Alpha', position: 0 },
    { id: 'b', label: 'Beta', position: 1 },
  ];

  it('counts only the replacement answer', () => {
    const answers: AnswerLike[] = [
      {
        participantKey: 'p1',
        submissionId: 's1',
        option_id: 'a',
        createdAt: at('2026-01-01T10:00:00Z'),
      },
      {
        participantKey: 'p1',
        submissionId: 's2',
        option_id: 'b',
        createdAt: at('2026-01-01T10:05:00Z'),
      },
    ];

    const results = countChoices(
      options,
      tallyAnswers({ kind: 'multipleChoice' }, answers)
    );

    expect(results.find((r) => r.optionId === 'a')?.count).toBe(0);
    expect(results.find((r) => r.optionId === 'b')?.count).toBe(1);
  });

  it('scores only the replacement answer on a quiz', () => {
    const quizOptions: OptionLike[] = [
      { id: 'right', label: 'Right', position: 0, isCorrect: true },
      { id: 'wrong', label: 'Wrong', position: 1, isCorrect: false },
    ];

    const board = buildLeaderboard([
      {
        id: 'q1',
        options: quizOptions,
        answers: [
          {
            participantKey: 'p1',
            participantName: 'Ada',
            submissionId: 's1',
            option_id: 'wrong',
            createdAt: at('2026-01-01T10:00:00Z'),
          },
          {
            participantKey: 'p1',
            participantName: 'Ada',
            submissionId: 's2',
            option_id: 'right',
            createdAt: at('2026-01-01T10:00:10Z'),
          },
        ],
      },
    ]);

    expect(board).toHaveLength(1);
    expect(board[0].correctCount).toBe(1);
  });
});

describe('hasAnswered', () => {
  it('detects this browser\u2019s participant', () => {
    const answers: AnswerLike[] = [{ participantKey: 'mine' }];

    expect(hasAnswered(answers, 'mine')).toBe(true);
    expect(hasAnswered(answers, 'someone-else')).toBe(false);
  });
});
