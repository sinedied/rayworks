import { useCallback, useEffect, useRef, useState } from 'react';
import type { Room } from '../../rayfin/data/Room';
import { shouldAutoReveal, type QuizRunData } from '@/lib/quizRuns';
import { autoRevealQuiz } from '@/services/quizRuns';
import { currentUserIdOrNull } from '@/services/rooms';

export function useQuizAutoReveal(
  room: Room | null,
  quiz: QuizRunData | null | undefined,
  refresh: (throwOnError?: boolean) => Promise<void>,
  enabled = true
) {
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const failed = useRef<string | null>(null);
  const completed = useRef<string | null>(null);
  const question = quiz?.questions.find((item) => item.id === room?.displayedQuestionId);
  const key = question ? `${quiz!.run.id}:${question.id}` : '';
  const run = useCallback(async () => {
    if (!enabled || !room || !quiz || !question || pending.current || completed.current === key || document.hidden ||
        room.isResetting || !room.quizAutoReveal || currentUserIdOrNull() !== room.owner_id) return;
    pending.current = true;
    try {
      const revealed = await autoRevealQuiz(room.id, quiz.run.id, question.id);
      await refresh(true);
      if (revealed) completed.current = key;
      setError(null);
    } catch (err) {
      failed.current = key;
      setError(err instanceof Error ? err.message : 'Automatic reveal failed.');
    } finally {
      pending.current = false;
    }
  }, [enabled, room, quiz, question, key, refresh]);

  useEffect(() => {
    const check = () => {
      if (!question || !quiz || failed.current === key || completed.current === key) return;
      if (shouldAutoReveal(question, quiz.members, quiz.answers) ||
          question.state === 'closing' || question.state === 'revealing') void run();
    };
    check();
    const timer = window.setInterval(check, 500);
    return () => window.clearInterval(timer);
  }, [question, quiz, key, run]);

  return {
    error: failed.current === key ? error : null,
    retry: () => { failed.current = null; return run(); },
  };
}
