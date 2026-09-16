import { useEffect, useState } from 'react';

import { isExpired, remainingMs, type QuizActivityLike } from '@/lib/quiz';

export interface Countdown {
  /** Milliseconds left, or `null` when the question is untimed or not running. */
  remaining: number | null;
  /** Whole seconds left, for display. */
  seconds: number;
  expired: boolean;
}

/**
 * Ticks while a timed question is running so the page — not just the timer bar — re-renders as
 * the deadline passes. That is what lets the answer form close itself the moment time is up.
 */
export function useCountdown(activity: QuizActivityLike | null): Countdown {
  const [now, setNow] = useState(() => Date.now());

  const limit = activity?.timeLimitSeconds ?? 0;
  const startedAt = activity?.startedAt
    ? new Date(activity.startedAt).getTime()
    : null;

  useEffect(() => {
    if (!activity || limit <= 0 || !startedAt) return;

    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
    // Re-arm only when the question or its clock actually changes.
  }, [activity, limit, startedAt]);

  if (!activity) return { remaining: null, seconds: 0, expired: false };

  const remaining = remainingMs(activity, now);

  return {
    remaining,
    seconds: remaining === null ? 0 : Math.ceil(remaining / 1000),
    expired: isExpired(activity, now),
  };
}
