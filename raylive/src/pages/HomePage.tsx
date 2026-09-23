import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { Room } from '../../rayfin/data/Room';

import { AppHeader } from '@/components/AppHeader';
import { createRoom, deleteRoom, listMyRooms } from '@/services/rooms';

export function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    try {
      setRooms(await listMyRooms());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rooms.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRooms();
  }, [fetchRooms]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setTitle('');
    try {
      await createRoom({ title: trimmed });
      await fetchRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create a room.');
    }
  };

  const handleDelete = async (room: Room) => {
    if (!window.confirm(`Delete "${room.title}" and all its questions?`)) return;

    try {
      await deleteRoom(room.id);
      await fetchRooms();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete the room.'
      );
    }
  };

  return (
    <div className="admin-app min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="admin-page-title">Your rooms</h1>
        <p className="mt-1.5 mb-8 text-sm text-admin-muted">
          Create a room, share the code with your audience, and project the live
          results in your slides.
        </p>

        <form
          onSubmit={(e) => void handleCreate(e)}
          className="mb-8 flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Talk title, e.g. Building apps with Rayfin"
            maxLength={200}
            className="min-w-0 flex-1 rounded-lg border border-admin-control-border bg-white px-4 py-2 text-sm text-admin-text placeholder-admin-subtle shadow-sm focus:border-admin-accent-strong focus:outline-none focus:ring-1 focus:ring-admin-accent-strong"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="shrink-0 rounded-lg admin-primary px-4 py-2 text-sm font-medium shadow-sm disabled:opacity-40"
          >
            Create room
          </button>
        </form>

        {error && (
          <p className="mb-6 rounded-lg bg-admin-danger-soft px-4 py-3 text-sm text-admin-danger">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-center text-sm text-admin-subtle">Loading...</p>
        ) : rooms.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-admin-subtle">
              No rooms yet. Create one above to get started.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rooms.map((room) => (
              <li
                key={room.id}
                className="rounded-lg border border-admin-border bg-white px-5 py-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-admin-text">{room.title}</p>
                    <p className="mt-1 text-xs text-admin-subtle">
                      Code{' '}
                      <span className="font-mono text-admin-muted">
                        {room.code}
                      </span>
                      {' · '}
                      {room.isOpen ? 'Open' : 'Closed'}
                      {room.isOpen &&
                        !room.isAcceptingQuestions &&
                        ' · Questions paused'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/manage/${room.code}`}
                      className="admin-control rounded-lg admin-primary px-3 py-2 text-sm font-medium"
                    >
                      Manage
                    </Link>
                    <Link
                      to={`/present/${room.code}`}
                      className="admin-control rounded-lg border border-admin-control-border px-3 py-2 text-sm font-medium text-admin-muted transition-colors hover:bg-admin-canvas"
                    >
                      Present
                    </Link>
                    <button
                      onClick={() => void handleDelete(room)}
                      className="rounded-lg px-3 py-2 text-sm text-admin-subtle transition-colors hover:text-admin-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
