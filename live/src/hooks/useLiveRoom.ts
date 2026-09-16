import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Activity } from '../../rayfin/data/Activity';
import type { ActivityOption } from '../../rayfin/data/ActivityOption';
import type { Answer } from '../../rayfin/data/Answer';
import type { Room } from '../../rayfin/data/Room';

import { listActivities, listOptions } from '@/services/activities';
import { listAnswers } from '@/services/answers';
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
  optionsFor: (activityId: string) => ActivityOption[];
  answersFor: (activityId: string) => Answer[];
  loading: boolean;
  notFound: boolean;
  error: string | null;
  refresh: () => Promise<void>;
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
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!code) return;

    try {
      const found = await getRoomByCode(code);
      if (!found) {
        setRoom(null);
        setQuestions([]);
        setActivities([]);
        setNotFound(true);
        return;
      }

      const [questionRows, voteRows, activityRows, optionRows, answerRows] =
        await Promise.all([
          listQuestions(found.id),
          listVotes(found.id),
          listActivities(found.id),
          listOptions(found.id),
          listAnswers(found.id),
        ]);

      setRoom(found);
      setNotFound(false);
      setQuestions(
        tallyQuestions(questionRows, voteRows, getVotedQuestionIds())
      );
      setActivities(activityRows);
      setOptions(optionRows);
      setAnswers(answerRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the room.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    setLoading(true);
    void refresh();

    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
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
    (activityId: string) => optionsByActivity.get(activityId) ?? [],
    [optionsByActivity]
  );

  const answersFor = useCallback(
    (activityId: string) => answersByActivity.get(activityId) ?? [],
    [answersByActivity]
  );

  const liveActivity = useMemo(
    () => activities.find((activity) => activity.state === 'live') ?? null,
    [activities]
  );

  return {
    room,
    questions,
    activities,
    liveActivity,
    optionsFor,
    answersFor,
    loading,
    notFound,
    error,
    refresh,
  };
}
