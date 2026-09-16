import type { Room } from '../../rayfin/data/Room';

import { DEFAULT_PRESET_ID, DEFAULT_THEME } from '@/lib/theme';

import { getRayfinClient } from './rayfinClient';

const ROOM_FIELDS = [
  'id',
  'title',
  'description',
  'code',
  'isOpen',
  'isAcceptingQuestions',
  'qnaEnabled',
  'brandTitle',
  'showJoinInfo',
  'themePreset',
  'themeBackground',
  'themeText',
  'themeAccent',
  'createdAt',
  'owner_id',
] as const;

/** Ambiguous characters (0/o, 1/l/i) are excluded so codes survive being read aloud. */
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function generateRoomCode(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]
  ).join('');
}

function toRoom(row: Room): Room {
  return { ...row, createdAt: new Date(row.createdAt) };
}

export function currentUserId(): string {
  const session = getRayfinClient().auth.getSession();
  if (!session.isAuthenticated || !session.user) {
    throw new Error('You must be signed in to manage rooms.');
  }
  return session.user.id;
}

/** The signed-in user's id, or `null` for anonymous visitors. Used to gate presenter controls. */
export function currentUserIdOrNull(): string | null {
  try {
    const session = getRayfinClient().auth.getSession();
    return session.isAuthenticated ? (session.user?.id ?? null) : null;
  } catch {
    return null;
  }
}

export async function createRoom(input: {
  title: string;
  description?: string;
}): Promise<Room> {
  const client = getRayfinClient();
  const room = {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description || undefined,
    code: generateRoomCode(),
    isOpen: true,
    isAcceptingQuestions: true,
    qnaEnabled: true,
    showJoinInfo: true,
    themePreset: DEFAULT_PRESET_ID,
    themeBackground: DEFAULT_THEME.background,
    themeText: DEFAULT_THEME.text,
    themeAccent: DEFAULT_THEME.accent,
    createdAt: new Date(),
    owner_id: currentUserId(),
  };

  await client.data.Room.create(room);
  return room as Room;
}

export async function listMyRooms(): Promise<Room[]> {
  const client = getRayfinClient();
  const rows = await client.data.Room.select([...ROOM_FIELDS])
    .where({ owner_id: { eq: currentUserId() } })
    .orderBy({ createdAt: 'desc' })
    .execute();

  return rows.map(toRoom);
}

/** Looks up a room from its share code. Works anonymously while the room is open. */
export async function getRoomByCode(code: string): Promise<Room | null> {
  const client = getRayfinClient();
  const rows = await client.data.Room.select([...ROOM_FIELDS])
    .where({ code: { eq: code.trim().toLowerCase() } })
    .execute();

  const [row] = rows;
  return row ? toRoom(row) : null;
}

export async function getRoomById(id: string): Promise<Room | null> {
  const client = getRayfinClient();
  const rows = await client.data.Room.select([...ROOM_FIELDS])
    .where({ id: { eq: id } })
    .execute();

  const [row] = rows;
  return row ? toRoom(row) : null;
}

export async function updateRoom(
  id: string,
  updates: Partial<
    Pick<
      Room,
      | 'title'
      | 'description'
      | 'isOpen'
      | 'isAcceptingQuestions'
      | 'qnaEnabled'
      | 'brandTitle'
      | 'showJoinInfo'
      | 'themePreset'
      | 'themeBackground'
      | 'themeText'
      | 'themeAccent'
    >
  >
): Promise<void> {
  const client = getRayfinClient();
  await client.data.Room.update({ id }, updates);
}

/** Children are deleted before the room itself: votes -> questions -> room. */
export async function deleteRoom(roomId: string): Promise<void> {
  const client = getRayfinClient();

  const votes = await client.data.Vote.select(['id'])
    .where({ room_id: { eq: roomId } })
    .execute();
  for (const vote of votes) {
    await client.data.Vote.delete({ id: vote.id });
  }

  const questions = await client.data.Question.select(['id'])
    .where({ room_id: { eq: roomId } })
    .execute();
  for (const question of questions) {
    await client.data.Question.delete({ id: question.id });
  }

  await client.data.Room.delete({ id: roomId });
}
