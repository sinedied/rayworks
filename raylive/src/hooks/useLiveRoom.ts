import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Activity } from '../../rayfin/data/Activity';
import type { ActivityOption } from '../../rayfin/data/ActivityOption';
import type { Answer } from '../../rayfin/data/Answer';
import type { Room } from '../../rayfin/data/Room';

import { listActivities, listOptions } from '@/services/activities';
import { activitiesWithAnswers, listAnswers } from '@/services/answers';
import { currentUserIdOrNull } from '@/services/rooms';
import { loadQuizRun } from '@/services/quizRuns';
import { visibleQuizAnswers, quizActivity, quizOptions, type QuizRunData } from '@/lib/quizRuns';
import { getVotedQuestionIds } from '@/services/identity';
import {
  listQuestions,
  listVotes,
  tallyQuestions,
  type QuestionWithVotes,
} from '@/services/questions';
import { getRoomByCode } from '@/services/rooms';

const DEFAULT_INTERVAL_MS = 3000;

export interface LiveRoomState {
  room: Room | null;
  questions: QuestionWithVotes[];
  activities: Activity[];
  /** The activity currently accepting answers, if any. */
  liveActivity: Activity | null;
  quiz?: QuizRunData | null;
  hasStoredAnswers?: (activityId: string) => boolean;
  optionsFor: (activityId: string) => ActivityOption[];
  answersFor: (activityId: string) => Answer[];
  loading: boolean;
  notFound: boolean;
  error: string | null;
  refresh: (throwOnError?: boolean) => Promise<void>;
}

/**
 * Polls everything a room surface needs: the room itself, the Q&A feed, and all activities
 * with their options and answers. Rayfin has no realtime subscriptions in this version, so
 * "live" means a short poll that pauses while the tab is hidden and catches up as soon as it
 * becomes visible again.
 *
 * Activities in `draft` are filtered out server-side for anonymous callers, so the audience
 * never receives questions the presenter is still preparing.
 */
export function useLiveRoom(
  code: string | undefined,
  intervalMs: number = DEFAULT_INTERVAL_MS
): LiveRoomState {
  const [room, setRoom] = useState<Room | null>(null);
  const [questions, setQuestions] = useState<QuestionWithVotes[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [options, setOptions] = useState<ActivityOption[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [quiz, setQuiz] = useState<QuizRunData | null>(null);
  const [storedAnswers, setStoredAnswers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const inFlight = useRef(0);

  const refresh = useCallback(async (throwOnError = false) => {
    if (!code) return;
    const sequence = ++request.current;
    inFlight.current++;

    try {
      const found = await getRoomByCode(code);
      if (sequence !== request.current) return;
      if (!found) {
        setRoom(null);
        setQuestions([]);
        setActivities([]);
        setOptions([]);
        setAnswers([]);
        setQuiz(null);
        setNotFound(true);
        setError(null);
        return;
      }

      const [questionRows, voteRows, activityRows, optionRows, answerRows, quizData, stored] =
        await Promise.all([
          listQuestions(found.id),
          listVotes(found.id),
          listActivities(found.id),
          listOptions(found.id),
          listAnswers(found.id, undefined, !!found.quizRunId),
          found.quizRunId ? loadQuizRun(found, found.quizRunId) : null,
          found.quizRunId && currentUserIdOrNull() === found.owner_id ? activitiesWithAnswers(found.id) : null,
        ]);

      if (sequence !== request.current) return;
      setRoom(found);
      setNotFound(false);
      setQuestions(
        tallyQuestions(questionRows, voteRows, getVotedQuestionIds())
      );
      setActivities(activityRows);
      setOptions(optionRows);
      setAnswers(answerRows);
      setQuiz(quizData);
      setStoredAnswers(stored ?? new Set(answerRows.map((answer) => answer.activity_id)));
      setError(null);
    } catch (err) {
      if (sequence === request.current) {
        setError(err instanceof Error ? err.message : 'Failed to load the room.');
      }
      if (throwOnError) throw err;
    } finally {
      inFlight.current--;
      if (sequence === request.current) setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    setLoading(true);
    void refresh();

    const timer = window.setInterval(() => {
      if (!document.hidden && inFlight.current === 0) void refresh();
    }, intervalMs);

    const onVisibilityChange = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh, intervalMs]);

  const optionsByActivity = useMemo(() => {
    const map = new Map<string, ActivityOption[]>();
    for (const option of options) {
      const list = map.get(option.activity_id) ?? [];
      list.push(option);
      map.set(option.activity_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.position - b.position);
    }
    return map;
  }, [options]);

  const answersByActivity = useMemo(() => {
    const map = new Map<string, Answer[]>();
    for (const answer of answers) {
      const list = map.get(answer.activity_id) ?? [];
      list.push(answer);
      map.set(answer.activity_id, list);
    }
    return map;
  }, [answers]);

  const optionsFor = useCallback(
    (activityId: string) => {
      const question = quiz?.questions.find((item) => item.activity_id === activityId);
      return question ? quizOptions(question, quiz!.options) : optionsByActivity.get(activityId) ?? [];
    },
    [optionsByActivity, quiz]
  );

  const answersFor = useCallback(
    (activityId: string) => {
      const question = quiz?.questions.find((item) => item.activity_id === activityId);
      if (!question) return answersByActivity.get(activityId) ?? [];
      return visibleQuizAnswers(quiz!, question);
    },
    [answersByActivity, quiz]
  );

  const liveActivity = useMemo(
    () => {
      const question = quiz?.questions.find((item) => item.id === room?.displayedQuestionId);
      const source = activities.find((activity) => activity.id === question?.activity_id);
      if (question && source) return quizActivity(question, source);
      if (quiz?.run.state === 'building' && room?.displayedQuestionId == null) return null;
      return activities.find((activity) => activity.state === 'live') ?? null;
    },
    [activities, quiz, room?.displayedQuestionId]
  );

  return {
    room,
    questions,
    activities,
    liveActivity,
    quiz,
    hasStoredAnswers: (id) => storedAnswers.has(id),
    optionsFor,
    answersFor,
    loading,
    notFound,
    error,
    refresh,
  };
}
