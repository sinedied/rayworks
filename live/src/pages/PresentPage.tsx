import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { ActivityResults } from '@/components/ActivityResults';
import { ControlBar } from '@/components/ControlBar';
import { Leaderboard } from '@/components/Leaderboard';
import { QrCode } from '@/components/QrCode';
import { useFlipList } from '@/hooks/useFlipList';
import { useLiveRoom } from '@/hooks/useLiveRoom';
import { useRoomControls } from '@/hooks/useRoomControls';
import { useShortcuts } from '@/hooks/useShortcuts';
import { currentUserIdOrNull } from '@/services/rooms';
import type { QuestionWithVotes } from '@/services/questions';
import { buildLeaderboard, countParticipants, tallyAnswers } from '@/lib/aggregate';
import { isPreparing } from '@/lib/quiz';
import { resolveTheme, themeVars } from '@/lib/theme';

const TOP_QUESTIONS = 6;

/**
 * Large-format live view, designed to be projected or embedded in a slide deck via an
 * iframe. It renders whichever activity the presenter has made live and falls back to the
 * Q&A feed when nothing is running, so the projected screen follows the console with no
 * extra interaction.
 *
 * `?embed=1` drops the outer chrome, `?hideAnswered=1` filters answered questions.
 */
export function PresentPage() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const {
    room,
    questions,
    activities,
    liveActivity,
    optionsFor,
    answersFor,
    loading,
    notFound,
    refresh,
  } = useLiveRoom(code);

  const embed = searchParams.get('embed') === '1';
  const hideAnswered = searchParams.get('hideAnswered') === '1';
  const [showLeaderboard, setShowLeaderboard] = useState(
    searchParams.get('leaderboard') === '1'
  );
  const [helpOpen, setHelpOpen] = useState(false);

  // Controls appear only for the signed-in owner, so a projected or embedded copy stays clean.
  const isOwner = !!room && currentUserIdOrNull() === room.owner_id;
  const controls = useRoomControls(room, activities, optionsFor, refresh);

  const shortcuts = useMemo(
    () => ({
      ArrowRight: () => void controls.next(),
      ' ': () => void controls.next(),
      n: () => void controls.next(),
      ArrowLeft: () => void controls.previous(),
      p: () => void controls.previous(),
      Enter: () => void controls.startOrAdvance(),
      e: () => void controls.end(),
      r: () => void controls.reveal(),
      j: () => void controls.toggleJoinInfo(),
      l: () => setShowLeaderboard((value) => !value),
      '?': () => setHelpOpen((value) => !value),
    }),
    [controls]
  );
  useShortcuts(shortcuts, isOwner && !embed);

  const joinUrl = `${window.location.origin}/r/${code ?? ''}`;

  if (loading) return <Screen embed={embed}>Loading…</Screen>;
  if (notFound || !room) return <Screen embed={embed}>Room not available</Screen>;

  const quizActivities = activities
    .filter((activity) => activity.kind === 'quiz')
    .map((activity) => ({
      id: activity.id,
      timeLimitSeconds: activity.timeLimitSeconds,
      options: optionsFor(activity.id),
      answers: answersFor(activity.id),
    }));
  const leaderboard = buildLeaderboard(quizActivities);

  const qnaEnabled = room.qnaEnabled !== false;
  const visibleQuestions = (
    !qnaEnabled
      ? []
      : hideAnswered
        ? questions.filter((question) => !question.isAnswered)
        : questions
  ).slice(0, TOP_QUESTIONS);


  // The prompt stays off the projector until the presenter starts the question.
  const preparing = !!liveActivity && isPreparing(liveActivity);
  const theme = resolveTheme(room);
  const showJoinInfo = room.showJoinInfo !== false;

  return (
    <div
      data-ia-theme
      style={themeVars(theme)}
      className={`flex min-h-screen flex-col ${
        embed ? 'p-4 sm:p-6' : 'p-4 sm:p-6 lg:p-10'
      }`}
    >
      <header className="mb-6 flex flex-col items-start gap-4 sm:mb-8 sm:flex-row sm:justify-between sm:gap-8">
        <div className="min-w-0">
          {!embed && (
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ia-accent)]">
              {room.brandTitle ? (
                room.brandTitle
              ) : (
                <>
                  inter<span className="text-[var(--ia-muted)]">ask</span>
                </>
              )}
            </p>
          )}
          <h1 className="mt-2 truncate text-[clamp(1.75rem,4vw,3rem)] font-bold">
            {liveActivity && !preparing ? liveActivity.prompt : room.title}
          </h1>
          {showJoinInfo && (
            <p className="mt-3 text-[clamp(0.9rem,1.5vw,1.25rem)] text-[var(--ia-muted)] break-words">
              Join at <span className="text-[var(--ia-text)]">{joinUrl}</span>
            </p>
          )}
        </div>
        {showJoinInfo && (
          <div className="shrink-0 self-center text-center sm:self-auto">
            <QrCode url={joinUrl} size={embed ? 96 : 128} />
            <p className="mt-2 font-mono text-[clamp(1rem,2vw,1.5rem)] tracking-widest text-[var(--ia-accent)]">
              {room.code}
            </p>
          </div>
        )}
      </header>

      <main className="flex-1">
        {showLeaderboard ? (
          <section>
            <h2 className="mb-6 text-[clamp(1.5rem,3vw,1.875rem)] font-bold">
              Leaderboard
            </h2>
            <Leaderboard entries={leaderboard} stage limit={8} />
          </section>
        ) : preparing ? (
          /* Nicknames are stored on each device, so there is no lobby count to show. */
          <section className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-[clamp(2.5rem,8vw,4.5rem)] font-bold text-[var(--ia-accent)]">
              Get ready
            </p>
            <p className="mt-6 text-[clamp(1.25rem,3vw,1.875rem)] text-[var(--ia-text)]">
              Scan the code and pick a nickname
            </p>
            <p className="mt-2 text-[clamp(1rem,2vw,1.5rem)] text-[var(--ia-muted)]">
              The question starts in a moment…
            </p>
          </section>
        ) : liveActivity ? (
          <section>
            <ActivityResults
              activity={liveActivity}
              options={optionsFor(liveActivity.id)}
              answers={answersFor(liveActivity.id)}
              stage
            />
            <p className="mt-6 text-right text-base text-[var(--ia-muted)] sm:text-lg">
              {countParticipants(
                tallyAnswers(liveActivity, answersFor(liveActivity.id))
              )}{' '}
              responses
            </p>
          </section>
        ) : visibleQuestions.length === 0 ? (
          <p className="flex h-full items-center justify-center text-center text-[clamp(1.125rem,2.5vw,1.5rem)] text-[var(--ia-muted)]">
            {qnaEnabled
              ? 'Waiting for the first question…'
              : 'Waiting for the presenter…'}
          </p>
        ) : (
          <StageQuestionList questions={visibleQuestions} />
        )}
      </main>

      {!liveActivity && qnaEnabled && !room.isAcceptingQuestions && !showLeaderboard && (
        <footer className="mt-6 text-center text-sm text-[var(--ia-muted)]">
          New questions are paused
        </footer>
      )}

      {isOwner && !embed && (
        <>
          <div className="h-20" aria-hidden="true" />
          <ControlBar
            controls={controls}
            leaderboard={showLeaderboard}
            onToggleLeaderboard={() => setShowLeaderboard((value) => !value)}
            helpOpen={helpOpen}
            onToggleHelp={() => setHelpOpen((value) => !value)}
          />
        </>
      )}
    </div>
  );
}

/**
 * Separate component so the FLIP hook is never called conditionally: the page returns early
 * while loading or when the room is missing.
 */
function StageQuestionList({
  questions,
}: {
  questions: QuestionWithVotes[];
}) {
  const register = useFlipList(questions.map((question) => question.id));
  const maxVotes = Math.max(1, ...questions.map((q) => q.voteCount));

  return (
    <ul className="space-y-4">
      {questions.map((question) => (
        <li
          key={question.id}
          ref={register(question.id)}
          className="relative overflow-hidden rounded-2xl bg-[var(--ia-surface)] px-4 py-4 sm:px-6 sm:py-5"
        >
          <div
            className="absolute inset-y-0 left-0 bg-[var(--ia-accent-soft)] transition-all duration-500"
            style={{ width: `${(question.voteCount / maxVotes) * 100}%` }}
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-4 sm:gap-6">
            <span className="w-12 shrink-0 text-center text-[clamp(1.5rem,3vw,1.875rem)] font-bold text-[var(--ia-accent)] sm:w-16">
              {question.voteCount}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[clamp(1.125rem,2.5vw,1.5rem)] leading-snug">
                {question.content}
              </p>
              <p className="mt-1 text-xs text-[var(--ia-muted)] sm:text-sm">
                {question.authorName || 'Anonymous'}
                {question.isAnswered && ' · Answered'}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Screen({
  embed,
  children,
}: {
  embed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-ia-theme
      className={`flex min-h-screen items-center justify-center text-[var(--ia-muted)] ${
        embed ? 'text-lg' : 'text-2xl'
      }`}
    >
      {children}
    </div>
  );
}
