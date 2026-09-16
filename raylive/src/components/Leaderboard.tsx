import { useFlipList } from '@/hooks/useFlipList';
import type { LeaderboardEntry } from '@/lib/aggregate';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Quiz standings. Computed on the presenter's screen — only they can read the answer key. */
export function Leaderboard({
  entries,
  stage = false,
  limit = 5,
}: {
  entries: LeaderboardEntry[];
  stage?: boolean;
  limit?: number;
}) {
  const visible = entries.slice(0, limit);
  const register = useFlipList(visible.map((entry) => entry.participantKey));

  if (entries.length === 0) {
    return (
      <p
        className={
          'text-[var(--ia-muted)] ' + (stage ? 'text-center text-2xl' : 'text-sm')
        }
      >
        No quiz answers yet.
      </p>
    );
  }

  return (
    <ol className={stage ? 'space-y-3' : 'space-y-2'}>
      {visible.map((entry, index) => (
        <li
          key={entry.participantKey}
          ref={register(entry.participantKey)}
          className={`flex items-center gap-4 rounded-xl ${
            stage
              ? 'bg-[var(--ia-surface)] px-6 py-4'
              : 'border border-[var(--ia-border)] bg-[var(--ia-surface)] px-4 py-3'
          }`}
        >
          <span className={stage ? 'text-3xl' : 'text-lg'}>
            {MEDALS[index] ?? `#${index + 1}`}
          </span>
          <span
            className={`flex-1 truncate ${
              'text-[var(--ia-text)] ' + (stage ? 'text-2xl' : 'text-sm')
            }`}
          >
            {entry.name}
          </span>
          <span
            className={'text-[var(--ia-muted)] ' + (stage ? 'text-lg' : 'text-xs')}
          >
            {entry.correctCount}/{entry.answeredCount} correct
          </span>
          <span
            className={`font-bold ${
              'text-[var(--ia-accent)] ' + (stage ? 'text-3xl' : 'text-sm')
            }`}
          >
            {entry.score}
          </span>
        </li>
      ))}
    </ol>
  );
}
