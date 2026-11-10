import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityKind } from '../../rayfin/data/Activity';
import { createActivity, saveActivityConfiguration, type NewActivityInput } from '@/services/activities';
import { activity, answer, backend, client, data, option, room, seed } from './helpers/roomData';

vi.mock('@/services/rayfinClient', () => ({ getRayfinClient: () => client }));

beforeEach(() => { seed(); data.Answer.rows.clear(); });

const input = (): NewActivityInput => ({
  kind: 'quiz', prompt: 'Edited question', timeLimitSeconds: 45,
  allowMultiple: true, allowChangeAnswer: true, showResults: false,
  options: [
    { id: option.id, label: 'Same label', isCorrect: false },
    { id: 'new-option', label: 'Same label', isCorrect: true },
  ],
});

describe('saveActivityConfiguration', () => {
  it('updates configuration and options without replacing identity, lifecycle, or run order', async () => {
    await saveActivityConfiguration(activity.id, input());
    expect(data.Activity.rows.get(activity.id)).toEqual({
      ...activity, prompt: 'Edited question', timeLimitSeconds: 45,
      allowMultiple: true, allowChangeAnswer: true, showResults: false,
    });
    expect(data.ActivityOption.rows.get(option.id)).toMatchObject({
      label: 'Same label', position: 0, isCorrect: false, revealedCorrect: false,
    });
    expect(data.ActivityOption.rows.get('new-option')).toMatchObject({
      label: 'Same label', position: 1, isCorrect: true, revealedCorrect: false,
      activity_id: activity.id, room_id: room.id, owner_id: room.owner_id,
    });
    expect(data.ActivityOption.rows.has('option-2')).toBe(false);
  });

  it.each<ActivityKind>(['multipleChoice', 'wordCloud', 'rating', 'openText', 'ranking', 'quiz', 'globe'])(
    'edits an unanswered %s draft', async (kind) => {
      data.Activity.rows.set(activity.id, { ...activity, kind, state: 'draft' });
      await saveActivityConfiguration(activity.id, { ...input(), kind, maxRating: 8 });
      expect(data.Activity.rows.get(activity.id)).toMatchObject({ kind, prompt: 'Edited question', state: 'draft' });
      if (kind === 'rating') expect(data.Activity.rows.get(activity.id)?.maxRating).toBe(8);
    }
  );

  it.each([true, false])('rejects live activities, including prepared quizzes (%s)', async (isPrepared) => {
    data.Activity.rows.set(activity.id, { ...activity, state: 'live', isPrepared });
    await expect(saveActivityConfiguration(activity.id, input())).rejects.toThrow('End this activity');
    expect(backend.writes).toEqual([]);
  });

  it('rejects hidden answers even if the editor was opened before they arrived', async () => {
    backend.before = (table, op) => {
      if (table === 'Answer' && op === 'read') data.Answer.rows.set(answer.id, { ...answer });
    };
    await expect(saveActivityConfiguration(activity.id, input())).rejects.toThrow('Clear all responses');
    expect(backend.writes).toEqual([]);
  });

  it.each(['reset', 'non-owner', 'kind', 'foreign-option'])('rejects %s without writing', async (scenario) => {
    const draft = input();
    if (scenario === 'reset') data.Room.rows.set(room.id, { ...room, isResetting: true });
    if (scenario === 'non-owner') backend.userId = 'other';
    if (scenario === 'kind') draft.kind = 'ranking';
    if (scenario === 'foreign-option') {
      data.ActivityOption.rows.set('new-option', { ...option, id: 'new-option', activity_id: 'foreign' });
    }
    await expect(saveActivityConfiguration(activity.id, draft)).rejects.toThrow();
    expect(backend.writes).toEqual([]);
  });

  it('retries a partial save without duplicating newly created options', async () => {
    backend.failure = { table: 'ActivityOption', operation: 'delete', remaining: 1 };
    const draft = input();
    await expect(saveActivityConfiguration(activity.id, draft)).rejects.toThrow();
    expect(data.ActivityOption.rows.has('new-option')).toBe(true);
    await saveActivityConfiguration(activity.id, draft);
    expect([...data.ActivityOption.rows.keys()]).toEqual([option.id, 'new-option']);
  });

  it.each([
    { prompt: '' }, { prompt: 'x'.repeat(501) }, { options: [] },
    { timeLimitSeconds: -1 }, { timeLimitSeconds: 1.5 },
  ])('rejects invalid input %j', async (changes) => {
    await expect(saveActivityConfiguration(activity.id, { ...input(), ...changes })).rejects.toThrow();
    expect(backend.writes).toEqual([]);
  });
});

it('keeps duplicate-label quiz correctness attached to option IDs on creation', async () => {
  const created = await createActivity(room, {
    ...input(),
    options: [
      { id: 'new-a', label: 'Same', isCorrect: false },
      { id: 'new-b', label: 'Same', isCorrect: true },
    ],
  }, 1);
  expect(created.state).toBe('draft');
  expect(data.ActivityOption.rows.get('new-a')?.isCorrect).toBe(false);
  expect(data.ActivityOption.rows.get('new-b')?.isCorrect).toBe(true);
});

it('resumes a partial creation without duplicating its activity or options', async () => {
  const draft = {
    ...input(), id: 'new-activity',
    options: [
      { id: 'new-a', label: 'One', isCorrect: false },
      { id: 'new-b', label: 'Two', isCorrect: true },
    ],
  };
  backend.failure = { table: 'ActivityOption', operation: 'create', remaining: 2 };
  await expect(createActivity(room, draft, 1)).rejects.toThrow();
  await createActivity(room, draft, 1);
  expect([...data.Activity.rows.keys()]).toEqual([activity.id, 'new-activity']);
  expect([...data.ActivityOption.rows.values()].filter((row) => row.activity_id === 'new-activity')).toHaveLength(2);
});

describe('globe activities', () => {
  const globe = (changes: Partial<NewActivityInput> = {}): NewActivityInput => ({
    id: 'globe-1', kind: 'globe', prompt: 'Where are you joining from?',
    allowMultiple: true, allowChangeAnswer: true, venuePlaceId: ' 2988507 ', ...changes,
  });

  it('creates a globe with a venue, no options, and a single answer per person', async () => {
    const created = await createActivity(room, globe({ options: input().options }), 1);
    expect(created).toMatchObject({ kind: 'globe', venuePlaceId: '2988507', allowMultiple: false, allowChangeAnswer: true });
    expect(data.Activity.rows.get('globe-1')).toMatchObject({ venuePlaceId: '2988507', allowMultiple: false });
    expect([...data.ActivityOption.rows.values()].filter((row) => row.activity_id === 'globe-1')).toEqual([]);
  });

  it('creates a globe without a venue and keeps the column off other kinds', async () => {
    await createActivity(room, globe({ venuePlaceId: undefined }), 1);
    expect(data.Activity.rows.get('globe-1')?.venuePlaceId).toBeUndefined();
    await createActivity(room, {
      ...input(), id: 'quiz-2', venuePlaceId: '2988507',
      options: [{ id: 'q2-a', label: 'A', isCorrect: true }, { id: 'q2-b', label: 'B', isCorrect: false }],
    }, 2);
    expect(data.Activity.rows.get('quiz-2')).not.toHaveProperty('venuePlaceId');
  });

  it('updates and clears the venue when editing', async () => {
    data.Activity.rows.set(activity.id, { ...activity, kind: 'globe', state: 'draft' });
    await saveActivityConfiguration(activity.id, globe({ venuePlaceId: '5128581' }));
    expect(data.Activity.rows.get(activity.id)?.venuePlaceId).toBe('5128581');
    await saveActivityConfiguration(activity.id, globe({ venuePlaceId: '' }));
    expect(data.Activity.rows.get(activity.id)?.venuePlaceId).toBeNull();
  });

  it.each(['Paris', '1'.repeat(21), '12 34'])('rejects a malformed venue %j without writing', async (venuePlaceId) => {
    await expect(createActivity(room, globe({ venuePlaceId }), 1)).rejects.toThrow('Pick a city');
    expect(backend.writes).toEqual([]);
  });
});
