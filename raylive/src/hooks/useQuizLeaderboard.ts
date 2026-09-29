import { useEffect, useState } from 'react';
import type { Room } from '../../rayfin/data/Room';
import { combinedQuizLeaderboard, quizLeaderboard, type QuizRunData } from '@/lib/quizRuns';
import { loadQuizHistory } from '@/services/quizRuns';
import { currentUserIdOrNull } from '@/services/rooms';

export function useQuizLeaderboard(room: Room | null, current: QuizRunData | null | undefined) {
  const [history, setHistory] = useState<QuizRunData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const roomId = room?.id;
  const ownerId = room?.owner_id;
  const owner = !!room && currentUserIdOrNull() === room.owner_id;
  const combined = room?.quizLeaderboardMode === 'combinedLatest';
  const runId = current?.run.id;
  const started = current?.run.startedAt?.getTime();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!roomId || !ownerId || !owner || !combined) return;
    let active = true;
    setError(null);
    void loadQuizHistory({ id: roomId, owner_id: ownerId }).then((rows) => {
      if (active) setHistory(rows);
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : 'Failed to load quiz standings.');
    });
    return () => { active = false; };
  }, [roomId, ownerId, owner, combined, runId, started, retry]);
  const runs = current
    ? [...history.filter((data) => data.run.id !== current.run.id), current]
    : history;
  return {
    entries: owner ? combined ? combinedQuizLeaderboard(runs) : current ? quizLeaderboard(current) : [] : [],
    error,
    retry: () => setRetry((value) => value + 1),
  };
}
