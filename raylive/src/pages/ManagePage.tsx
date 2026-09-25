import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { Activity } from '../../rayfin/data/Activity';
import type { ActivityOption } from '../../rayfin/data/ActivityOption';
import type { Answer } from '../../rayfin/data/Answer';

import { ActivityBuilder } from '@/components/ActivityBuilder';
import { AppHeader } from '@/components/AppHeader';
import { ActivityResults, ResponseCount } from '@/components/ActivityResults';
import { CopyButton } from '@/components/CopyButton';
import { Leaderboard } from '@/components/Leaderboard';
import { QrCode } from '@/components/QrCode';
import { ResponseModeration } from '@/components/ResponseModeration';
import { ThemePicker } from '@/components/ThemePicker';
import { useLiveRoom } from '@/hooks/useLiveRoom';
import { allowsMultipleSubmissions, buildLeaderboard, type WordCloudEntry } from '@/lib/aggregate';
import { activityEditBlockReason } from '@/lib/activityEditing';
import { isPreparing } from '@/lib/quiz';
import { isFreeformActivity } from '@/lib/moderation';
import { deleteAnswer, deleteWordCloudEntry } from '@/services/answers';
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
  saveActivityConfiguration,
  type NewActivityInput,
} from '@/services/activities';
import {
  deleteQuestion,
  setQuestionAnswered,
  setQuestionHidden,
} from '@/services/questions';
import { currentUserIdOrNull, requireManageableRoom, updateRoom } from '@/services/rooms';
import { resetRoomResponses } from '@/services/roomReset';

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
  const pending = useRef(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ activity: Activity; options: ActivityOption[] } | null>(null);
  const blocked = busy || room?.isResetting === true;

  const qnaEnabled = room?.qnaEnabled !== false;
  const joinUrl = `${window.location.origin}/r/${code ?? ''}`;
  const embedUrl = `${window.location.origin}/present/${code ?? ''}?embed=1`;
  const controlUrl = `${window.location.origin}/control/${code ?? ''}`;
  const embedSnippet = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0"></iframe>`;

  const run = async (
    action: () => Promise<void>,
    message?: string,
    resetting = false
  ): Promise<boolean> => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setSuccess(null);
    setActionError(null);
    try {
      if (!room) throw new Error('Room not available.');
      if (!resetting) await requireManageableRoom(room.id);
      await action();
      await refresh(true);
      setActionError(null);
      setSuccess(message ?? null);
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
      await refresh();
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  if (loading) return <Centered>Loading…</Centered>;

  if (notFound || !room) {
    return (
      <Centered>
        <p>Room not found.</p>
        <Link to="/" className="mt-3 inline-block text-sm text-admin-accent-strong">
          Back to rooms
        </Link>
      </Centered>
    );
  }

  if (currentUserIdOrNull() !== room.owner_id) {
    return <Centered>Sign in as the room owner to manage this room.</Centered>;
  }

  const handleCreate = async (input: NewActivityInput) => {
    return run(async () => {
      await createActivity(room, input, activities.length);
    }, 'Activity added.');
  };

  const handleReset = async () => {
    if (!window.confirm(
      `Reset all responses in "${room.title}"? This permanently deletes every activity answer, Q&A question, vote, and quiz result. All activities return to Draft and revealed answers are hidden. Your activities, settings, and share links are kept. This cannot be undone.`
    )) return;
    await run(() => resetRoomResponses(room.id), 'All responses reset. Activities are ready in Draft.', true);
  };

  const currentEdit = editing && activities.find((activity) => activity.id === editing.activity.id);
  const editBlock = editing
    ? currentEdit
      ? activityEditBlockReason(currentEdit, answersFor(currentEdit.id).length > 0)
      : 'This activity is no longer available.'
    : null;
  const closeEditor = () => {
    const id = editing?.activity.id;
    setEditing(null);
    window.requestAnimationFrame(() => document.getElementById(`edit-${id}`)?.focus());
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
    <div className="admin-app min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-col gap-4">
          <div className="min-w-0">
            <Link to="/" className="text-xs text-admin-subtle hover:text-admin-muted">
              ← All rooms
            </Link>
            <h1 className="admin-page-title mt-1 break-words">{room.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={blocked}
              onClick={() =>
                void run(() =>
                  updateRoom(room.id, { qnaEnabled: !qnaEnabled })
                )
              }
              className="rounded-lg border border-admin-control-border px-3 py-2 text-sm font-medium text-admin-muted transition-colors hover:bg-admin-canvas"
            >
              {qnaEnabled ? 'Turn Q&A off' : 'Turn Q&A on'}
            </button>
            {qnaEnabled && (
              <button
                disabled={blocked}
                onClick={() =>
                  void run(() =>
                    updateRoom(room.id, {
                      isAcceptingQuestions: !room.isAcceptingQuestions,
                    })
                  )
                }
                className="rounded-lg border border-admin-control-border px-3 py-2 text-sm font-medium text-admin-muted transition-colors hover:bg-admin-canvas"
              >
                {room.isAcceptingQuestions ? 'Pause questions' : 'Resume questions'}
              </button>
            )}
            <button
              disabled={blocked}
              onClick={() =>
                void run(() => updateRoom(room.id, { isOpen: !room.isOpen }))
              }
              className="rounded-lg border border-admin-control-border px-3 py-2 text-sm font-medium text-admin-muted transition-colors hover:bg-admin-canvas"
            >
              {room.isOpen ? 'End room' : 'Reopen room'}
            </button>
            <button
              onClick={() => void handleReset()}
              disabled={busy}
              className="min-h-11 rounded-lg border border-admin-danger px-3 py-2 text-sm font-medium text-admin-danger hover:bg-admin-danger-soft disabled:opacity-40"
            >
              {room.isResetting ? 'Retry response reset' : 'Reset all responses'}
            </button>
            <Link
              to={`/present/${room.code}`}
              className="admin-control rounded-lg admin-primary px-3 py-2 text-sm font-medium"
            >
              Present
            </Link>
          </div>
          {room.isResetting && (
            <p role="status" className="mb-6 rounded-lg bg-admin-warning-soft px-4 py-3 text-sm text-admin-warning">
              Response reset pending. Participation and presenter controls are paused.
              {busy ? ' Resetting responses...' : ' Retry the reset to finish and restore the question setting.'}
            </p>
          )}
          {busy && !room.isResetting && <p role="status" className="mb-4 text-sm text-admin-muted">Saving changes...</p>}
          {success && <p role="status" className="mb-4 text-sm text-admin-success">{success}</p>}
        </div>
        {!room.isOpen && (
          <p className="mb-6 rounded-lg bg-admin-warning-soft px-4 py-3 text-sm text-admin-warning">
            This room is closed — the audience can no longer see it. Reopen it
            to share again.
          </p>
        )}

        <section className="mb-8 rounded-lg border border-admin-border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start gap-6">
            <QrCode url={joinUrl} size={132} />
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-admin-subtle">
                  Join link
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="truncate rounded-lg bg-admin-canvas px-3 py-2 text-sm text-admin-muted">
                    {joinUrl}
                  </code>
                  <CopyButton value={joinUrl} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-admin-subtle">
                  Remote control
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="truncate rounded-lg bg-admin-canvas px-3 py-2 text-sm text-admin-muted">
                    {controlUrl}
                  </code>
                  <CopyButton value={controlUrl} />
                  <button
                    onClick={() => setShowRemoteQr((value) => !value)}
                    className="rounded-lg border border-admin-control-border px-3 py-2 text-sm font-medium text-admin-muted hover:bg-admin-canvas"
                  >
                    {showRemoteQr ? 'Hide QR' : 'Show QR'}
                  </button>
                </div>
                {showRemoteQr && (
                  <div className="mt-3">
                    <QrCode url={controlUrl} size={132} />
                    <p className="mt-2 max-w-xs text-xs text-admin-subtle">
                      Scan to drive the room from your phone. You need to be
                      signed in as the owner on that device.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-admin-subtle">
                  Embed in your slides
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="truncate rounded-lg bg-admin-canvas px-3 py-2 text-xs text-admin-muted">
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
            busy={blocked}
            onSave={async (theme) => {
              await run(() =>
                updateRoom(room.id, {
                  brandTitle: theme.brandTitle || undefined,
                  themePreset: theme.preset,
                  themeBackground: theme.background,
                  themeText: theme.text,
                  themeAccent: theme.accent,
                })
              );
            }}
          />
        </div>

        {(actionError || error) && (
          <p role="alert" className="mb-6 rounded-lg bg-admin-danger-soft px-4 py-3 text-sm text-admin-danger">
            {[actionError, error].filter(Boolean).join(' ')}
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
                busy={blocked}
                editing={editing !== null}
                onEdit={() => setEditing({ activity, options: optionsFor(activity.id) })}
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
                onDeleteResponse={async (answer) => {
                  if (!window.confirm(
                    `Permanently delete this response?\n\n"${answer.textValue}"\n\n${replacementWarning(activity)}This cannot be undone.`
                  )) return false;
                  return run(
                    () => deleteAnswer(activity.id, answer.id),
                    'Response and any older replacement versions deleted.'
                  );
                }}
                onDeleteWord={async (entry) => {
                  if (!window.confirm(
                    `Delete all existing occurrences of "${entry.word}" in this activity? There are currently ${entry.count} stored occurrences, including hidden and earlier versions.\n\n${replacementWarning(activity)}This cannot be undone. Future submissions of this text are still allowed.`
                  )) return false;
                  return run(
                    () => deleteWordCloudEntry(activity.id, entry.word),
                    'Matching word-cloud entries and any older replacement versions deleted.'
                  );
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

            {editing ? (
              <ActivityBuilder
                key={editing.activity.id}
                mode="edit"
                activity={editing.activity}
                options={editing.options}
                busy={blocked}
                blockedReason={editBlock}
                onCancel={closeEditor}
                onSave={async (input) => {
                  const saved = await run(
                    () => saveActivityConfiguration(editing.activity.id, input),
                    'Activity updated.'
                  );
                  if (saved) closeEditor();
                  return saved;
                }}
              />
            ) : <ActivityBuilder onCreate={handleCreate} busy={blocked} />}
          </section>
        )}

        {tab === 'qna' && qnaEnabled &&
          (questions.length === 0 ? (
            <p className="py-12 text-center text-sm text-admin-subtle">
              No questions yet. Share the code to get started.
            </p>
          ) : (
            <ul className="space-y-3">
              {questions.map((question) => (
                <li
                  key={question.id}
                  className={`rounded-lg border bg-white px-4 py-3 shadow-sm ${question.isHidden
                      ? 'border-admin-border opacity-60'
                      : question.isAnswered
                        ? 'border-green-200'
                        : 'border-admin-border'
                    }`}
                >
                  <div className="flex gap-3">
                    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-admin-canvas text-sm font-semibold text-admin-muted">
                      <span aria-hidden="true">▲</span>
                      {question.voteCount}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-admin-text">
                        {question.content}
                      </p>
                      <p className="mt-1 text-xs text-admin-subtle">
                        {question.authorName || 'Anonymous'}
                        {question.isHidden && ' · Hidden'}
                        {question.isAnswered && ' · Answered'}
                      </p>
                    </div>
                  </div>
                  <fieldset disabled={blocked} className="mt-3 flex flex-wrap justify-end gap-2 disabled:opacity-50">
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
                      onClick={() => {
                        if (window.confirm(
                          `Permanently delete this question and all its votes?\n\n"${question.content}"\n\nThis cannot be undone.`
                        )) {
                          void run(() => deleteQuestion(question.id), 'Question and its votes deleted.');
                        }
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-admin-subtle transition-colors hover:text-admin-danger"
                    >
                      Delete
                    </button>
                  </fieldset>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'leaderboard' && (
          <section>
            <p className="mb-4 text-xs text-admin-subtle">
              Scored on this screen — the answer key is never sent to attendees.
              Project it with{' '}
              <Link
                to={`/present/${room.code}?leaderboard=1`}
                className="text-admin-accent-strong"
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
  editing,
  onEdit,
  onGoLive,
  onPrepare,
  onStart,
  onEnd,
  onReset,
  onReveal,
  onClearAnswers,
  onDeleteResponse,
  onDeleteWord,
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
  editing: boolean;
  onEdit: () => void;
  onGoLive: () => void;
  onPrepare: () => void;
  onStart: () => void;
  onEnd: () => void;
  onReset: () => void;
  onReveal: () => void;
  onClearAnswers: () => void;
  onDeleteResponse: (answer: Answer) => Promise<boolean>;
  onDeleteWord: (entry: WordCloudEntry) => Promise<boolean>;
  onToggleResults: () => void;
  onToggleChangeAnswer: () => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [moderating, setModerating] = useState(false);
  const preparing = isPreparing(activity);
  const editBlock = activityEditBlockReason(activity, answers.length > 0);

  return (
    <article
      className={`rounded-lg border bg-white p-4 shadow-sm ${isLive ? 'border-admin-accent-strong ring-1 ring-admin-accent-strong' : 'border-admin-border'
        }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-admin-accent-strong">
            {ACTIVITY_LABELS[activity.kind]}
            {isLive &&
              (preparing ? (
                <span className="ml-2 text-admin-warning">● Lobby</span>
              ) : (
                <span className="ml-2 text-admin-success">● Live</span>
              ))}
            {activity.state === 'ended' && (
              <span className="ml-2 text-admin-subtle">Ended</span>
            )}
            {activity.state === 'draft' && (
              <span className="ml-2 text-admin-subtle">Draft</span>
            )}
          </p>
          <p className="mt-1 font-medium text-admin-text">{activity.prompt}</p>
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

      <fieldset disabled={busy} className="mt-3 flex flex-wrap gap-2 disabled:opacity-50">
        <button
          id={`edit-${activity.id}`}
          onClick={onEdit}
          disabled={editing || !!editBlock}
          aria-describedby={editBlock ? `edit-block-${activity.id}` : undefined}
          className="min-h-11 rounded-lg border border-admin-control-border px-3 py-1.5 text-sm font-medium text-admin-muted disabled:opacity-40"
        >
          Edit
        </button>
        {activity.state !== 'live' ? (
          <>
            {activity.kind === 'quiz' && (
              <button
                onClick={onPrepare}
                disabled={busy}
                title="Let people join and set a nickname without showing the question"
                className="rounded-lg border border-admin-accent-strong px-3 py-1.5 text-xs font-medium text-admin-accent-strong disabled:opacity-40"
              >
                Prepare
              </button>
            )}
            <button
              onClick={onGoLive}
              disabled={busy}
              className="rounded-lg admin-primary px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              {activity.kind === 'quiz' ? 'Start now' : 'Go live'}
            </button>
          </>
        ) : preparing ? (
          <button
            onClick={onStart}
            disabled={busy}
            className="rounded-lg admin-primary px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            Start question
          </button>
        ) : (
          <button
            onClick={onEnd}
            disabled={busy}
            className="rounded-lg bg-admin-heading px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
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

        {isFreeformActivity(activity) && (
          <button
            type="button"
            aria-expanded={moderating}
            aria-controls={`moderation-${activity.id}`}
            onClick={() => setModerating((value) => !value)}
            className="rounded-lg border border-admin-control-border px-3 py-1.5 text-sm font-medium text-admin-muted hover:bg-admin-canvas"
          >
            {moderating ? 'Close response management' : 'Manage responses'}
          </button>
        )}

        <button
          onClick={onDelete}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-admin-subtle transition-colors hover:text-admin-danger"
        >
          Delete
        </button>
      </fieldset>
      {editBlock && <p id={`edit-block-${activity.id}`} className="mt-2 text-xs text-admin-subtle">{editBlock}</p>}

      {expanded && (
        <div className="mt-4 border-t border-admin-border pt-4">
          <ActivityResults
            activity={activity}
            options={options}
            answers={answers}
          />
        </div>
      )}
      {moderating && isFreeformActivity(activity) && (
        <div id={`moderation-${activity.id}`}>
          <ResponseModeration
            activity={activity}
            answers={answers}
            busy={busy}
            onDeleteResponse={onDeleteResponse}
            onDeleteWord={onDeleteWord}
          />
        </div>
      )}
    </article>
  );
}

function replacementWarning(activity: Activity): string {
  return allowsMultipleSubmissions(activity)
    ? ''
    : 'Older replacement versions from the affected participants will also be deleted so they cannot reappear. ';
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
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${active
          ? 'admin-primary'
          : 'border border-admin-border bg-white text-admin-muted hover:bg-admin-canvas'
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
      className="rounded-lg border border-admin-border px-3 py-1.5 text-xs font-medium text-admin-muted transition-colors hover:bg-admin-canvas"
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
      className="rounded-lg border border-admin-border px-2 py-1 text-xs text-admin-muted disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-app min-h-screen">
      <AppHeader />
      <main className="admin-page-state px-4 text-center text-admin-muted">{children}</main>
    </div>
  );
}
