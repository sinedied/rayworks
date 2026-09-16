import type { Activity } from '../../rayfin/data/Activity';

import { useCountdown } from '@/hooks/useCountdown';

/** Countdown bar for timed quiz questions. Renders nothing when the question is untimed. */
export function QuizTimer({ activity }: { activity: Activity }) {
  const { remaining, seconds } = useCountdown(activity);

  if (remaining === null) return null;

  const limit = activity.timeLimitSeconds ?? 0;
  const ratio = limit > 0 ? remaining / (limit * 1000) : 0;

  return (
    <div className="mb-4">
      <div className="h-2 overflow-hidden rounded-full bg-[var(--ia-border)]">
        <div
          className={`h-full transition-all duration-200 ${
            ratio > 0.3 ? 'bg-[var(--ia-accent)]' : 'bg-red-500'
          }`}
          style={{ width: `${Math.max(0, ratio) * 100}%` }}
        />
      </div>
      <p className="mt-1 text-right text-xs text-[var(--ia-muted)]">
        {seconds > 0 ? `${seconds}s left` : "Time's up"}
      </p>
    </div>
  );
}
