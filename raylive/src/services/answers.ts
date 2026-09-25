import type { Activity } from '../../rayfin/data/Activity';
import type { Answer } from '../../rayfin/data/Answer';

import {
  getParticipantKey,
  getParticipantName,
  rememberAnswered,
} from './identity';
import { canAnswer } from '@/lib/quiz';
import { normalizeWordCloudText } from '@/lib/aggregate';
import { responseDeletionTargets } from '@/lib/moderation';

import { getActivity } from './activities';
import { readAll } from './paging';
import { getRayfinClient } from './rayfinClient';
import { createTolerantly } from './rayfinWrite';
import { requireManageableRoom, requireParticipatingRoom } from './rooms';

const PUBLIC_ANSWER_FIELDS = [
  'id',
  'participantKey',
  'participantName',
  'submissionId',
  'option_id',
  'textValue',
  'ratingValue',
  'rankPosition',
  'elapsedMs',
  'isHidden',
  'createdAt',
  'activity_id',
  'room_id',
  'owner_id',
] as const;

function toAnswer(row: Answer): Answer {
  return { ...row, createdAt: new Date(row.createdAt) };
}

/** Complete room or activity responses, including hidden rows when fetched by the owner. */
export async function listAnswers(roomId: string, activityId?: string): Promise<Answer[]> {
  const client = getRayfinClient();

  const rows = await readAll(client.data.Answer.select([...PUBLIC_ANSWER_FIELDS])
    .where({
      room_id: { eq: roomId },
      ...(activityId === undefined ? {} : { activity_id: { eq: activityId } }),
    })
    .orderBy({ id: 'asc' }));

  return rows.map(toAnswer);
}

type AnswerDraft = Pick<
  Answer,
  'option_id' | 'textValue' | 'ratingValue' | 'rankPosition' | 'elapsedMs'
>;

function buildAnswer(
  activity: Activity,
  draft: AnswerDraft,
  submissionId: string
): Answer {
  const name = getParticipantName();
  return {
    id: crypto.randomUUID(),
    participantKey: getParticipantKey(),
    participantName: name || undefined,
    submissionId,
    isHidden: false,
    createdAt: new Date(),
    activity_id: activity.id,
    room_id: activity.room_id,
    owner_id: activity.owner_id,
    ...draft,
  };
}

/**
 * Writes one row per draft, all sharing a submission id so a later submission can supersede
 * this one wholesale. Anonymous callers cannot read back what they write, so ids are generated
 * client-side and the read-back denial is tolerated.
 */
async function submitAll(
  activity: Activity,
  drafts: AnswerDraft[]
): Promise<void> {
  const [room, current] = await Promise.all([
    requireParticipatingRoom(activity.room_id),
    getActivity(activity.id),
  ]);
  if (current.room_id !== room.id ||
      (current.answerResetId ?? '') !== (activity.answerResetId ?? '') ||
      current.startedAt?.getTime() !== activity.startedAt?.getTime()) {
    throw new Error('This activity changed. Wait for it to refresh before answering.');
  }
  if (!canAnswer(current)) {
    throw new Error('This question is closed.');
  }

  const client = getRayfinClient();
  const submissionId = crypto.randomUUID();

  for (const draft of drafts) {
    const answer = buildAnswer(current, draft, submissionId);
    await createTolerantly(
      async () => await client.data.Answer.create(answer),
      answer
    );
  }

  rememberAnswered(current.id, current.answerResetId);
}

/** Milliseconds since the activity went live, used for quiz speed scoring. */
export function elapsedSince(activity: Activity): number | undefined {
  if (!activity.startedAt) return undefined;
  return Math.max(0, Date.now() - new Date(activity.startedAt).getTime());
}

export async function submitChoice(
  activity: Activity,
  optionIds: string[]
): Promise<void> {
  const isQuiz = activity.kind === 'quiz';
  const elapsedMs = isQuiz ? elapsedSince(activity) : undefined;

  await submitAll(
    activity,
    optionIds.map((optionId) => ({ option_id: optionId, elapsedMs }))
  );
}

export async function submitText(
  activity: Activity,
  values: string[]
): Promise<void> {
  const drafts = values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((textValue) => ({ textValue }));

  if (drafts.length > 0) await submitAll(activity, drafts);
}

export async function submitRating(
  activity: Activity,
  value: number
): Promise<void> {
  await submitAll(activity, [{ ratingValue: value }]);
}

/** Ranking stores one row per option, carrying its 1-based position. */
export async function submitRanking(
  activity: Activity,
  orderedOptionIds: string[]
): Promise<void> {
  await submitAll(
    activity,
    orderedOptionIds.map((optionId, index) => ({
      option_id: optionId,
      rankPosition: index + 1,
    }))
  );
}

export async function setAnswerHidden(
  id: string,
  isHidden: boolean
): Promise<void> {
  await getRayfinClient().data.Answer.update({ id }, { isHidden });
}

async function moderationActivity(
  activityId: string,
  kind: 'openText' | 'wordCloud'
): Promise<Activity> {
  const activity = await getActivity(activityId);
  const room = await requireManageableRoom(activity.room_id);
  if (activity.owner_id !== room.owner_id || activity.kind !== kind) {
    throw new Error('This response cannot be moderated from this activity.');
  }
  return activity;
}

async function deleteResponseSnapshot(
  activity: Activity,
  answers: Answer[],
  selected: Answer[]
): Promise<void> {
  if (!selected.length) {
    throw new Error('These responses are no longer available. Refresh the list before trying again.');
  }
  const targets = responseDeletionTargets(activity, answers, new Set(selected.map((answer) => answer.id)));
  if (targets.some((answer) => answer.owner_id !== activity.owner_id)) {
    throw new Error('These responses do not belong to the room owner.');
  }
  await requireManageableRoom(activity.room_id);
  const client = getRayfinClient();
  let deleted = 0;
  try {
    for (const answer of targets) {
      await client.data.Answer.delete({ id: answer.id });
      deleted++;
    }
    const ids = new Set(targets.map((answer) => answer.id));
    const remaining = await listAnswers(activity.room_id, activity.id);
    if (remaining.some((answer) => ids.has(answer.id))) {
      throw new Error('Some selected responses are still present.');
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'A data operation failed.';
    throw new Error(
      `Could not finish deleting responses (${deleted} of ${targets.length} deletions completed). Refresh and retry any remaining entries. ${detail}`
    );
  }
}

export async function deleteAnswer(activityId: string, answerId: string): Promise<void> {
  const activity = await moderationActivity(activityId, 'openText');
  const answers = await listAnswers(activity.room_id, activity.id);
  await deleteResponseSnapshot(activity, answers, answers.filter((answer) => answer.id === answerId));
}

export async function deleteWordCloudEntry(activityId: string, word: string): Promise<void> {
  const normalized = normalizeWordCloudText(word);
  if (!normalized) throw new Error('Select a word-cloud entry to delete.');
  const activity = await moderationActivity(activityId, 'wordCloud');
  const answers = await listAnswers(activity.room_id, activity.id);
  const selected = answers.filter((answer) =>
    normalizeWordCloudText(answer.textValue ?? '') === normalized
  );
  await deleteResponseSnapshot(activity, answers, selected);
}
