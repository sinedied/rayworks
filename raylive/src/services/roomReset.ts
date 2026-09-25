import { listActivities, listOptions, updateActivity } from './activities';
import { readAll } from './paging';
import { getRayfinClient } from './rayfinClient';
import { requireRoomOwner, updateRoom } from './rooms';

export async function resetRoomResponses(roomId: string): Promise<void> {
  const room = await requireRoomOwner(roomId);
  const resumeQuestions = room.isResetting
    ? room.resetResumeQuestions
    : room.isAcceptingQuestions;
  if (resumeQuestions === undefined || resumeQuestions === null) {
    throw new Error('The reset recovery setting is missing. Questions have not been resumed.');
  }
  const client = getRayfinClient();
  await updateRoom(roomId, {
    isResetting: true,
    resetResumeQuestions: resumeQuestions,
    isAcceptingQuestions: false,
  });

  try {
    const activities = await listActivities(roomId);
    for (const activity of activities) {
      await updateActivity(activity.id, {
        state: 'draft', isPrepared: false, startedAt: null,
      });
    }

    const [votes, questions, answers, options] = await Promise.all([
      readAll(client.data.Vote.select(['id'])
        .where({ room_id: { eq: roomId } }).orderBy({ id: 'asc' })),
      readAll(client.data.Question.select(['id'])
        .where({ room_id: { eq: roomId } }).orderBy({ id: 'asc' })),
      readAll(client.data.Answer.select(['id'])
        .where({ room_id: { eq: roomId } }).orderBy({ id: 'asc' })),
      listOptions(roomId),
    ]);
    for (const vote of votes) await client.data.Vote.delete({ id: vote.id });
    for (const question of questions) await client.data.Question.delete({ id: question.id });
    for (const answer of answers) await client.data.Answer.delete({ id: answer.id });
    for (const option of options) {
      if (option.revealedCorrect) {
        await client.data.ActivityOption.update({ id: option.id }, { revealedCorrect: false });
      }
    }
    for (const activity of activities) {
      await updateActivity(activity.id, { answerResetId: crypto.randomUUID() });
    }

    const [remainingVotes, remainingQuestions, remainingAnswers, currentActivities, currentOptions] =
      await Promise.all([
        client.data.Vote.select(['id']).where({ room_id: { eq: roomId } }).first(1).execute(),
        client.data.Question.select(['id']).where({ room_id: { eq: roomId } }).first(1).execute(),
        client.data.Answer.select(['id']).where({ room_id: { eq: roomId } }).first(1).execute(),
        listActivities(roomId),
        listOptions(roomId),
      ]);
    const resetIds = new Set(activities.map((activity) => activity.id));
    if (remainingVotes.length || remainingQuestions.length || remainingAnswers.length ||
        currentActivities.length !== activities.length ||
        currentActivities.some((activity) =>
          !resetIds.has(activity.id) || activity.state !== 'draft' ||
          activity.isPrepared || activity.startedAt || !activity.answerResetId) ||
        currentOptions.some((option) => option.revealedCorrect)) {
      throw new Error('Room data changed during the reset.');
    }
    await updateRoom(roomId, {
      isAcceptingQuestions: resumeQuestions,
      isResetting: false,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'A data operation failed.';
    throw new Error(`Reset incomplete. Completed deletions cannot be undone. Participation remains paused; retry the reset. ${detail}`);
  }
}
