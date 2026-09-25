const PARTICIPANT_KEY_STORAGE = 'raylive:participant-key';
const PARTICIPANT_NAME_STORAGE = 'raylive:participant-name';
const VOTED_STORAGE = 'raylive:voted';
const ANSWERED_STORAGE = 'raylive:answered';

/**
 * Storage can be unavailable when the live view is embedded in a third-party
 * iframe (a slide deck), so every access degrades to an in-memory fallback that
 * lasts for the lifetime of the page.
 */
const memoryStore = new Map<string, string>();

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memoryStore.get(key) ?? null;
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

function writeStorage(key: string, value: string): void {
  memoryStore.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore: the in-memory copy above keeps the session usable.
  }
}

function readIdSet(key: string): Set<string> {
  const raw = readStorage(key);
  if (!raw) return new Set();

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((id): id is string => typeof id === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

function addToIdSet(key: string, id: string): void {
  const ids = readIdSet(key);
  ids.add(id);
  writeStorage(key, JSON.stringify([...ids]));
}

/**
 * Stable per-browser identifier used to group a participant's answers and for best-effort
 * de-duplication. This is not a security boundary — see "Security model" in README.md.
 */
export function getParticipantKey(): string {
  const existing = readStorage(PARTICIPANT_KEY_STORAGE);
  if (existing) return existing;

  const created = crypto.randomUUID();
  writeStorage(PARTICIPANT_KEY_STORAGE, created);
  return created;
}

/** Nickname shown on quiz leaderboards, asked once and reused across the room. */
export function getParticipantName(): string {
  return readStorage(PARTICIPANT_NAME_STORAGE) ?? '';
}

export function setParticipantName(name: string): void {
  writeStorage(PARTICIPANT_NAME_STORAGE, name.trim());
}

/**
 * Question ids this browser has already upvoted. Anonymous callers cannot read
 * `Vote.participantKey` back from the API, so the UI tracks its own votes locally.
 */
export function getVotedQuestionIds(): Set<string> {
  return readIdSet(VOTED_STORAGE);
}

export function rememberVote(questionId: string): void {
  addToIdSet(VOTED_STORAGE, questionId);
}

export function activityAnswerKey(activityId: string, resetId?: string): string {
  return resetId ? `${activityId}:${resetId}` : activityId;
}

/** Legacy activities keep their original key until responses are explicitly reset. */
export function getAnsweredActivityIds(): Set<string> {
  return readIdSet(ANSWERED_STORAGE);
}

export function rememberAnswered(activityId: string, resetId?: string): void {
  addToIdSet(ANSWERED_STORAGE, activityAnswerKey(activityId, resetId));
}
