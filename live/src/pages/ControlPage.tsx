import { Link, useParams } from 'react-router-dom';

import { useLiveRoom } from '@/hooks/useLiveRoom';
import { useRoomControls } from '@/hooks/useRoomControls';
import { countParticipants, tallyAnswers } from '@/lib/aggregate';
import { ACTIVITY_LABELS } from '@/services/activities';
import { currentUserIdOrNull } from '@/services/rooms';

/**
 * Thumb-sized remote for driving a room from a phone while the projector shows the results.
 *
 * Owner-only: the underlying writes require the authenticated owner anyway, so the UI matches
 * that rather than offering buttons that would fail.
 */
export function ControlPage() {
  const { code } = useParams<{ code: string }>();
  const {
    room,
    activities,
    liveActivity,
    optionsFor,
    answersFor,
    loading,
    notFound,
    refresh,
  } = useLiveRoom(code);

  const controls = useRoomControls(room, activities, optionsFor, refresh);
  const isOwner = !!room && currentUserIdOrNull() === room.owner_id;

  if (loading) return <Centered>Loading…</Centered>;
  if (notFound || !room) return <Centered>Room not available</Centered>;

  if (!isOwner) {
    return (
      <Centered>
        <p className="font-medium text-gray-900">Presenter sign-in required</p>
        <p className="mt-2 max-w-xs text-sm text-gray-500">
          Open this link on a device where you are signed in as the room owner.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm text-blue-600">
          Go to sign in
        </Link>
      </Centered>
    );
  }

  const current = controls.current;
  const responses = current
    ? countParticipants(tallyAnswers(current, answersFor(current.id)))
    : 0;

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      <header className="border-b border-white/10 px-4 py-4">
        <p className="text-xs uppercase tracking-wider text-blue-400">Remote</p>
        <h1 className="mt-1 truncate text-lg font-bold">{room.title}</h1>
      </header>

      <main className="flex-1 px-4 py-5">
        <section className="rounded-2xl bg-white/5 p-4">
          {current ? (
            <>
              <p className="text-xs uppercase tracking-wider text-blue-400">
                {ACTIVITY_LABELS[current.kind]}
                {controls.canStart && ' · lobby'}
              </p>
              <p className="mt-1 text-lg font-medium">{current.prompt}</p>
              <p className="mt-2 text-sm text-gray-400">
                {responses} {responses === 1 ? 'response' : 'responses'}
              </p>
            </>
          ) : (
            <p className="text-gray-400">
              Nothing running — press Next to start.
            </p>
          )}
        </section>

        {controls.error && (
          <p className="mt-4 rounded-xl bg-red-500/20 px-4 py-3 text-sm text-red-200">
            {controls.error}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <RemoteButton
            onClick={() => void controls.previous()}
            disabled={!controls.hasPrevious || controls.busy}
          >
            ← Previous
          </RemoteButton>
          <RemoteButton
            onClick={() => void controls.next()}
            disabled={!controls.hasNext || controls.busy}
          >
            Next →
          </RemoteButton>

          <RemoteButton
            onClick={() => void controls.startOrAdvance()}
            disabled={controls.busy || (!controls.canStart && !controls.hasNext)}
            primary
            className="col-span-2"
          >
            {controls.canStart ? 'Start question' : 'Next activity'}
          </RemoteButton>

          <RemoteButton
            onClick={() => void controls.end()}
            disabled={!current || controls.busy}
          >
            End
          </RemoteButton>
          <RemoteButton
            onClick={() => void controls.reveal()}
            disabled={current?.kind !== 'quiz' || controls.busy}
          >
            Reveal
          </RemoteButton>

          <RemoteButton
            onClick={() => void controls.toggleJoinInfo()}
            disabled={controls.busy}
            className="col-span-2"
          >
            {controls.showJoinInfo ? 'Hide join info' : 'Show join info'}
          </RemoteButton>
        </div>

        <section className="mt-6">
          <h2 className="mb-2 text-xs uppercase tracking-wider text-gray-500">
            Run order
          </h2>
          <ol className="space-y-1 text-sm">
            {activities.map((activity) => (
              <li
                key={activity.id}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
                  liveActivity?.id === activity.id
                    ? 'bg-blue-600/30 text-white'
                    : 'text-gray-400'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {activity.prompt}
                </span>
                <span className="shrink-0 text-xs">
                  {activity.state === 'ended' ? 'done' : activity.state}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

function RemoteButton({
  onClick,
  disabled = false,
  primary = false,
  className = '',
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-h-14 rounded-xl px-4 py-3 text-base font-medium transition-colors disabled:opacity-30 ${
        primary
          ? 'bg-blue-600 text-white hover:bg-blue-500'
          : 'bg-white/10 text-white hover:bg-white/20'
      } ${className}`}
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
