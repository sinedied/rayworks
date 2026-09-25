import type { Question } from '../../rayfin/data/Question';
import type { Room } from '../../rayfin/data/Room';

import { getParticipantKey, rememberVote } from './identity';
import { readAll } from './paging';
import { getRayfinClient } from './rayfinClient';
import { createTolerantly } from './rayfinWrite';
import { requireManageableRoom, requireParticipatingRoom } from './rooms';

const QUESTION_FIELDS = [
  'id',
  'content',
  'authorName',
  'isAnswered',
  'isHidden',
  'createdAt',
  'room_id',
  'owner_id',
] as const;

/** A question plus its locally aggregated vote tally. */
export interface QuestionWithVotes extends Question {
  voteCount: number;
  hasVoted: boolean;
}

function toQuestion(row: Question): Question {
  return { ...row, createdAt: new Date(row.createdAt) };
}

export async function askQuestion(
  room: Pick<Room, 'id' | 'owner_id'>,
  input: { content: string; authorName?: string }
): Promise<Question> {
  const current = await requireParticipatingRoom(room.id);
  if (current.qnaEnabled === false || !current.isAcceptingQuestions) {
    throw new Error('The presenter has paused new questions.');
  }
  const client = getRayfinClient();
  const question = {
    id: crypto.randomUUID(),
    content: input.content.trim(),
    authorName: input.authorName?.trim() || undefined,
    isAnswered: false,
    isHidden: false,
    createdAt: new Date(),
    room_id: room.id,
    owner_id: current.owner_id,
  };

  return createTolerantly(
    async () => await client.data.Question.create(question),
    question
  );
}

export async function listQuestions(roomId: string): Promise<Question[]> {
  const client = getRayfinClient();
  const rows = await readAll(client.data.Question.select([...QUESTION_FIELDS])
    .where({ room_id: { eq: roomId } })
    .orderBy({ createdAt: 'desc', id: 'asc' }));

  return rows.map(toQuestion);
}

/**
 * Vote rows for a room. Totals are aggregated client-side because the fluent client
 * has no `count()` and a denormalized counter would be forgeable by anonymous callers.
 */
export async function listVotes(
  roomId: string
): Promise<{ id: string; question_id: string }[]> {
  const client = getRayfinClient();
  const rows = await readAll(client.data.Vote.select(['id', 'question_id'])
    .where({ room_id: { eq: roomId } })
    .orderBy({ id: 'asc' }));

  return rows;
}

export async function upvoteQuestion(
  question: Pick<Question, 'id' | 'room_id' | 'owner_id'>
): Promise<void> {
  const room = await requireParticipatingRoom(question.room_id);
  if (room.qnaEnabled === false) throw new Error('Q&A is turned off.');
  const client = getRayfinClient();
  const rows = await client.data.Question.select(['id'])
    .where({ id: { eq: question.id }, room_id: { eq: room.id }, isHidden: { eq: false } })
    .first(1).execute();
  if (!rows.length) throw new Error('This question is no longer available.');
  const vote = {
    id: crypto.randomUUID(),
    voterKey: getParticipantKey(),
    createdAt: new Date(),
    question_id: question.id,
    room_id: question.room_id,
    owner_id: room.owner_id,
  };

  await createTolerantly(
    async () => await client.data.Vote.create(vote),
    vote
  );
  rememberVote(question.id);
}

/** Joins questions with their vote tallies and sorts most-upvoted first. */
export function tallyQuestions(
  questions: Question[],
  votes: { question_id: string }[],
  votedIds: Set<string>
): QuestionWithVotes[] {
  const counts = new Map<string, number>();
  for (const vote of votes) {
    counts.set(vote.question_id, (counts.get(vote.question_id) ?? 0) + 1);
  }

  return questions
    .map((question) => ({
      ...question,
      voteCount: counts.get(question.id) ?? 0,
      hasVoted: votedIds.has(question.id),
    }))
    .sort(
      (a, b) =>
        b.voteCount - a.voteCount ||
        b.createdAt.getTime() - a.createdAt.getTime()
    );
}

export async function setQuestionAnswered(
  id: string,
  isAnswered: boolean
): Promise<void> {
  await getRayfinClient().data.Question.update({ id }, { isAnswered });
}

export async function setQuestionHidden(
  id: string,
  isHidden: boolean
): Promise<void> {
  await getRayfinClient().data.Question.update({ id }, { isHidden });
}

/** Votes reference the question, so they are removed first. */
export async function deleteQuestion(id: string): Promise<void> {
  const client = getRayfinClient();
  const [question] = await client.data.Question.select(['id', 'room_id', 'owner_id'])
    .where({ id: { eq: id } }).first(1).execute();
  if (!question) throw new Error('This question is no longer available. Refresh the list before trying again.');
  const room = await requireManageableRoom(question.room_id);
  if (question.owner_id !== room.owner_id) {
    throw new Error('This question does not belong to the room owner.');
  }
  const votes = await readAll(client.data.Vote.select(['id'])
    .where({ question_id: { eq: id }, room_id: { eq: room.id } })
    .orderBy({ id: 'asc' }));

  await requireManageableRoom(room.id);
  try {
    for (const vote of votes) {
      await client.data.Vote.delete({ id: vote.id });
    }
    await client.data.Question.delete({ id });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'A data operation failed.';
    throw new Error(`Could not finish deleting the question. Some votes may have been removed; refresh and retry. ${detail}`);
  }
}
