import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { Room } from '../../rayfin/data/Room';

import { useAuth } from '@/hooks/AuthContext';
import { RayLiveWordmark } from '@/components/RayLiveWordmark';
import { createRoom, deleteRoom, listMyRooms } from '@/services/rooms';

export function HomePage() {
  const { signOut, user } = useAuth();
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
    <div className="min-h-screen bg-gray-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:px-8 sm:py-5">
        <h1>
          <RayLiveWordmark />
        </h1>
        <div className="flex items-center gap-4">
          {user?.email && (
            <span className="text-sm text-gray-600">{user.email}</span>
          )}
          <button
            onClick={() => void signOut()}
            className="text-sm text-gray-400 transition-colors hover:text-gray-600"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="mb-8 text-sm text-gray-500">
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
            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="min-h-11 shrink-0 rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-40"
          >
            Create room
          </button>
        </form>

        {error && (
          <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-center text-sm text-gray-400">Loading...</p>
        ) : rooms.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">
              No rooms yet. Create one above to get started.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rooms.map((room) => (
              <li
                key={room.id}
                className="rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{room.title}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Code{' '}
                      <span className="font-mono text-gray-600">
                        {room.code}
                      </span>
                      {' · '}
                      {room.isOpen ? 'Open' : 'Closed'}
                      {room.isOpen &&
                        !room.isAcceptingQuestions &&
                        ' · Questions paused'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/manage/${room.code}`}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      Manage
                    </Link>
                    <Link
                      to={`/present/${room.code}`}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Present
                    </Link>
                    <button
                      onClick={() => void handleDelete(room)}
                      className="rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:text-red-600"
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
