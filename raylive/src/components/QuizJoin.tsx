import { useState } from 'react';
import type { QuizRunData } from '@/lib/quizRuns';
import { getParticipantKey, getParticipantName } from '@/services/identity';
import { joinQuiz } from '@/services/quizRuns';

export function QuizJoin({ quiz, refresh }: { quiz: QuizRunData; refresh: () => Promise<void> }) {
  const [nickname, setNickname] = useState(getParticipantName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const participant = quiz.participants.find((item) => item.participantKey === getParticipantKey());
  return (
    <section className="mx-auto max-w-sm py-8 text-center">
      <h2 className="text-2xl font-bold text-[var(--ia-text)]">Join this quiz</h2>
      <p className="mt-2 text-sm text-[var(--ia-muted)]">{quiz.participants.length} joined</p>
      {participant ? (
        <p role="status" className="mt-4 text-[var(--ia-text)]">
          Joined as {participant.participantName}. Waiting for the presenter to start.
        </p>
      ) : (
        <form onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError(null);
          void joinQuiz(quiz.run.room_id, quiz.run.id, nickname)
            .then(refresh)
            .catch((err) => setError(err instanceof Error ? err.message : 'Could not join the quiz.'))
            .finally(() => setBusy(false));
        }} className="mt-5 text-left">
          <label htmlFor="quiz-nickname" className="text-sm text-[var(--ia-text)]">Your nickname</label>
          <input id="quiz-nickname" value={nickname} onChange={(event) => setNickname(event.target.value)}
            maxLength={80} disabled={busy}
            className="mt-2 min-h-11 w-full rounded-lg border border-[var(--ia-border)] bg-[var(--ia-surface)] px-3 text-[var(--ia-text)]" />
          <button disabled={busy || !nickname.trim()} className="mt-3 min-h-11 w-full rounded-lg bg-[var(--ia-accent)] px-4 py-2 font-medium text-[var(--ia-bg)] disabled:opacity-40">
            {busy ? 'Joining...' : 'Join quiz'}
          </button>
          {quiz.run.state === 'running' && <p className="mt-3 text-sm text-[var(--ia-muted)]">Join now to answer the next question.</p>}
        </form>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-[var(--ia-text)]">{error}</p>}
    </section>
  );
}
