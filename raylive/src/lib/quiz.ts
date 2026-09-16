/**
 * Pure quiz timing and reveal rules.
 *
 * These decide when a question is open, when the clock has run out, and what the audience is
 * allowed to see. Keeping them free of React and Rayfin makes the rules unit-testable and means
 * one definition drives the audience view, the console, and the projected screen alike.
 */

export interface QuizActivityLike {
  kind: string;
  state: string;
  /** True while the activity is open for nicknames but the question has not started. */
  isPrepared?: boolean;
  startedAt?: Date;
  timeLimitSeconds?: number;
}

export interface RevealableOption {
  isCorrect?: boolean;
  revealedCorrect?: boolean;
}

/** The activity is the current one, but the question has not started yet. */
export function isPreparing(activity: QuizActivityLike): boolean {
  return activity.state === 'live' && activity.isPrepared === true;
}

/** The question has started and the activity is accepting answers, clock permitting. */
export function isRunning(activity: QuizActivityLike): boolean {
  return activity.state === 'live' && activity.isPrepared !== true;
}

/**
 * Milliseconds left on a timed question, or `null` when it is untimed or not started.
 * Never negative.
 */
export function remainingMs(
  activity: QuizActivityLike,
  now: number = Date.now()
): number | null {
  const limit = activity.timeLimitSeconds ?? 0;
  if (limit <= 0 || !activity.startedAt || !isRunning(activity)) return null;

  const deadline = new Date(activity.startedAt).getTime() + limit * 1000;
  return Math.max(0, deadline - now);
}

/** True once a timed question's deadline has passed. Untimed questions never expire. */
export function isExpired(
  activity: QuizActivityLike,
  now: number = Date.now()
): boolean {
  const remaining = remainingMs(activity, now);
  return remaining !== null && remaining <= 0;
}

/**
 * Whether a submission should be accepted.
 *
 * This is enforced in the client only — a row-level policy cannot express "before `startedAt`
 * plus the limit" — so it keeps the quiz fair rather than making it tamper-proof.
 */
export function canAnswer(
  activity: QuizActivityLike,
  now: number = Date.now()
): boolean {
  return isRunning(activity) && !isExpired(activity, now);
}

/**
 * Whether an option may be shown as correct.
 *
 * Only ever `revealedCorrect`, the field the presenter publishes with *Reveal answers*.
 * `isCorrect` is readable by the signed-in presenter, and the projected screen runs in that same
 * session — using it here would print the answer key on the wall as soon as a quiz started.
 */
export function showsCorrectness(option: RevealableOption): boolean {
  return option.revealedCorrect === true;
}

/**
 * Whether the vote distribution may be shown.
 *
 * Hidden while a quiz question is open, so late answerers cannot simply follow the crowd.
 * Every other activity type shows results as they arrive.
 */
export function showsDistribution(
  activity: QuizActivityLike,
  now: number = Date.now()
): boolean {
  if (activity.kind !== 'quiz') return true;
  if (isPreparing(activity)) return false;

  return activity.state === 'ended' || isExpired(activity, now);
}
