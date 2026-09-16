import { describe, expect, it } from 'vitest';

import {
  activationMode,
  canStartPrepared,
  currentActivity,
  inRunOrder,
  nextActivity,
  previousActivity,
  type RunnableActivity,
} from '@/lib/runOrder';

function activity(
  id: string,
  position: number,
  overrides: Partial<RunnableActivity> = {}
): RunnableActivity {
  return {
    id,
    kind: 'multipleChoice',
    state: 'draft',
    position,
    ...overrides,
  };
}

describe('inRunOrder', () => {
  it('sorts by position regardless of input order', () => {
    const list = [activity('c', 2), activity('a', 0), activity('b', 1)];

    expect(inRunOrder(list).map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('currentActivity', () => {
  it('finds the live one', () => {
    const list = [activity('a', 0), activity('b', 1, { state: 'live' })];

    expect(currentActivity(list)?.id).toBe('b');
  });

  it('is null when nothing is running', () => {
    expect(currentActivity([activity('a', 0)])).toBeNull();
  });
});

describe('nextActivity', () => {
  it('starts at the first activity when nothing is live', () => {
    const list = [activity('b', 1), activity('a', 0)];

    expect(nextActivity(list)?.id).toBe('a');
  });

  it('advances past the live one in position order', () => {
    const list = [
      activity('a', 0, { state: 'ended' }),
      activity('b', 1, { state: 'live' }),
      activity('c', 2),
    ];

    expect(nextActivity(list)?.id).toBe('c');
  });

  it('is null at the end of the run', () => {
    const list = [activity('a', 0), activity('b', 1, { state: 'live' })];

    expect(nextActivity(list)).toBeNull();
  });

  it('is null with no activities', () => {
    expect(nextActivity([])).toBeNull();
  });
});

describe('previousActivity', () => {
  it('steps back one position', () => {
    const list = [
      activity('a', 0),
      activity('b', 1, { state: 'live' }),
      activity('c', 2),
    ];

    expect(previousActivity(list)?.id).toBe('a');
  });

  it('is null at the start and when nothing is live', () => {
    expect(
      previousActivity([activity('a', 0, { state: 'live' })])
    ).toBeNull();
    expect(previousActivity([activity('a', 0)])).toBeNull();
  });
});

describe('activationMode', () => {
  it('prepares quizzes so nicknames come before the clock', () => {
    expect(activationMode(activity('q', 0, { kind: 'quiz' }))).toBe('prepare');
  });

  it('takes every other kind straight live', () => {
    expect(activationMode(activity('a', 0, { kind: 'wordCloud' }))).toBe('live');
    expect(activationMode(activity('b', 0, { kind: 'ranking' }))).toBe('live');
  });
});

describe('canStartPrepared', () => {
  it('is true only for a live, prepared activity', () => {
    expect(
      canStartPrepared(activity('q', 0, { state: 'live', isPrepared: true }))
    ).toBe(true);
    expect(
      canStartPrepared(activity('q', 0, { state: 'live', isPrepared: false }))
    ).toBe(false);
    expect(
      canStartPrepared(activity('q', 0, { state: 'draft', isPrepared: true }))
    ).toBe(false);
    expect(canStartPrepared(null)).toBe(false);
  });
});
