import type {
  Activity,
  ActivityKind,
  ActivityState,
} from '../../rayfin/data/Activity';
import type { ActivityOption } from '../../rayfin/data/ActivityOption';
import type { Room } from '../../rayfin/data/Room';
import type { RayLiveSchema } from '../../rayfin/data/schema';

import { activityEditBlockReason } from '@/lib/activityEditing';

import { readAll } from './paging';
import { getRayfinClient } from './rayfinClient';
import { requireManageableRoom } from './rooms';

const ACTIVITY_FIELDS = [
  'id',
  'kind',
  'prompt',
  'state',
  'position',
  'showResults',
  'allowMultiple',
  'allowChangeAnswer',
  'isPrepared',
  'answerResetId',
  'maxRating',
  'timeLimitSeconds',
  'startedAt',
  'createdAt',
  'room_id',
  'owner_id',
] as const;

const PUBLIC_OPTION_FIELDS = [
  'id',
  'label',
  'position',
  'revealedCorrect',
  'activity_id',
  'room_id',
  'owner_id',
] as const;

/** Kinds that need a list of options the presenter defines up front. */
export const OPTION_BASED_KINDS: ActivityKind[] = [
  'multipleChoice',
  'ranking',
  'quiz',
];

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  multipleChoice: 'Multiple choice',
  wordCloud: 'Word cloud',
  rating: 'Rating',
  openText: 'Open text',
  ranking: 'Ranking',
  quiz: 'Quiz',
};

/** True when a presenter session is active, which unlocks owner-only fields. */
export function isSignedIn(): boolean {
  try {
    return getRayfinClient().auth.getSession().isAuthenticated;
  } catch {
    return false;
  }
}

function toActivity(row: RayLiveSchema['Activity']): Activity {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    startedAt: row.startedAt ? new Date(row.startedAt) : undefined,
  };
}

export async function listActivities(roomId: string): Promise<Activity[]> {
  const client = getRayfinClient();
  const rows = await readAll(client.data.Activity.select([...ACTIVITY_FIELDS])
    .where({ room_id: { eq: roomId } })
    .orderBy({ position: 'asc', id: 'asc' }));

  return rows.map(toActivity);
}

export async function getActivity(id: string): Promise<Activity> {
  const rows = await getRayfinClient().data.Activity.select([...ACTIVITY_FIELDS])
    .where({ id: { eq: id } })
    .first(1)
    .execute();
  if (!rows[0]) throw new Error('This activity is no longer available.');
  return toActivity(rows[0]);
}

/**
 * Options for every activity in a room, fetched in one query.
 *
 * `isCorrect` is excluded from anonymous reads, so selecting it as an anonymous caller
 * would fail — the answer key is only requested when a presenter is signed in.
 */
export async function listOptions(roomId: string): Promise<ActivityOption[]> {
  const client = getRayfinClient();
  const fields = isSignedIn()
    ? ([...PUBLIC_OPTION_FIELDS, 'isCorrect'] as const)
    : PUBLIC_OPTION_FIELDS;

  const rows = await readAll(client.data.ActivityOption.select([...fields])
    .where({ room_id: { eq: roomId } })
    .orderBy({ position: 'asc', id: 'asc' }));

  return rows;
}

export interface ActivityOptionInput {
  id: string;
  label: string;
  isCorrect: boolean;
}

export interface NewActivityInput {
  /** Stable across retries of a partially-created draft. */
  id?: string;
  kind: ActivityKind;
  prompt: string;
  options?: ActivityOptionInput[];
  allowMultiple?: boolean;
  allowChangeAnswer?: boolean;
  maxRating?: number;
  timeLimitSeconds?: number;
  showResults?: boolean;
}

function normalizedInput(input: NewActivityInput) {
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > 500) {
    throw new Error('Enter a question of 1 to 500 characters.');
  }
  const options = OPTION_BASED_KINDS.includes(input.kind)
    ? (input.options ?? []).map((option) => ({ ...option, label: option.label.trim() }))
    : [];
  if (OPTION_BASED_KINDS.includes(input.kind) &&
      (options.length < 2 || options.some((option) => !option.label || option.label.length > 200))) {
    throw new Error('Add at least two options, each with 1 to 200 characters.');
  }
  const maxRating = input.maxRating ?? 5;
  if (input.kind === 'rating' &&
      (!Number.isInteger(maxRating) || maxRating < 2 || maxRating > 10)) {
    throw new Error('The rating scale must be a whole number from 2 to 10.');
  }
  const timeLimitSeconds = input.timeLimitSeconds ?? 20;
  if (input.kind === 'quiz' &&
      (!Number.isInteger(timeLimitSeconds) || timeLimitSeconds < 0 || timeLimitSeconds > 300)) {
    throw new Error('The quiz time limit must be a whole number from 0 to 300 seconds.');
  }
  return {
    options,
    configuration: {
      prompt,
      showResults: input.showResults ?? true,
      allowMultiple: input.allowMultiple ?? false,
      allowChangeAnswer: input.allowChangeAnswer ?? false,
      ...(input.kind === 'rating' ? { maxRating } : {}),
      ...(input.kind === 'quiz' ? { timeLimitSeconds } : {}),
    },
  };
}

/** Creates an activity in `draft` along with its options. */
export async function createActivity(
  room: Pick<Room, 'id' | 'owner_id'>,
  input: NewActivityInput,
  position: number
): Promise<Activity> {
  await requireManageableRoom(room.id);
  const { options, configuration } = normalizedInput(input);
  const client = getRayfinClient();
  const id = input.id ?? crypto.randomUUID();
  const existing = await client.data.Activity.select([...ACTIVITY_FIELDS])
    .where({ id: { eq: id } }).first(1).execute();
  if (existing[0]) {
    if (existing[0].room_id !== room.id || existing[0].state !== 'draft') {
      throw new Error('This draft changed. Reopen the activity from the list.');
    }
    await saveActivityConfiguration(id, input);
    return getActivity(id);
  }
  const activity: Activity = {
    id,
    kind: input.kind,
    ...configuration,
    state: 'draft',
    position,
    isPrepared: false,
    maxRating: input.kind === 'rating' ? (input.maxRating ?? 5) : undefined,
    timeLimitSeconds:
      input.kind === 'quiz' ? (input.timeLimitSeconds ?? 20) : undefined,
    startedAt: undefined,
    createdAt: new Date(),
    room_id: room.id,
    owner_id: room.owner_id,
  };

  await client.data.Activity.create(activity);

  for (const [index, option] of options.entries()) {
    await client.data.ActivityOption.create({
      id: option.id,
      label: option.label,
      position: index,
      isCorrect: input.kind === 'quiz' && option.isCorrect,
      revealedCorrect: false,
      activity_id: activity.id,
      room_id: room.id,
      owner_id: room.owner_id,
    });
  }

  return activity;
}

export async function hasActivityAnswers(activityId: string): Promise<boolean> {
  const rows = await getRayfinClient().data.Answer.select(['id'])
    .where({ activity_id: { eq: activityId } })
    .first(1)
    .execute();
  return rows.length > 0;
}

export async function saveActivityConfiguration(
  activityId: string,
  input: NewActivityInput
): Promise<void> {
  const { options, configuration } = normalizedInput(input);
  const activity = await getActivity(activityId);
  await requireManageableRoom(activity.room_id);
  if (activity.kind !== input.kind) throw new Error('An activity type cannot be changed.');

  const existing = (await listOptions(activity.room_id))
    .filter((option) => option.activity_id === activity.id);
  const existingIds = new Set(existing.map((option) => option.id));
  const retainedIds = options.map((option) => option.id);
  if (new Set(retainedIds).size !== retainedIds.length) {
    throw new Error('Each option must have a unique ID.');
  }
  const client = getRayfinClient();
  for (const id of retainedIds.filter((id) => !existingIds.has(id))) {
    const rows = await client.data.ActivityOption.select(['id'])
      .where({ id: { eq: id } }).first(1).execute();
    if (rows.length) {
      throw new Error('An option belongs to another activity. Reopen the editor.');
    }
  }
  const latest = await getActivity(activityId);
  await requireManageableRoom(activity.room_id);
  const blocked = activityEditBlockReason(latest, await hasActivityAnswers(activityId));
  if (blocked) throw new Error(blocked);

  for (const [position, option] of options.entries()) {
    const updates = {
      label: option.label,
      position,
      isCorrect: input.kind === 'quiz' && option.isCorrect,
      revealedCorrect: false,
    };
    if (existingIds.has(option.id)) {
      await client.data.ActivityOption.update({ id: option.id }, updates);
    } else {
      await client.data.ActivityOption.create({
        id: option.id, ...updates, activity_id: activityId,
        room_id: activity.room_id, owner_id: activity.owner_id,
      });
    }
  }
  for (const option of existing) {
    if (!retainedIds.includes(option.id)) {
      await client.data.ActivityOption.delete({ id: option.id });
    }
  }
  await updateActivity(activityId, configuration);
}

export async function updateActivity(
  id: string,
  updates: Partial<
    Pick<
      RayLiveSchema['Activity'],
      | 'prompt'
      | 'state'
      | 'position'
      | 'showResults'
      | 'allowMultiple'
      | 'allowChangeAnswer'
      | 'isPrepared'
      | 'answerResetId'
      | 'maxRating'
      | 'timeLimitSeconds'
      | 'startedAt'
    >
  >
): Promise<void> {
  await getRayfinClient().data.Activity.update({ id }, updates);
}

async function endOthers(
  activityId: string,
  activities: Activity[]
): Promise<void> {
  for (const activity of activities) {
    if (activity.state === 'live' && activity.id !== activityId) {
      await updateActivity(activity.id, { state: 'ended' });
    }
  }
}

/**
 * Makes one activity live, ending whichever was live before. Only one activity per room
 * runs at a time, which is what lets the projected view follow the presenter with no extra
 * coordination state. `startedAt` anchors quiz timing.
 */
export async function goLive(
  activityId: string,
  activities: Activity[]
): Promise<void> {
  await endOthers(activityId, activities);

  await updateActivity(activityId, {
    state: 'live',
    isPrepared: false,
    startedAt: new Date(),
  });
}

/**
 * Opens a quiz for nicknames without starting the question. Attendees see the lobby, never the
 * prompt, so nobody gets a head start while people are still typing a name.
 */
export async function prepareActivity(
  activityId: string,
  activities: Activity[]
): Promise<void> {
  await endOthers(activityId, activities);

  await updateActivity(activityId, { state: 'live', isPrepared: true });
}

/** Starts a prepared question, stamping the clock the timer and scoring are measured from. */
export async function startPreparedActivity(
  activityId: string
): Promise<void> {
  await updateActivity(activityId, {
    isPrepared: false,
    startedAt: new Date(),
  });
}

export async function endActivity(activityId: string): Promise<void> {
  await updateActivity(activityId, { state: 'ended' });
}

export async function setActivityState(
  activityId: string,
  state: ActivityState
): Promise<void> {
  await updateActivity(activityId, { state });
}

/**
 * Publishes the quiz answer key. `isCorrect` is invisible to the audience, so revealing
 * copies it into the public `revealedCorrect` field.
 */
export async function revealAnswers(
  options: ActivityOption[]
): Promise<void> {
  const client = getRayfinClient();
  for (const option of options) {
    await client.data.ActivityOption.update(
      { id: option.id },
      { revealedCorrect: option.isCorrect ?? false }
    );
  }
}

/** Answers and options reference the activity, so they are removed first. */
export async function deleteActivity(activityId: string): Promise<void> {
  const client = getRayfinClient();

  await deleteActivityAnswers(activityId);

  const options = await readAll(client.data.ActivityOption.select(['id'])
    .where({ activity_id: { eq: activityId } })
    .orderBy({ id: 'asc' }));
  for (const option of options) {
    await client.data.ActivityOption.delete({ id: option.id });
  }

  await client.data.Activity.delete({ id: activityId });
}

/**
 * Deletes every answer for an activity, keeping the activity and its options.
 * Handy for resetting after a rehearsal, and the only way to remove answers —
 * anonymous participants cannot delete what they submitted.
 */
export async function clearAnswers(activityId: string): Promise<void> {
  const activity = await getActivity(activityId);
  await requireManageableRoom(activity.room_id);
  await deleteActivityAnswers(activityId);
  await updateActivity(activityId, { answerResetId: crypto.randomUUID() });
  if (await hasActivityAnswers(activityId)) {
    throw new Error('New answers arrived during clearing. End the activity and retry.');
  }
}

async function deleteActivityAnswers(activityId: string): Promise<void> {
  const client = getRayfinClient();

  const answers = await readAll(client.data.Answer.select(['id'])
    .where({ activity_id: { eq: activityId } })
    .orderBy({ id: 'asc' }));

  for (const answer of answers) {
    await client.data.Answer.delete({ id: answer.id });
  }
}

/** Swaps the position of two activities to move one up or down the run order. */
export async function swapPositions(
  a: Activity,
  b: Activity
): Promise<void> {
  await updateActivity(a.id, { position: b.position });
  await updateActivity(b.id, { position: a.position });
}
