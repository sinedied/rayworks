import type { Activity } from '../../rayfin/data/Activity';
import type { Answer } from '../../rayfin/data/Answer';

import {
  getParticipantKey,
  getParticipantName,
  rememberAnswered,
} from './identity';
import { canAnswer } from '@/lib/quiz';

import { getRayfinClient } from './rayfinClient';
import { createTolerantly } from './rayfinWrite';

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

/** Every answer in a room, fetched in one query and tallied client-side. */
export async function listAnswers(roomId: string): Promise<Answer[]> {
  const client = getRayfinClient();

  const rows = await client.data.Answer.select([...PUBLIC_ANSWER_FIELDS])
    .where({ room_id: { eq: roomId } })
    .execute();

  return (rows as Answer[]).map(toAnswer);
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
  // The deadline is enforced here as well as in the UI, so a stale form cannot slip an answer
  // in after time. It keeps the quiz fair; it is not a security boundary.
  if (!canAnswer(activity)) {
    throw new Error('This question is closed.');
  }

  const client = getRayfinClient();
  const submissionId = crypto.randomUUID();

  for (const draft of drafts) {
    const answer = buildAnswer(activity, draft, submissionId);
    await createTolerantly(
      async () => await client.data.Answer.create(answer),
      answer
    );
  }

  rememberAnswered(activity.id);
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

export async function deleteAnswer(id: string): Promise<void> {
  await getRayfinClient().data.Answer.delete({ id });
}
