import { describe, expect, it } from 'vitest';

import {
  canAnswer,
  isExpired,
  isPreparing,
  isRunning,
  remainingMs,
  showsCorrectness,
  showsDistribution,
  type QuizActivityLike,
} from '@/lib/quiz';

const START = new Date('2026-01-01T10:00:00Z');
const startedMs = START.getTime();

function quiz(overrides: Partial<QuizActivityLike> = {}): QuizActivityLike {
  return {
    kind: 'quiz',
    state: 'live',
    startedAt: START,
    timeLimitSeconds: 20,
    ...overrides,
  };
}

describe('prepare state', () => {
  it('is preparing while live and flagged', () => {
    expect(isPreparing(quiz({ isPrepared: true }))).toBe(true);
    expect(isRunning(quiz({ isPrepared: true }))).toBe(false);
  });

  it('is running once the flag clears', () => {
    expect(isRunning(quiz())).toBe(true);
    expect(isPreparing(quiz())).toBe(false);
  });

  it('is neither when the activity is not live', () => {
    expect(isPreparing(quiz({ state: 'draft', isPrepared: true }))).toBe(false);
    expect(isRunning(quiz({ state: 'ended' }))).toBe(false);
  });
});

describe('remainingMs', () => {
  it('counts down from the start', () => {
    expect(remainingMs(quiz(), startedMs)).toBe(20_000);
    expect(remainingMs(quiz(), startedMs + 5_000)).toBe(15_000);
  });

  it('never goes negative', () => {
    expect(remainingMs(quiz(), startedMs + 999_999)).toBe(0);
  });

  it('is null when untimed', () => {
    expect(remainingMs(quiz({ timeLimitSeconds: 0 }), startedMs)).toBeNull();
    expect(
      remainingMs(quiz({ timeLimitSeconds: undefined }), startedMs)
    ).toBeNull();
  });

  it('is null before the question starts', () => {
    expect(remainingMs(quiz({ isPrepared: true }), startedMs)).toBeNull();
    expect(remainingMs(quiz({ startedAt: undefined }), startedMs)).toBeNull();
  });
});

describe('canAnswer', () => {
  it('accepts answers inside the time limit', () => {
    expect(canAnswer(quiz(), startedMs + 1_000)).toBe(true);
  });

  it('refuses answers after the deadline', () => {
    expect(isExpired(quiz(), startedMs + 20_001)).toBe(true);
    expect(canAnswer(quiz(), startedMs + 20_001)).toBe(false);
  });

  it('refuses answers while still preparing', () => {
    expect(canAnswer(quiz({ isPrepared: true }), startedMs)).toBe(false);
  });

  it('refuses answers once ended', () => {
    expect(canAnswer(quiz({ state: 'ended' }), startedMs)).toBe(false);
  });

  it('keeps untimed questions open', () => {
    const untimed = quiz({ timeLimitSeconds: 0 });

    expect(isExpired(untimed, startedMs + 999_999)).toBe(false);
    expect(canAnswer(untimed, startedMs + 999_999)).toBe(true);
  });

  it('keeps non-quiz activities open regardless of a stale clock', () => {
    const poll: QuizActivityLike = { kind: 'multipleChoice', state: 'live' };

    expect(canAnswer(poll, startedMs + 999_999)).toBe(true);
  });
});

describe('showsCorrectness', () => {
  it('only trusts the revealed flag', () => {
    // isCorrect is readable by the signed-in presenter, and the projector runs in that
    // session — it must never drive the highlight.
    expect(showsCorrectness({ isCorrect: true, revealedCorrect: false })).toBe(
      false
    );
    expect(showsCorrectness({ isCorrect: true })).toBe(false);
    expect(showsCorrectness({ revealedCorrect: true })).toBe(true);
    expect(showsCorrectness({})).toBe(false);
  });
});

describe('showsDistribution', () => {
  it('always shows results for non-quiz activities', () => {
    expect(showsDistribution({ kind: 'multipleChoice', state: 'live' })).toBe(
      true
    );
  });

  it('hides a running quiz so latecomers cannot follow the crowd', () => {
    expect(showsDistribution(quiz(), startedMs + 1_000)).toBe(false);
  });

  it('hides the lobby', () => {
    expect(showsDistribution(quiz({ isPrepared: true }), startedMs)).toBe(
      false
    );
  });

  it('shows once time is up', () => {
    expect(showsDistribution(quiz(), startedMs + 20_001)).toBe(true);
  });

  it('shows once the presenter ends it', () => {
    expect(
      showsDistribution(
        quiz({ state: 'ended', timeLimitSeconds: 0 }),
        startedMs
      )
    ).toBe(true);
  });
});
