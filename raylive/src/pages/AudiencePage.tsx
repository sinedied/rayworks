import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { ActivityAnswerForm } from '@/components/ActivityAnswerForm';
import { ActivityResults, ResponseCount } from '@/components/ActivityResults';
import { RayLiveWordmark } from '@/components/RayLiveWordmark';
import { useCountdown } from '@/hooks/useCountdown';
import { useLiveRoom } from '@/hooks/useLiveRoom';
import { allowsMultipleSubmissions, hasAnswered } from '@/lib/aggregate';
import { canAnswer, isPreparing } from '@/lib/quiz';
import {
  logoVariantForBackground,
  resolveTheme,
  themeVars,
} from '@/lib/theme';
import {
  getAnsweredActivityIds,
  getParticipantKey,
  getParticipantName,
  setParticipantName,
} from '@/services/identity';
import { askQuestion, upvoteQuestion } from '@/services/questions';

type Tab = 'live' | 'qna';

const fieldClass =
  'w-full rounded-lg border border-[var(--ia-border)] bg-[var(--ia-bg)] px-4 py-3 text-sm text-[var(--ia-text)] placeholder-[var(--ia-muted)] focus:border-[var(--ia-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--ia-accent)]';

export function AudiencePage() {
  const { code } = useParams<{ code: string }>();
  const {
    room,
    questions,
    liveActivity,
    optionsFor,
    answersFor,
    loading,
    notFound,
    error,
    refresh,
  } = useLiveRoom(code);
  const [tab, setTab] = useState<Tab>('live');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [answeredNow, setAnsweredNow] = useState<string[]>([]);
  const [changing, setChanging] = useState(false);
  const [nickname, setNickname] = useState(() => getParticipantName());

  // Re-renders as a timed question runs out, so the form closes itself on the deadline.
  const countdown = useCountdown(liveActivity);

  const handleAsk = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || !room || busy) return;

    setBusy(true);
    setSubmitError(null);
    try {
      await askQuestion(room, { content: trimmed, authorName });
      setContent('');
      await refresh();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to send your question.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleUpvote = async (questionId: string) => {
    const question = questions.find((item) => item.id === questionId);
    if (!question || question.hasVoted || busy) return;

    setBusy(true);
    try {
      await upvoteQuestion(question);
      await refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to upvote.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <CenteredMessage>Loading…</CenteredMessage>;

  if (notFound || !room) {
    return (
      <CenteredMessage>
        <p className="font-medium text-[var(--ia-text)]">Room not available</p>
        <p className="mt-2 text-sm text-[var(--ia-muted)]">
          Double-check the code — this room may have ended.
        </p>
      </CenteredMessage>
    );
  }

  const theme = resolveTheme(room);
  const qnaEnabled = room.qnaEnabled !== false;
  const liveAnswers = liveActivity ? answersFor(liveActivity.id) : [];

  // Answers are final unless the presenter allows changes, so the form locks once this
  // browser's participant is on record — locally or server-side.
  const answered =
    !!liveActivity &&
    (hasAnswered(liveAnswers, getParticipantKey()) ||
      getAnsweredActivityIds().has(liveActivity.id) ||
      answeredNow.includes(liveActivity.id));
  const multipleAllowed = liveActivity
    ? allowsMultipleSubmissions(liveActivity)
    : false;
  const canChange = liveActivity?.allowChangeAnswer === true;
  const preparing = !!liveActivity && isPreparing(liveActivity);
  const open = !!liveActivity && canAnswer(liveActivity);
  const showForm =
    open && (!answered || multipleAllowed || (canChange && changing));

  const activeTab: Tab = liveActivity ? tab : 'qna';

  return (
    <div data-ia-theme style={themeVars(theme)} className="min-h-screen">
      <header className="border-b border-[var(--ia-border)] bg-[var(--ia-surface)] px-4 py-5">
        <div className="mx-auto max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ia-accent)]">
            {room.brandTitle ? (
              room.brandTitle
            ) : (
              <RayLiveWordmark
                variant={logoVariantForBackground(theme.background)}
                className="h-7 sm:h-8"
              />
            )}
          </div>
          <h1 className="mt-1 text-lg font-bold text-[var(--ia-text)]">
            {room.title}
          </h1>

          {liveActivity && qnaEnabled && (
            <div className="mt-4 flex gap-2">
              <TabButton
                active={activeTab === 'live'}
                onClick={() => setTab('live')}
              >
                Live now
              </TabButton>
              <TabButton
                active={activeTab === 'qna'}
                onClick={() => setTab('qna')}
              >
                Q&amp;A
              </TabButton>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {(submitError || error) && (
          <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError ?? error}
          </p>
        )}

        {liveActivity && preparing ? (
          /* Lobby: the prompt is deliberately not rendered, so nobody can think ahead. */
          <section className="py-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ia-accent)]">
              Get ready
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[var(--ia-text)]">
              The quiz is about to start
            </h2>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (nickname.trim()) setParticipantName(nickname);
                setNickname(nickname.trim());
              }}
              className="mx-auto mt-6 max-w-sm rounded-xl border border-[var(--ia-border)] bg-[var(--ia-surface)] p-4 text-left"
            >
              <label
                htmlFor="nickname"
                className="text-sm font-medium text-[var(--ia-text)]"
              >
                Your nickname for the leaderboard
              </label>
              <div className="mt-3 flex gap-2">
                <input
                  id="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  maxLength={80}
                  placeholder="e.g. Ada"
                  className={fieldClass}
                />
                <button
                  type="submit"
                  disabled={!nickname.trim()}
                  className="shrink-0 rounded-lg bg-[var(--ia-accent)] px-4 py-2 text-sm font-medium text-[var(--ia-bg)] disabled:opacity-40"
                >
                  Save
                </button>
              </div>
              {getParticipantName() && (
                <p className="mt-3 text-xs text-[var(--ia-muted)]">
                  You're in as{' '}
                  <span className="text-[var(--ia-text)]">
                    {getParticipantName()}
                  </span>{' '}
                  — waiting for the presenter to start…
                </p>
              )}
            </form>
          </section>
        ) : liveActivity && (activeTab === 'live' || !qnaEnabled) ? (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-[var(--ia-text)]">
              {liveActivity.prompt}
            </h2>

            {showForm ? (
              <ActivityAnswerForm
                activity={liveActivity}
                options={optionsFor(liveActivity.id)}
                onSubmitted={async () => {
                  setAnsweredNow((current) => [...current, liveActivity.id]);
                  setChanging(false);
                  await refresh();
                }}
              />
            ) : (
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--ia-border)] bg-[var(--ia-surface)] px-4 py-3">
                  <p className="text-sm text-[var(--ia-text)]">
                    {countdown.expired && !answered
                      ? "Time's up — this question is closed."
                      : !open && !answered
                        ? 'This question is closed.'
                        : answered
                          ? `Answer sent${canChange && open ? '.' : ' — answers are final.'}`
                          : 'This question is closed.'}
                  </p>
                  {canChange && open && (
                    <button
                      onClick={() => setChanging(true)}
                      className="rounded-lg border border-[var(--ia-border)] px-3 py-1.5 text-xs font-medium text-[var(--ia-text)] hover:border-[var(--ia-accent)]"
                    >
                      Change my answer
                    </button>
                  )}
                </div>

                {liveActivity.showResults ? (
                  <ActivityResults
                    activity={liveActivity}
                    options={optionsFor(liveActivity.id)}
                    answers={liveAnswers}
                  />
                ) : (
                  <p className="text-center text-sm text-[var(--ia-muted)]">
                    Results are shown on the presenter's screen.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4">
              <ResponseCount answers={liveAnswers} />
            </div>
          </section>
        ) : qnaEnabled ? (
          <section>
            {room.isAcceptingQuestions ? (
              <form
                onSubmit={(e) => void handleAsk(e)}
                className="mb-8 rounded-xl border border-[var(--ia-border)] bg-[var(--ia-surface)] p-4"
              >
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Ask a question…"
                  rows={3}
                  maxLength={500}
                  className={`${fieldClass} resize-none`}
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Your name (optional)"
                    maxLength={80}
                    className={fieldClass}
                  />
                  <button
                    type="submit"
                    disabled={!content.trim() || busy}
                    className="min-h-11 shrink-0 rounded-lg bg-[var(--ia-accent)] px-5 py-2 text-sm font-medium text-[var(--ia-bg)] transition-all disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </form>
            ) : (
              <p className="mb-8 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                The presenter paused new questions. You can still upvote below.
              </p>
            )}

            {questions.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--ia-muted)]">
                No questions yet — be the first to ask.
              </p>
            ) : (
              <ul className="space-y-3">
                {questions.map((question) => (
                  <li
                    key={question.id}
                    className={`flex gap-3 rounded-xl border bg-[var(--ia-surface)] px-4 py-3 ${
                      question.isAnswered
                        ? 'border-green-500/50'
                        : 'border-[var(--ia-border)]'
                    }`}
                  >
                    <button
                      onClick={() => void handleUpvote(question.id)}
                      disabled={question.hasVoted || busy}
                      aria-label={
                        question.hasVoted
                          ? 'Already upvoted'
                          : 'Upvote question'
                      }
                      className={`flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                        question.hasVoted
                          ? 'border-[var(--ia-accent)] bg-[var(--ia-accent)] text-[var(--ia-bg)]'
                          : 'border-[var(--ia-border)] text-[var(--ia-text)] hover:border-[var(--ia-accent)] disabled:opacity-50'
                      }`}
                    >
                      <span aria-hidden="true">▲</span>
                      {question.voteCount}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--ia-text)]">
                        {question.content}
                      </p>
                      <p className="mt-1 text-xs text-[var(--ia-muted)]">
                        {question.authorName || 'Anonymous'}
                        {question.isAnswered && ' · Answered'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <p className="py-16 text-center text-sm text-[var(--ia-muted)]">
            Nothing running right now — hold tight for the presenter.
          </p>
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-[var(--ia-accent)] text-[var(--ia-bg)]'
          : 'border border-[var(--ia-border)] text-[var(--ia-muted)]'
      }`}
    >
      {children}
    </button>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-ia-theme
      className="flex min-h-screen items-center justify-center px-4"
    >
      <div className="text-center text-[var(--ia-muted)]">{children}</div>
    </div>
  );
}
