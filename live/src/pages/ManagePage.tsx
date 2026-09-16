import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { Activity } from '../../rayfin/data/Activity';

import { ActivityBuilder } from '@/components/ActivityBuilder';
import { ActivityResults, ResponseCount } from '@/components/ActivityResults';
import { CopyButton } from '@/components/CopyButton';
import { Leaderboard } from '@/components/Leaderboard';
import { QrCode } from '@/components/QrCode';
import { ThemePicker } from '@/components/ThemePicker';
import { useLiveRoom } from '@/hooks/useLiveRoom';
import { buildLeaderboard } from '@/lib/aggregate';
import { isPreparing } from '@/lib/quiz';
import {
  ACTIVITY_LABELS,
  clearAnswers,
  createActivity,
  deleteActivity,
  endActivity,
  goLive,
  prepareActivity,
  revealAnswers,
  startPreparedActivity,
  setActivityState,
  swapPositions,
  updateActivity,
  type NewActivityInput,
} from '@/services/activities';
import {
  deleteQuestion,
  setQuestionAnswered,
  setQuestionHidden,
} from '@/services/questions';
import { updateRoom } from '@/services/rooms';

type Tab = 'activities' | 'qna' | 'leaderboard';

export function ManagePage() {
  const { code } = useParams<{ code: string }>();
  const {
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
  } = useLiveRoom(code);
  const [tab, setTab] = useState<Tab>('activities');
  const [actionError, setActionError] = useState<string | null>(null);
  const [showRemoteQr, setShowRemoteQr] = useState(false);
  const [busy, setBusy] = useState(false);

  const qnaEnabled = room?.qnaEnabled !== false;
  const joinUrl = `${window.location.origin}/r/${code ?? ''}`;
  const embedUrl = `${window.location.origin}/present/${code ?? ''}?embed=1`;
  const controlUrl = `${window.location.origin}/control/${code ?? ''}`;
  const embedSnippet = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0"></iframe>`;

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      await refresh();
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Centered>Loading…</Centered>;

  if (notFound || !room) {
    return (
      <Centered>
        <p>Room not found.</p>
        <Link to="/" className="mt-3 inline-block text-sm text-blue-600">
          Back to rooms
        </Link>
      </Centered>
    );
  }

  const handleCreate = async (input: NewActivityInput) => {
    await run(async () => {
      await createActivity(room, input, activities.length);
    });
  };

  const leaderboard = buildLeaderboard(
    activities
      .filter((activity) => activity.kind === 'quiz')
      .map((activity) => ({
        id: activity.id,
        timeLimitSeconds: activity.timeLimitSeconds,
        options: optionsFor(activity.id),
        answers: answersFor(activity.id),
      }))
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:px-8 sm:py-5">
        <div>
          <Link to="/" className="text-xs text-gray-400 hover:text-gray-600">
            ← All rooms
          </Link>
          <h1 className="mt-1 text-xl font-bold text-gray-900">{room.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              void run(() =>
                updateRoom(room.id, { qnaEnabled: !qnaEnabled })
              )
            }
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {qnaEnabled ? 'Turn Q&A off' : 'Turn Q&A on'}
          </button>
          {qnaEnabled && (
            <button
              onClick={() =>
                void run(() =>
                  updateRoom(room.id, {
                    isAcceptingQuestions: !room.isAcceptingQuestions,
                  })
                )
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {room.isAcceptingQuestions ? 'Pause questions' : 'Resume questions'}
            </button>
          )}
          <button
            onClick={() =>
              void run(() => updateRoom(room.id, { isOpen: !room.isOpen }))
            }
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {room.isOpen ? 'End room' : 'Reopen room'}
          </button>
          <Link
            to={`/present/${room.code}`}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Present
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {!room.isOpen && (
          <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This room is closed — the audience can no longer see it. Reopen it
            to share again.
          </p>
        )}

        <section className="mb-8 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start gap-6">
            <QrCode url={joinUrl} size={132} />
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Join link
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="truncate rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    {joinUrl}
                  </code>
                  <CopyButton value={joinUrl} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Remote control
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="truncate rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    {controlUrl}
                  </code>
                  <CopyButton value={controlUrl} />
                  <button
                    onClick={() => setShowRemoteQr((value) => !value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {showRemoteQr ? 'Hide QR' : 'Show QR'}
                  </button>
                </div>
                {showRemoteQr && (
                  <div className="mt-3">
                    <QrCode url={controlUrl} size={132} />
                    <p className="mt-2 max-w-xs text-xs text-gray-400">
                      Scan to drive the room from your phone. You need to be
                      signed in as the owner on that device.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Embed in your slides
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="truncate rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    {embedSnippet}
                  </code>
                  <CopyButton value={embedSnippet} label="Copy embed" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-8">
          <ThemePicker
            room={room}
            busy={busy}
            onSave={(theme) =>
              run(() =>
                updateRoom(room.id, {
                  brandTitle: theme.brandTitle || undefined,
                  themePreset: theme.preset,
                  themeBackground: theme.background,
                  themeText: theme.text,
                  themeAccent: theme.accent,
                })
              )
            }
          />
        </div>

        {(actionError || error) && (
          <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError ?? error}
          </p>
        )}

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          <TabButton
            active={tab === 'activities'}
            onClick={() => setTab('activities')}
          >
            Activities ({activities.length})
          </TabButton>
          {qnaEnabled && (
            <TabButton active={tab === 'qna'} onClick={() => setTab('qna')}>
              Q&amp;A ({questions.length})
            </TabButton>
          )}
          <TabButton
            active={tab === 'leaderboard'}
            onClick={() => setTab('leaderboard')}
          >
            Leaderboard
          </TabButton>
        </div>

        {(tab === 'activities' || (tab === 'qna' && !qnaEnabled)) && (
          <section className="space-y-4">
            {activities.map((activity, index) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                index={index}
                total={activities.length}
                isLive={liveActivity?.id === activity.id}
                options={optionsFor(activity.id)}
                answers={answersFor(activity.id)}
                busy={busy}
                onGoLive={() => void run(() => goLive(activity.id, activities))}
                onPrepare={() =>
                  void run(() => prepareActivity(activity.id, activities))
                }
                onStart={() =>
                  void run(() => startPreparedActivity(activity.id))
                }
                onEnd={() => void run(() => endActivity(activity.id))}
                onReset={() => void run(() => setActivityState(activity.id, 'draft'))}
                onReveal={() =>
                  void run(() => revealAnswers(optionsFor(activity.id)))
                }
                onClearAnswers={() => {
                  if (
                    window.confirm(
                      `Delete every response to "${activity.prompt}"?`
                    )
                  ) {
                    void run(() => clearAnswers(activity.id));
                  }
                }}
                onToggleResults={() =>
                  void run(() =>
                    updateActivity(activity.id, {
                      showResults: !activity.showResults,
                    })
                  )
                }
                onToggleChangeAnswer={() =>
                  void run(() =>
                    updateActivity(activity.id, {
                      allowChangeAnswer: activity.allowChangeAnswer !== true,
                    })
                  )
                }
                onMove={(direction) => {
                  const other = activities[index + direction];
                  if (other) void run(() => swapPositions(activity, other));
                }}
                onDelete={() => {
                  if (window.confirm(`Delete "${activity.prompt}"?`)) {
                    void run(() => deleteActivity(activity.id));
                  }
                }}
              />
            ))}

            <ActivityBuilder onCreate={handleCreate} busy={busy} />
          </section>
        )}

        {tab === 'qna' && qnaEnabled &&
          (questions.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              No questions yet. Share the code to get started.
            </p>
          ) : (
            <ul className="space-y-3">
              {questions.map((question) => (
                <li
                  key={question.id}
                  className={`rounded-xl border bg-white px-4 py-3 shadow-sm ${
                    question.isHidden
                      ? 'border-gray-200 opacity-60'
                      : question.isAnswered
                        ? 'border-green-200'
                        : 'border-gray-100'
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-gray-50 text-sm font-semibold text-gray-700">
                      <span aria-hidden="true">▲</span>
                      {question.voteCount}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900">
                        {question.content}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {question.authorName || 'Anonymous'}
                        {question.isHidden && ' · Hidden'}
                        {question.isAnswered && ' · Answered'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <SmallButton
                      onClick={() =>
                        void run(() =>
                          setQuestionAnswered(question.id, !question.isAnswered)
                        )
                      }
                    >
                      {question.isAnswered ? 'Mark unanswered' : 'Mark answered'}
                    </SmallButton>
                    <SmallButton
                      onClick={() =>
                        void run(() =>
                          setQuestionHidden(question.id, !question.isHidden)
                        )
                      }
                    >
                      {question.isHidden ? 'Unhide' : 'Hide'}
                    </SmallButton>
                    <button
                      onClick={() => void run(() => deleteQuestion(question.id))}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'leaderboard' && (
          <section>
            <p className="mb-4 text-xs text-gray-400">
              Scored on this screen — the answer key is never sent to attendees.
              Project it with{' '}
              <Link
                to={`/present/${room.code}?leaderboard=1`}
                className="text-blue-600"
              >
                /present/{room.code}?leaderboard=1
              </Link>
              .
            </p>
            <Leaderboard entries={leaderboard} limit={10} />
          </section>
        )}
      </main>
    </div>
  );
}

function ActivityCard({
  activity,
  index,
  total,
  isLive,
  options,
  answers,
  busy,
  onGoLive,
  onPrepare,
  onStart,
  onEnd,
  onReset,
  onReveal,
  onClearAnswers,
  onToggleResults,
  onToggleChangeAnswer,
  onMove,
  onDelete,
}: {
  activity: Activity;
  index: number;
  total: number;
  isLive: boolean;
  options: ReturnType<ReturnType<typeof useLiveRoom>['optionsFor']>;
  answers: ReturnType<ReturnType<typeof useLiveRoom>['answersFor']>;
  busy: boolean;
  onGoLive: () => void;
  onPrepare: () => void;
  onStart: () => void;
  onEnd: () => void;
  onReset: () => void;
  onReveal: () => void;
  onClearAnswers: () => void;
  onToggleResults: () => void;
  onToggleChangeAnswer: () => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const preparing = isPreparing(activity);

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        isLive ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-100'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
            {ACTIVITY_LABELS[activity.kind]}
            {isLive &&
              (preparing ? (
                <span className="ml-2 text-amber-600">● Lobby</span>
              ) : (
                <span className="ml-2 text-green-600">● Live</span>
              ))}
            {activity.state === 'ended' && (
              <span className="ml-2 text-gray-400">Ended</span>
            )}
            {activity.state === 'draft' && (
              <span className="ml-2 text-gray-400">Draft</span>
            )}
          </p>
          <p className="mt-1 font-medium text-gray-900">{activity.prompt}</p>
          <div className="mt-1">
            <ResponseCount answers={answers} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            onClick={() => onMove(-1)}
            disabled={index === 0 || busy}
            label="Move up"
          >
            ↑
          </IconButton>
          <IconButton
            onClick={() => onMove(1)}
            disabled={index === total - 1 || busy}
            label="Move down"
          >
            ↓
          </IconButton>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {activity.state !== 'live' ? (
          <>
            {activity.kind === 'quiz' && (
              <button
                onClick={onPrepare}
                disabled={busy}
                title="Let people join and set a nickname without showing the question"
                className="rounded-lg border border-blue-600 px-3 py-1.5 text-xs font-medium text-blue-700 disabled:opacity-40"
              >
                Prepare
              </button>
            )}
            <button
              onClick={onGoLive}
              disabled={busy}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {activity.kind === 'quiz' ? 'Start now' : 'Go live'}
            </button>
          </>
        ) : preparing ? (
          <button
            onClick={onStart}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            Start question
          </button>
        ) : (
          <button
            onClick={onEnd}
            disabled={busy}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            End
          </button>
        )}

        {activity.kind === 'quiz' && (
          <SmallButton onClick={onReveal}>Reveal answers</SmallButton>
        )}

        <SmallButton onClick={onToggleResults}>
          {activity.showResults
            ? 'Hide results on devices'
            : 'Show results on devices'}
        </SmallButton>

        <SmallButton onClick={onToggleChangeAnswer}>
          {activity.allowChangeAnswer
            ? 'Lock answers'
            : 'Allow changing answers'}
        </SmallButton>

        {activity.state === 'ended' && (
          <SmallButton onClick={onReset}>Back to draft</SmallButton>
        )}

        {answers.length > 0 && (
          <SmallButton onClick={onClearAnswers}>Clear responses</SmallButton>
        )}

        <SmallButton onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Hide results' : 'View results'}
        </SmallButton>

        <button
          onClick={onDelete}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-red-600"
        >
          Delete
        </button>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <ActivityResults
            activity={activity}
            options={options}
            answers={answers}
          />
        </div>
      )}
    </article>
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
          ? 'bg-blue-600 text-white'
          : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

function SmallButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
    >
      {children}
    </button>
  );
}

function IconButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="text-center text-gray-500">{children}</div>
    </div>
  );
}
