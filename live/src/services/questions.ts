import type { Question } from '../../rayfin/data/Question';
import type { Room } from '../../rayfin/data/Room';

import { getParticipantKey, rememberVote } from './identity';
import { getRayfinClient } from './rayfinClient';
import { createTolerantly } from './rayfinWrite';

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
  const client = getRayfinClient();
  const question = {
    id: crypto.randomUUID(),
    content: input.content.trim(),
    authorName: input.authorName?.trim() || undefined,
    isAnswered: false,
    isHidden: false,
    createdAt: new Date(),
    room_id: room.id,
    owner_id: room.owner_id,
  };

  return createTolerantly(
    async () => await client.data.Question.create(question),
    question
  );
}

export async function listQuestions(roomId: string): Promise<Question[]> {
  const client = getRayfinClient();
  const rows = await client.data.Question.select([...QUESTION_FIELDS])
    .where({ room_id: { eq: roomId } })
    .orderBy({ createdAt: 'desc' })
    .execute();

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
  const rows = await client.data.Vote.select(['id', 'question_id'])
    .where({ room_id: { eq: roomId } })
    .execute();

  return rows;
}

export async function upvoteQuestion(
  question: Pick<Question, 'id' | 'room_id' | 'owner_id'>
): Promise<void> {
  const client = getRayfinClient();
  const vote = {
    id: crypto.randomUUID(),
    voterKey: getParticipantKey(),
    createdAt: new Date(),
    question_id: question.id,
    room_id: question.room_id,
    owner_id: question.owner_id,
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
  const votes = await client.data.Vote.select(['id'])
    .where({ question_id: { eq: id } })
    .execute();

  for (const vote of votes) {
    await client.data.Vote.delete({ id: vote.id });
  }
  await client.data.Question.delete({ id });
}
