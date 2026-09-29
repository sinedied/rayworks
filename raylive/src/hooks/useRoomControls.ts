import { useCallback, useMemo, useRef, useState } from 'react';

import type { Activity } from '../../rayfin/data/Activity';
import type { ActivityOption } from '../../rayfin/data/ActivityOption';
import type { Room } from '../../rayfin/data/Room';
import { canStartPrepared, currentActivity, inRunOrder, nextActivity, previousActivity } from '@/lib/runOrder';
import { quizActivity, type QuizRunData } from '@/lib/quizRuns';
import { endActivity, goLive, revealAnswers } from '@/services/activities';
import { getRoomById, requireManageableRoom, updateRoom } from '@/services/rooms';
import { closeQuizQuestion, finishQuiz, openQuizSeries, startQuizQuestion } from '@/services/quizRuns';

export interface RoomControls {
  current: Activity | null;
  canStart: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  showJoinInfo: boolean;
  busy: boolean;
  error: string | null;
  hasQuiz: boolean;
  quizFinished: boolean;
  next: () => Promise<boolean>;
  previous: () => Promise<boolean>;
  startOrAdvance: () => Promise<boolean>;
  end: () => Promise<boolean>;
  reveal: () => Promise<boolean>;
  toggleJoinInfo: () => Promise<boolean>;
  open: (activity: Activity) => Promise<boolean>;
  restart: () => Promise<boolean>;
  finish: () => Promise<boolean>;
}

/** Console, projector, shortcuts, and remote share every quiz transition. */
export function useRoomControls(
  room: Room | null,
  activities: Activity[],
  optionsFor: (activityId: string) => ActivityOption[],
  refresh: (throwOnError?: boolean) => Promise<void>,
  quiz?: QuizRunData | null
): RoomControls {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const question = quiz?.questions.find((item) => item.id === room?.displayedQuestionId);
  const rawCurrent = currentActivity(activities, room?.displayedActivityId);
  const current = useMemo(() => question && rawCurrent
    ? quizActivity(question, rawCurrent) : rawCurrent, [question, rawCurrent]);
  const nextInOrder = nextActivity(activities, room?.displayedActivityId);
  const ordered = inRunOrder(activities);
  const displayedIndex = ordered.findIndex((activity) => activity.id === room?.displayedActivityId);
  const next = quiz?.run.state === 'finished' && room?.displayedQuestionId && displayedIndex >= 0
    ? ordered.slice(displayedIndex + 1).find((activity) => {
      const attempt = quiz.questions.find((question) => question.activity_id === activity.id);
      return !attempt || !!attempt.startedAt;
    }) ?? null
    : nextInOrder;
  const previous = previousActivity(activities, room?.displayedActivityId);
  const needsActivation = question?.state === 'running' && !!rawCurrent &&
    (rawCurrent.isPrepared || rawCurrent.quizQuestionId !== question.id ||
      rawCurrent.startedAt?.getTime() !== question.startedAt?.getTime());

  const run = useCallback(async (action: () => Promise<void>): Promise<boolean> => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!room) throw new Error('Room not available.');
      await requireManageableRoom(room.id);
      await action();
      await refresh(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
      await refresh();
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, [room, refresh]);

  const open = async (activity: Activity) => {
    if (!room) throw new Error('Room not available.');
    if (activity.kind === 'quiz') {
      await openQuizSeries(room.id, activity.id);
    } else {
      const fresh = await getRoomById(room.id);
      if (quiz && fresh?.quizRunId === quiz.run.id && quiz.run.state !== 'finished') {
        await finishQuiz(room.id, quiz.run.id);
      }
      await goLive(activity.id, activities);
      await updateRoom(room.id, { displayedActivityId: activity.id, displayedQuestionId: null });
    }
  };

  const startOrAdvance = () => run(async () => {
    if (question && quiz && room && (question.state === 'lobby' || question.state === 'starting' || needsActivation)) {
      await startQuizQuestion(room.id, quiz.run.id, question.id);
    } else if (next) {
      await open(next);
    }
  });

  return {
    current,
    canStart: canStartPrepared(current) || question?.state === 'starting' || needsActivation,
    hasNext: !!next || question?.state === 'lobby',
    hasPrevious: !!previous,
    showJoinInfo: room?.showJoinInfo !== false,
    busy: busy || room?.isResetting === true,
    hasQuiz: !!quiz,
    quizFinished: quiz?.run.state === 'finished',
    error: error ?? (room?.isResetting ? 'Response reset pending. Retry from the management console.' : null),
    next: startOrAdvance,
    startOrAdvance,
    previous: () => run(async () => { if (previous) await open(previous); }),
    open: (activity) => run(() => open(activity)),
    end: () => run(async () => {
      if (room && quiz && question) {
        await closeQuizQuestion(room.id, quiz.run.id, question.id, room.quizAutoReveal === true);
      } else if (current) await endActivity(current.id);
    }),
    reveal: () => run(async () => {
      if (room && quiz && question) await closeQuizQuestion(room.id, quiz.run.id, question.id, true);
      else if (current) await revealAnswers(optionsFor(current.id));
    }),
    restart: () => run(async () => {
      const first = quiz?.questions[0];
      if (!room || !first) throw new Error('Open a quiz series first.');
      if (!window.confirm('Restart this quiz with a new attendee group? Existing answers and scores will remain in history.')) return;
      await openQuizSeries(room.id, first.activity_id, true);
    }),
    finish: () => run(async () => {
      if (!room || !quiz) throw new Error('Open a quiz series first.');
      await finishQuiz(room.id, quiz.run.id);
    }),
    toggleJoinInfo: () => run(async () => {
      if (room) await updateRoom(room.id, { showJoinInfo: room.showJoinInfo === false });
    }),
  };
}
