import type {
  Activity,
  ActivityKind,
  ActivityState,
} from '../../rayfin/data/Activity';
import type { ActivityOption } from '../../rayfin/data/ActivityOption';
import type { Room } from '../../rayfin/data/Room';

import { getRayfinClient } from './rayfinClient';

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

function toActivity(row: Activity): Activity {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    startedAt: row.startedAt ? new Date(row.startedAt) : undefined,
  };
}

export async function listActivities(roomId: string): Promise<Activity[]> {
  const client = getRayfinClient();
  const rows = await client.data.Activity.select([...ACTIVITY_FIELDS])
    .where({ room_id: { eq: roomId } })
    .orderBy({ position: 'asc' })
    .execute();

  return rows.map(toActivity);
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

  const rows = await client.data.ActivityOption.select([...fields])
    .where({ room_id: { eq: roomId } })
    .orderBy({ position: 'asc' })
    .execute();

  return rows as ActivityOption[];
}

export interface NewActivityInput {
  kind: ActivityKind;
  prompt: string;
  optionLabels?: string[];
  correctLabels?: string[];
  allowMultiple?: boolean;
  allowChangeAnswer?: boolean;
  maxRating?: number;
  timeLimitSeconds?: number;
  showResults?: boolean;
}

/** Creates an activity in `draft` along with its options. */
export async function createActivity(
  room: Pick<Room, 'id' | 'owner_id'>,
  input: NewActivityInput,
  position: number
): Promise<Activity> {
  const client = getRayfinClient();
  const activity: Activity = {
    id: crypto.randomUUID(),
    kind: input.kind,
    prompt: input.prompt.trim(),
    state: 'draft',
    position,
    showResults: input.showResults ?? true,
    allowMultiple: input.allowMultiple ?? false,
    allowChangeAnswer: input.allowChangeAnswer ?? false,
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

  const labels = (input.optionLabels ?? [])
    .map((label) => label.trim())
    .filter(Boolean);
  const correct = new Set(input.correctLabels?.map((label) => label.trim()));

  for (const [index, label] of labels.entries()) {
    await client.data.ActivityOption.create({
      id: crypto.randomUUID(),
      label,
      position: index,
      isCorrect: correct.has(label),
      revealedCorrect: false,
      activity_id: activity.id,
      room_id: room.id,
      owner_id: room.owner_id,
    });
  }

  return activity;
}

export async function updateActivity(
  id: string,
  updates: Partial<
    Pick<
      Activity,
      | 'prompt'
      | 'state'
      | 'position'
      | 'showResults'
      | 'allowMultiple'
      | 'allowChangeAnswer'
      | 'isPrepared'
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

  await clearAnswers(activityId);

  const options = await client.data.ActivityOption.select(['id'])
    .where({ activity_id: { eq: activityId } })
    .execute();
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
  const client = getRayfinClient();

  const answers = await client.data.Answer.select(['id'])
    .where({ activity_id: { eq: activityId } })
    .execute();

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
