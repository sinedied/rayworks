import { allowsMultipleSubmissions, type AnswerLike, type TallyActivity } from './aggregate';

export function isFreeformActivity(activity: TallyActivity): boolean {
  return activity.kind === 'wordCloud' || activity.kind === 'openText';
}

interface SubmissionOrder {
  at: number;
  index: number;
}

// Match latestSubmissions: later timestamps win, with the first encountered row winning ties.
function compareSubmissions(a: SubmissionOrder, b: SubmissionOrder): number {
  return a.at - b.at || b.index - a.index;
}

/** Select older replacements too, without touching newer answers or independent entries. */
export function responseDeletionTargets<T extends AnswerLike & { id: string }>(
  activity: TallyActivity,
  answers: T[],
  selectedIds: ReadonlySet<string>
): T[] {
  const groups = new Map<string, SubmissionOrder>();
  const orderById = new Map<string, SubmissionOrder>();

  for (const [index, answer] of answers.entries()) {
    const at = answer.createdAt?.getTime() ?? 0;
    const key = answer.participantKey
      ? JSON.stringify([answer.participantKey, answer.submissionId ?? at])
      : answer.id;
    let group = groups.get(key);
    if (!group) {
      group = { at, index };
      groups.set(key, group);
    } else if (at > group.at) {
      group.at = at;
      group.index = index;
    }
    orderById.set(answer.id, group);
  }

  const cutoffs = new Map<string, SubmissionOrder>();
  if (!allowsMultipleSubmissions(activity)) {
    for (const answer of answers) {
      if (!selectedIds.has(answer.id) || !answer.participantKey) continue;
      const order = orderById.get(answer.id)!;
      const current = cutoffs.get(answer.participantKey);
      if (!current || compareSubmissions(order, current) > 0) {
        cutoffs.set(answer.participantKey, order);
      }
    }
  }

  return answers
    .filter((answer) => {
      if (selectedIds.has(answer.id)) return true;
      const cutoff = answer.participantKey ? cutoffs.get(answer.participantKey) : undefined;
      return !!cutoff && compareSubmissions(orderById.get(answer.id)!, cutoff) < 0;
    })
    .sort((a, b) => compareSubmissions(orderById.get(a.id)!, orderById.get(b.id)!));
}
