/**
 * Pure run-order resolution for the presenter controls.
 *
 * The control bar, the keyboard shortcuts, and the phone remote all drive the room through these
 * functions, so "next" means the same thing everywhere.
 */

export interface RunnableActivity {
  id: string;
  kind: string;
  state: string;
  position: number;
  isPrepared?: boolean;
}

/** Activities in presentation order. */
export function inRunOrder<T extends RunnableActivity>(activities: T[]): T[] {
  return [...activities].sort((a, b) => a.position - b.position);
}

/** The activity currently on screen, if any. */
export function currentActivity<T extends RunnableActivity>(
  activities: T[]
): T | null {
  return activities.find((activity) => activity.state === 'live') ?? null;
}

/**
 * The activity a "next" action should move to.
 *
 * Before anything has run this is the first activity; afterwards it is the one after whatever is
 * live. Returns `null` at the end of the list.
 */
export function nextActivity<T extends RunnableActivity>(
  activities: T[]
): T | null {
  const ordered = inRunOrder(activities);
  if (ordered.length === 0) return null;

  const current = currentActivity(ordered);
  if (!current) return ordered[0];

  const index = ordered.findIndex((activity) => activity.id === current.id);
  return ordered[index + 1] ?? null;
}

/** The activity a "previous" action should move to, or `null` at the start. */
export function previousActivity<T extends RunnableActivity>(
  activities: T[]
): T | null {
  const ordered = inRunOrder(activities);
  const current = currentActivity(ordered);
  if (!current) return null;

  const index = ordered.findIndex((activity) => activity.id === current.id);
  return index > 0 ? ordered[index - 1] : null;
}

export type ActivationMode = 'prepare' | 'live';

/**
 * How an activity should be opened.
 *
 * Quizzes are prepared first so attendees can pick a nickname before the clock starts;
 * everything else goes straight live.
 */
export function activationMode(activity: RunnableActivity): ActivationMode {
  return activity.kind === 'quiz' ? 'prepare' : 'live';
}

/** Whether the primary action should start a question that is sitting in the lobby. */
export function canStartPrepared(activity: RunnableActivity | null): boolean {
  return (
    !!activity && activity.state === 'live' && activity.isPrepared === true
  );
}
