import type { Room } from '../../rayfin/data/Room';
import type { Activity } from '../../rayfin/data/Activity';
import type { QuizRun } from '../../rayfin/data/QuizRun';
import type { QuizQuestionRun } from '../../rayfin/data/QuizQuestionRun';
import {
  completeQuizAnswers, quizSeries, shouldAutoReveal, quizParticipantScore, type QuizRunData,
} from '@/lib/quizRuns';
import { listActivities, listOptions, updateActivity } from './activities';
import { getParticipantKey, setParticipantName } from './identity';
import { readAll } from './paging';
import { getRayfinClient } from './rayfinClient';
import { createTolerantly } from './rayfinWrite';
import {
  currentUserIdOrNull, getRoomById, requireManageableRoom, requireParticipatingRoom, requireRoomOwner, updateRoom,
} from './rooms';

const RUN_FIELDS = ['id', 'room_id', 'owner_id', 'seriesKey', 'title', 'state', 'createdAt', 'startedAt', 'endedAt'] as const;
const QUESTION_FIELDS = [
  'id', 'run_id', 'activity_id', 'room_id', 'owner_id', 'snapshotKey', 'prompt', 'position',
  'timeLimitSeconds', 'allowMultiple', 'allowChangeAnswer', 'showResults', 'published', 'state',
  'startedAt', 'closedAt', 'revealedAt',
] as const;
const OPTION_FIELDS = [
  'id', 'question_id', 'run_id', 'activity_id', 'option_id', 'room_id', 'owner_id', 'snapshotKey',
  'label', 'position', 'revealedCorrect', 'published',
] as const;
const PARTICIPANT_FIELDS = ['id', 'run_id', 'room_id', 'owner_id', 'participantKey', 'participantName', 'joinKey', 'createdAt'] as const;
const MEMBER_FIELDS = ['id', 'question_id', 'run_id', 'room_id', 'owner_id', 'participantKey', 'participantName', 'membershipKey', 'scored', 'answered', 'acceptedSubmissionId'] as const;
const ANSWER_FIELDS = [
  'id', 'activity_id', 'room_id', 'owner_id', 'participantKey', 'participantName', 'submissionId',
  'submissionSize', 'quizQuestionId', 'option_id', 'elapsedMs', 'isHidden', 'createdAt',
] as const;

function date(value?: Date): Date | undefined {
  return value ? new Date(value) : undefined;
}

export async function listQuizRuns(roomId: string): Promise<QuizRun[]> {
  const rows = await readAll(getRayfinClient().data.QuizRun.select([...RUN_FIELDS])
    .where({ room_id: { eq: roomId } }).orderBy({ createdAt: 'desc', id: 'asc' }));
  return rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt), startedAt: date(row.startedAt), endedAt: date(row.endedAt) }));
}

export async function loadQuizRun(room: Pick<Room, 'id' | 'owner_id'>, runId: string): Promise<QuizRunData> {
  const client = getRayfinClient();
  const [row] = await client.data.QuizRun.select([...RUN_FIELDS])
    .where({ id: { eq: runId }, room_id: { eq: room.id } }).first(1).execute();
  if (!row) throw new Error('This quiz run is no longer available. Refresh the room.');
  const owner = currentUserIdOrNull() === room.owner_id;
  const [questionRows, options, participants, members] = await Promise.all([
    readAll(client.data.QuizQuestionRun.select([...QUESTION_FIELDS])
      .where({ run_id: { eq: runId }, room_id: { eq: room.id } }).orderBy({ position: 'asc', id: 'asc' })),
    readAll(client.data.QuizQuestionOption.select(owner ? [...OPTION_FIELDS, 'isCorrect'] : [...OPTION_FIELDS])
      .where({ run_id: { eq: runId }, room_id: { eq: room.id } }).orderBy({ position: 'asc', id: 'asc' })),
    readAll(client.data.QuizParticipant.select([...PARTICIPANT_FIELDS])
      .where({ run_id: { eq: runId }, room_id: { eq: room.id } }).orderBy({ id: 'asc' })),
    readAll(client.data.QuizQuestionParticipant.select(owner
      ? [...MEMBER_FIELDS, 'score', 'correct'] : [...MEMBER_FIELDS])
      .where({ run_id: { eq: runId }, room_id: { eq: room.id } }).orderBy({ id: 'asc' })),
  ]);
  const questions = questionRows.map((question) => ({
    ...question, startedAt: date(question.startedAt), closedAt: date(question.closedAt), revealedAt: date(question.revealedAt),
  }));
  const answerRows = questions.length ? await readAll(client.data.Answer.select([...ANSWER_FIELDS])
    .where({ room_id: { eq: room.id }, quizQuestionId: { in: questions.map((question) => question.id) } })
    .orderBy({ id: 'asc' })) : [];
  return {
    run: { ...row, createdAt: new Date(row.createdAt), startedAt: date(row.startedAt), endedAt: date(row.endedAt) },
    questions, options, participants: participants.map((participant) => ({ ...participant, createdAt: new Date(participant.createdAt) })),
    members, answers: answerRows.map((answer) => ({ ...answer, createdAt: new Date(answer.createdAt) })),
  };
}

export async function loadQuizHistory(room: Pick<Room, 'id' | 'owner_id'>): Promise<QuizRunData[]> {
  await requireManageableRoom(room.id);
  const runs = await listQuizRuns(room.id);
  return Promise.all(runs.filter((run) => run.state !== 'building').map((run) => loadQuizRun(room, run.id)));
}

async function seriesKey(activities: Activity[]): Promise<string> {
  const bytes = new TextEncoder().encode(activities.map((activity) => activity.id).sort().join(':'));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function endLiveActivities(roomId: string): Promise<void> {
  for (const activity of await listActivities(roomId)) {
    if (activity.state === 'live') await updateActivity(activity.id, { state: 'ended' });
  }
}

async function showQuestion(room: Room, question: QuizQuestionRun): Promise<void> {
  await endLiveActivities(room.id);
  await updateActivity(question.activity_id, {
    quizQuestionId: question.id, state: question.state === 'lobby' || question.state === 'running' ? 'live' : 'ended',
    isPrepared: question.state === 'lobby',
    startedAt: question.startedAt ?? null,
  });
  await updateRoom(room.id, {
    quizRunId: question.run_id, displayedActivityId: question.activity_id, displayedQuestionId: question.id,
  });
}

async function publishOptions(data: QuizRunData, questionId: string): Promise<void> {
  for (const option of data.options.filter((item) => item.question_id === questionId && !item.published)) {
    await getRayfinClient().data.QuizQuestionOption.update({ id: option.id }, { published: true });
  }
}

export async function openQuizSeries(roomId: string, activityId: string, restart = false): Promise<void> {
  const room = await requireManageableRoom(roomId);
  const activities = await listActivities(roomId);
  const series = quizSeries(activities, activityId);
  if (!series.length) throw new Error('Select a quiz activity.');
  const key = await seriesKey(series);
  const runs = await listQuizRuns(roomId);
  const current = room.quizRunId ? runs.find((run) => run.id === room.quizRunId) : undefined;
  if (!restart && current?.seriesKey === key && current.state !== 'building') {
    await openQuizQuestion(roomId, current.id, activityId);
    return;
  }
  if (current && current.state !== 'finished' && current.state !== 'building') {
    await finishQuiz(roomId, current.id);
  }
  const previous = runs.find((item) => item.seriesKey === key && item.startedAt && item.state !== 'building');
  if (!restart && previous && previous.id !== current?.id) {
    await updateRoom(roomId, { quizRunId: previous.id });
    await openQuizQuestion(roomId, previous.id, activityId);
    return;
  }
  const client = getRayfinClient();
  let run = runs.find((item) => item.seriesKey === key && item.state === 'building');
  if (!run) {
    run = {
      id: crypto.randomUUID(), room_id: roomId, owner_id: room.owner_id, seriesKey: key,
      title: series[0].prompt, state: 'building', createdAt: new Date(),
    };
    await client.data.QuizRun.create(run);
  }
  // Publish the recoverable building state, never another run's old reveal.
  await endLiveActivities(roomId);
  await updateRoom(roomId, { quizRunId: run.id, displayedActivityId: series[0].id, displayedQuestionId: null });
  const data = await loadQuizRun(room, run.id);
  const options = await listOptions(roomId);
  for (const [position, activity] of series.entries()) {
    let question = data.questions.find((item) => item.activity_id === activity.id);
    if (!question) {
      question = {
        id: crypto.randomUUID(), run_id: run.id, activity_id: activity.id, room_id: roomId, owner_id: room.owner_id,
        snapshotKey: `${run.id}:${activity.id}`, prompt: activity.prompt, position,
        timeLimitSeconds: activity.timeLimitSeconds ?? 0, allowMultiple: activity.allowMultiple,
        allowChangeAnswer: activity.allowChangeAnswer === true, showResults: activity.showResults,
        published: false, state: 'pending',
      };
      await client.data.QuizQuestionRun.create(question);
    }
    for (const option of options.filter((item) => item.activity_id === activity.id)) {
      if (data.options.some((item) => item.question_id === question.id && item.option_id === option.id)) continue;
      await client.data.QuizQuestionOption.create({
        id: crypto.randomUUID(), question_id: question.id, run_id: run.id, activity_id: activity.id,
        option_id: option.id, room_id: roomId, owner_id: room.owner_id, snapshotKey: `${question.id}:${option.id}`,
        label: option.label, position: option.position, isCorrect: option.isCorrect, revealedCorrect: false, published: false,
      });
    }
  }
  const ready = await loadQuizRun(room, run.id);
  const first = ready.questions[0];
  if (!first || ready.questions.length !== series.length ||
      ready.questions.some((question) => ready.options.filter((option) => option.question_id === question.id).length < 2)) {
    throw new Error('Quiz setup is incomplete. Fix the quiz options, then retry Open quiz.');
  }
  await client.data.QuizQuestionRun.update({ id: first.id }, { state: 'lobby', published: true });
  await client.data.QuizRun.update({ id: run.id }, { state: 'lobby' });
  await showQuestion(room, { ...first, state: 'lobby', published: true });
}

export async function joinQuiz(roomId: string, runId: string, nickname: string): Promise<void> {
  const name = nickname.trim();
  if (!name || name.length > 80) throw new Error('Enter a nickname of 1 to 80 characters.');
  const room = await requireParticipatingRoom(roomId);
  if (room.quizRunId !== runId) throw new Error('This quiz changed. Join the current run instead.');
  const data = await loadQuizRun(room, runId);
  if (data.run.state !== 'lobby' && data.run.state !== 'running') throw new Error('This quiz is not accepting joins.');
  const participantKey = getParticipantKey();
  const existing = data.participants.find((participant) => participant.participantKey === participantKey);
  if (!existing) {
    const row = {
      id: crypto.randomUUID(), run_id: runId, room_id: roomId, owner_id: room.owner_id,
      participantKey, participantName: name, joinKey: `${runId}:${participantKey}`, createdAt: new Date(),
    };
    try {
      await createTolerantly(() => getRayfinClient().data.QuizParticipant.create(row), row);
    } catch (error) {
      const joined = await getRayfinClient().data.QuizParticipant.select([...PARTICIPANT_FIELDS])
        .where({ joinKey: { eq: row.joinKey } }).first(1).execute();
      if (!joined.length) throw error;
    }
  }
  setParticipantName(existing?.participantName ?? name);
}

async function ownerQuestion(roomId: string, runId: string, questionId: string) {
  const room = await requireManageableRoom(roomId);
  if (room.quizRunId !== runId) throw new Error('The quiz run changed. Refresh before continuing.');
  const data = await loadQuizRun(room, runId);
  const question = data.questions.find((item) => item.id === questionId);
  if (!question) throw new Error('Quiz question not found.');
  return { room, data, question };
}

export async function startQuizQuestion(roomId: string, runId: string, questionId: string): Promise<void> {
  const { room, data, question } = await ownerQuestion(roomId, runId, questionId);
  if (data.run.state === 'finished') throw new Error('Restart the quiz to answer again.');
  if (question.state === 'running' && question.startedAt) {
    if (!data.run.startedAt || data.run.state !== 'running') {
      await getRayfinClient().data.QuizRun.update({ id: runId }, { state: 'running', startedAt: data.run.startedAt ?? question.startedAt });
    }
    await showQuestion(room, question);
    return;
  }
  if (!['pending', 'lobby', 'starting'].includes(question.state)) {
    throw new Error('This question has already started. Review it or restart the quiz.');
  }
  const client = getRayfinClient();
  await client.data.QuizQuestionRun.update({ id: questionId }, { state: 'starting', published: true });
  const distinct = new Map(data.participants.map((participant) => [participant.participantKey, participant]));
  for (const participant of distinct.values()) {
    if (data.members.some((member) => member.question_id === questionId && member.participantKey === participant.participantKey)) continue;
    await client.data.QuizQuestionParticipant.create({
      id: crypto.randomUUID(), question_id: questionId, run_id: runId, room_id: roomId, owner_id: room.owner_id,
      participantKey: participant.participantKey, participantName: participant.participantName,
      membershipKey: `${questionId}:${participant.participantKey}`, scored: false, answered: false, correct: false, score: 0,
    });
  }
  await publishOptions(data, questionId);
  const fresh = await requireManageableRoom(roomId);
  if (fresh.quizRunId !== runId) throw new Error('The quiz changed while starting. Refresh the room.');
  const startedAt = new Date();
  await client.data.QuizRun.update({ id: runId }, { state: 'running', startedAt: data.run.startedAt ?? startedAt });
  await client.data.QuizQuestionRun.update({ id: questionId }, { state: 'running', startedAt });
  await showQuestion(room, { ...question, state: 'running', startedAt });
}

export async function closeQuizQuestion(roomId: string, runId: string, questionId: string, reveal: boolean): Promise<void> {
  const { data, question } = await ownerQuestion(roomId, runId, questionId);
  if (question.state === 'revealed' || question.state === 'cleared') {
    const room = await getRoomById(roomId);
    if (room?.quizRunId === runId && room.displayedQuestionId === questionId) {
      await updateActivity(question.activity_id, { state: 'ended', isPrepared: false });
    }
    return;
  }
  if (!question.startedAt) throw new Error('Start the question before closing or revealing it.');
  const client = getRayfinClient();
  const closedAt = question.closedAt ?? new Date();
  if (!question.closedAt) {
    await client.data.QuizQuestionRun.update({ id: questionId }, { state: 'closing', closedAt });
  }
  const closed = { ...question, closedAt };
  for (const member of data.members.filter((item) => item.question_id === questionId && !item.scored)) {
    await client.data.QuizQuestionParticipant.update({ id: member.id }, {
      ...quizParticipantScore(closed, data.options, data.answers, member.participantKey), scored: true,
    });
  }
  if (reveal || question.state === 'revealing') {
    await client.data.QuizQuestionRun.update({ id: questionId }, { state: 'revealing' });
    for (const option of data.options.filter((item) => item.question_id === questionId)) {
      await client.data.QuizQuestionOption.update({ id: option.id }, { revealedCorrect: option.isCorrect, published: true });
    }
    await client.data.QuizQuestionRun.update({ id: questionId }, { state: 'revealed', revealedAt: question.revealedAt ?? new Date() });
  } else {
    await client.data.QuizQuestionRun.update({ id: questionId }, { state: 'closed' });
  }
  // A reveal never republishes a cursor: a delayed old callback cannot navigate a new run.
  const current = await getRoomById(roomId);
  if (current?.quizRunId === runId && current.displayedQuestionId === questionId) {
    await updateActivity(question.activity_id, { state: 'ended', isPrepared: false });
  }
}

export async function autoRevealQuiz(roomId: string, runId: string, questionId: string): Promise<boolean> {
  const { room, data, question } = await ownerQuestion(roomId, runId, questionId);
  if (!room.quizAutoReveal || room.displayedQuestionId !== questionId || data.run.state !== 'running') return false;
  if (question.state === 'revealed') return true;
  if (shouldAutoReveal(question, data.members, data.answers) || question.state === 'closing' || question.state === 'revealing') {
    await closeQuizQuestion(roomId, runId, questionId, true);
    return true;
  }
  return false;
}

export async function finishQuiz(roomId: string, runId: string): Promise<void> {
  const room = await requireManageableRoom(roomId);
  if (room.quizRunId !== runId) throw new Error('This quiz is no longer current.');
  const data = await loadQuizRun(room, runId);
  for (const question of data.questions) {
    if (question.state === 'running' || question.state === 'closing' || question.state === 'revealing') {
      await closeQuizQuestion(roomId, runId, question.id, room.quizAutoReveal === true);
    } else if (question.state === 'lobby' || question.state === 'starting') {
      await getRayfinClient().data.QuizQuestionRun.update({ id: question.id }, { state: 'closed', closedAt: new Date() });
    }
  }
  await endLiveActivities(roomId);
  await getRayfinClient().data.QuizRun.update({ id: runId }, { state: 'finished', endedAt: data.run.endedAt ?? new Date() });
}

export async function openQuizQuestion(roomId: string, runId: string, activityId: string): Promise<void> {
  const room = await requireManageableRoom(roomId);
  if (room.quizRunId !== runId) throw new Error('This quiz is no longer current.');
  const data = await loadQuizRun(room, runId);
  const target = data.questions.find((question) => question.activity_id === activityId);
  if (!target) throw new Error('This activity is not part of the current quiz.');
  if (data.run.state === 'lobby' && target.position !== 0) {
    await startQuizQuestion(roomId, runId, data.questions[0].id);
    return;
  }
  for (const question of data.questions) {
    if (question.id !== target.id && ['running', 'closing', 'revealing'].includes(question.state)) {
      await closeQuizQuestion(roomId, runId, question.id, room.quizAutoReveal === true);
    }
  }
  if (target.state === 'pending' || target.state === 'starting') {
    await startQuizQuestion(roomId, runId, target.id);
  } else {
    await showQuestion(room, target);
  }
}

export async function validateQuizSubmission(activity: Activity, optionIds: string[]): Promise<QuizQuestionRun> {
  const room = await requireParticipatingRoom(activity.room_id);
  if (!room.quizRunId || !activity.quizQuestionId || room.displayedQuestionId !== activity.quizQuestionId) {
    throw new Error('This question changed. Wait for the current quiz question.');
  }
  const data = await loadQuizRun(room, room.quizRunId);
  const question = data.questions.find((item) => item.id === activity.quizQuestionId);
  const member = data.members.find((item) => item.question_id === question?.id && item.participantKey === getParticipantKey());
  if (!question || data.run.state !== 'running' || question.state !== 'running' || !member || !question.startedAt) {
    throw new Error('You are not eligible for this question, or answering has closed.');
  }
  if (!question.allowChangeAnswer &&
      completeQuizAnswers(question, data.answers).some((answer) => answer.participantKey === member.participantKey)) {
    throw new Error('You have already answered this question.');
  }
  if (question.timeLimitSeconds > 0 && Date.now() >= question.startedAt.getTime() + question.timeLimitSeconds * 1000) {
    throw new Error('This question is closed.');
  }
  const options = data.options.filter((option) => option.question_id === question.id);
  if (!optionIds.length || new Set(optionIds).size !== optionIds.length ||
      (!question.allowMultiple && optionIds.length !== 1) ||
      optionIds.some((id) => !options.some((option) => option.option_id === id))) {
    throw new Error('Select valid options from the current question.');
  }
  return question;
}

export async function requireInactiveQuiz(roomId: string, activityIds: string[]): Promise<void> {
  const room = await requireManageableRoom(roomId);
  if (!room.quizRunId) return;
  const data = await loadQuizRun(room, room.quizRunId);
  if (data.run.state !== 'finished' && data.questions.some((question) => activityIds.includes(question.activity_id))) {
    throw new Error('Finish the quiz before editing, clearing, deleting, or reordering its activities.');
  }
}

export async function updateQuizQuestionSettings(
  roomId: string,
  activityId: string,
  updates: { showResults?: boolean; allowChangeAnswer?: boolean }
): Promise<void> {
  const room = await requireManageableRoom(roomId);
  if (room.quizRunId) {
    const data = await loadQuizRun(room, room.quizRunId);
    const question = data.questions.find((item) => item.activity_id === activityId);
    if (question && data.run.state !== 'finished') {
      await getRayfinClient().data.QuizQuestionRun.update({ id: question.id }, updates);
    }
  }
  await updateActivity(activityId, updates);
}

export async function clearQuizHistory(roomId: string, activityId?: string, deleting = false): Promise<void> {
  await requireRoomOwner(roomId);
  const client = getRayfinClient();
  const runs = await listQuizRuns(roomId);
  for (const run of runs) {
    const room = await getRoomById(roomId);
    if (!room) throw new Error('Room not found.');
    const data = await loadQuizRun(room, run.id);
    const targets = data.questions.filter((question) => !activityId || question.activity_id === activityId);
    for (const question of targets) {
      for (const answer of data.answers.filter((item) => item.quizQuestionId === question.id)) {
        await client.data.Answer.delete({ id: answer.id });
      }
      for (const member of data.members.filter((item) => item.question_id === question.id)) {
        await client.data.QuizQuestionParticipant.delete({ id: member.id });
      }
      if (!activityId || deleting) {
        for (const option of data.options.filter((item) => item.question_id === question.id)) {
          await client.data.QuizQuestionOption.delete({ id: option.id });
        }
        await client.data.QuizQuestionRun.delete({ id: question.id });
      } else {
        await client.data.QuizQuestionRun.update({ id: question.id }, { state: 'cleared' });
      }
    }
    if (!activityId || (deleting && targets.length === data.questions.length)) {
      for (const participant of data.participants) await client.data.QuizParticipant.delete({ id: participant.id });
      await client.data.QuizRun.delete({ id: run.id });
      if (room.quizRunId === run.id) {
        await updateRoom(roomId, { quizRunId: null, displayedQuestionId: null });
      }
    } else if (targets.some((question) => question.id === room.displayedQuestionId)) {
      await updateRoom(roomId, { displayedQuestionId: null });
    }
  }
}
