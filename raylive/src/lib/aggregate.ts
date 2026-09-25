/**
 * Pure aggregation helpers for every activity kind.
 *
 * These run in the browser because the fluent client has no `count()`: every surface fetches
 * raw answer rows and tallies them here. Keeping them free of any Rayfin dependency makes
 * them unit-testable and reusable by the audience, console, and live views alike.
 */

/** Minimal shape of an answer row, tolerant of fields hidden from anonymous reads. */
export interface AnswerLike {
  participantKey?: string;
  participantName?: string;
  submissionId?: string;
  option_id?: string;
  textValue?: string;
  ratingValue?: number;
  rankPosition?: number;
  elapsedMs?: number;
  isHidden?: boolean;
  createdAt?: Date;
  activity_id?: string;
}

/** Minimal shape of an option row. `isCorrect` is absent for anonymous readers. */
export interface OptionLike {
  id: string;
  label: string;
  position: number;
  isCorrect?: boolean;
  revealedCorrect?: boolean;
}

export interface ChoiceResult {
  optionId: string;
  label: string;
  count: number;
  percentage: number;
}

export interface WordCloudEntry {
  word: string;
  count: number;
  /** 0..1, relative to the most frequent word — drives font size. */
  weight: number;
}

export function normalizeWordCloudText(value: string): string {
  return value.trim().toLowerCase();
}

export interface RatingSummary {
  average: number;
  count: number;
  distribution: { value: number; count: number }[];
}

export interface RankingResult {
  optionId: string;
  label: string;
  score: number;
  averageRank: number;
  count: number;
}

export interface LeaderboardEntry {
  participantKey: string;
  name: string;
  score: number;
  correctCount: number;
  answeredCount: number;
}

/** Points awarded for a correct answer before the speed bonus. */
export const QUIZ_BASE_POINTS = 1000;
/** Share of the base score that decays with elapsed time on timed questions. */
const SPEED_WEIGHT = 0.5;

function sortByPosition(options: OptionLike[]): OptionLike[] {
  return [...options].sort((a, b) => a.position - b.position);
}

/**
 * Keeps only each participant's most recent submission.
 *
 * Anonymous callers cannot update or delete rows, so changing an answer means writing a new
 * submission and letting the older one be superseded here. Rows sharing a `submissionId` belong
 * to one submission, which keeps multi-select and ranking answers intact. Rows without a
 * participant key (older data) are passed through untouched.
 */
export function latestSubmissions(answers: AnswerLike[]): AnswerLike[] {
  const newest = new Map<string, { at: number; submissionId?: string }>();

  for (const answer of answers) {
    if (!answer.participantKey) continue;

    const at = answer.createdAt?.getTime() ?? 0;
    const current = newest.get(answer.participantKey);
    if (!current || at > current.at) {
      newest.set(answer.participantKey, {
        at,
        submissionId: answer.submissionId,
      });
    }
  }

  return answers.filter((answer) => {
    if (!answer.participantKey) return true;

    const current = newest.get(answer.participantKey);
    if (!current) return true;

    // Fall back to the timestamp when rows predate submission ids.
    return current.submissionId
      ? answer.submissionId === current.submissionId
      : (answer.createdAt?.getTime() ?? 0) === current.at;
  });
}

/** Minimal activity shape needed to decide how answers are tallied. */
export interface TallyActivity {
  kind: string;
  allowMultiple?: boolean;
}

/**
 * Word clouds and open text with `allowMultiple` invite several *separate* submissions from one
 * person, so their rows must all count. Everywhere else one participant means one answer, and a
 * re-submission supersedes the previous one.
 */
export function allowsMultipleSubmissions(activity: TallyActivity): boolean {
  return (
    (activity.kind === 'wordCloud' || activity.kind === 'openText') &&
    !!activity.allowMultiple
  );
}

/** Answers to feed into a tally, de-duplicated unless the activity invites multiple entries. */
export function tallyAnswers(
  activity: TallyActivity,
  answers: AnswerLike[]
): AnswerLike[] {
  return allowsMultipleSubmissions(activity)
    ? answers
    : latestSubmissions(answers);
}
export function countChoices(
  options: OptionLike[],
  answers: AnswerLike[]
): ChoiceResult[] {
  const counts = new Map<string, number>();
  for (const answer of answers) {
    if (!answer.option_id) continue;
    counts.set(answer.option_id, (counts.get(answer.option_id) ?? 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);

  return sortByPosition(options).map((option) => {
    const count = counts.get(option.id) ?? 0;
    return {
      optionId: option.id,
      label: option.label,
      count,
      percentage: total === 0 ? 0 : Math.round((count / total) * 100),
    };
  });
}

/**
 * Groups free-text answers into word-cloud entries. Matching is case-insensitive and
 * whitespace-trimmed; the most common original spelling is kept for display, falling back to
 * the first one submitted when spellings tie.
 */
export function buildWordCloud(answers: AnswerLike[]): WordCloudEntry[] {
  const groups = new Map<
    string,
    { count: number; spellings: Map<string, number> }
  >();

  for (const answer of answers) {
    const raw = answer.textValue?.trim();
    if (!raw) continue;

    const key = normalizeWordCloudText(raw);
    const group = groups.get(key) ?? { count: 0, spellings: new Map() };
    group.count += 1;
    group.spellings.set(raw, (group.spellings.get(raw) ?? 0) + 1);
    groups.set(key, group);
  }

  const max = Math.max(1, ...[...groups.values()].map((g) => g.count));

  return [...groups.values()]
    .map((group) => {
      // Array.sort is stable, and Map preserves insertion order, so equally
      // common spellings resolve to the one submitted first.
      const [word] = [...group.spellings.entries()].sort(
        (a, b) => b[1] - a[1]
      )[0];
      return { word, count: group.count, weight: group.count / max };
    })
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

/** Average, total, and per-value distribution for a rating activity. */
export function summarizeRating(
  answers: AnswerLike[],
  maxRating = 5
): RatingSummary {
  const values = answers
    .map((answer) => answer.ratingValue)
    .filter((value): value is number => typeof value === 'number');

  const distribution = Array.from({ length: maxRating }, (_, index) => ({
    value: index + 1,
    count: values.filter((value) => value === index + 1).length,
  }));

  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    average: values.length === 0 ? 0 : total / values.length,
    count: values.length,
    distribution,
  };
}

/**
 * Borda count: an option ranked `r` out of `n` scores `n - r` points, so first place is
 * worth the most. Options are returned best-first.
 */
export function rankOptions(
  options: OptionLike[],
  answers: AnswerLike[]
): RankingResult[] {
  const optionCount = options.length;
  const totals = new Map<
    string,
    { score: number; rankSum: number; count: number }
  >();

  for (const answer of answers) {
    if (!answer.option_id || typeof answer.rankPosition !== 'number') continue;

    const entry = totals.get(answer.option_id) ?? {
      score: 0,
      rankSum: 0,
      count: 0,
    };
    entry.score += Math.max(0, optionCount - answer.rankPosition);
    entry.rankSum += answer.rankPosition;
    entry.count += 1;
    totals.set(answer.option_id, entry);
  }

  return sortByPosition(options)
    .map((option) => {
      const entry = totals.get(option.id) ?? { score: 0, rankSum: 0, count: 0 };
      return {
        optionId: option.id,
        label: option.label,
        score: entry.score,
        averageRank: entry.count === 0 ? 0 : entry.rankSum / entry.count,
        count: entry.count,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.averageRank || Infinity) - (b.averageRank || Infinity)
    );
}

/** Visible open-text answers, newest first. */
export function listOpenText(answers: AnswerLike[]): AnswerLike[] {
  return answers
    .filter((answer) => !answer.isHidden && answer.textValue?.trim())
    .sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    );
}

/**
 * Score for one correct answer. Timed questions keep half the base score and award the rest
 * on a linear decay to the time limit, so answering instantly is worth the full amount.
 */
export function scoreAnswer(
  elapsedMs: number | undefined,
  timeLimitSeconds: number | undefined
): number {
  if (!timeLimitSeconds || timeLimitSeconds <= 0) return QUIZ_BASE_POINTS;

  const limitMs = timeLimitSeconds * 1000;
  const elapsed = Math.min(Math.max(elapsedMs ?? limitMs, 0), limitMs);
  const speedFactor = 1 - elapsed / limitMs;

  return Math.round(
    QUIZ_BASE_POINTS * (1 - SPEED_WEIGHT) +
      QUIZ_BASE_POINTS * SPEED_WEIGHT * speedFactor
  );
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

export interface QuizActivityInput {
  id: string;
  timeLimitSeconds?: number;
  options: OptionLike[];
  answers: AnswerLike[];
}

/**
 * Builds a leaderboard across every quiz activity in a room.
 *
 * Requires `isCorrect`, which only the authenticated presenter can read, so this runs on the
 * presenter's screen. A participant scores a question only by selecting exactly the correct
 * set of options.
 */
export function buildLeaderboard(
  activities: QuizActivityInput[]
): LeaderboardEntry[] {
  const participants = new Map<string, LeaderboardEntry>();

  for (const activity of activities) {
    const correctIds = new Set(
      activity.options.filter((option) => option.isCorrect).map((o) => o.id)
    );
    if (correctIds.size === 0) continue;

    const byParticipant = new Map<string, AnswerLike[]>();
    // A participant who changed their answer has several submissions; only the newest counts.
    for (const answer of latestSubmissions(activity.answers)) {
      if (!answer.participantKey || !answer.option_id) continue;
      const list = byParticipant.get(answer.participantKey) ?? [];
      list.push(answer);
      byParticipant.set(answer.participantKey, list);
    }

    for (const [participantKey, answers] of byParticipant) {
      const entry = participants.get(participantKey) ?? {
        participantKey,
        name: 'Anonymous',
        score: 0,
        correctCount: 0,
        answeredCount: 0,
      };

      const named = answers.find((answer) => answer.participantName?.trim());
      if (named?.participantName) entry.name = named.participantName.trim();

      entry.answeredCount += 1;

      const selected = new Set(
        answers
          .map((answer) => answer.option_id)
          .filter((id): id is string => !!id)
      );

      if (sameSet(selected, correctIds)) {
        entry.correctCount += 1;
        const fastest = Math.min(
          ...answers.map(
            (answer) => answer.elapsedMs ?? Number.POSITIVE_INFINITY
          )
        );
        entry.score += scoreAnswer(
          Number.isFinite(fastest) ? fastest : undefined,
          activity.timeLimitSeconds
        );
      }

      participants.set(participantKey, entry);
    }
  }

  return [...participants.values()].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name)
  );
}

/** Distinct participants who answered, used for "N responses" counters. */
export function countParticipants(answers: AnswerLike[]): number {
  const keys = new Set(
    answers.map((answer) => answer.participantKey).filter(Boolean)
  );
  return keys.size > 0 ? keys.size : answers.length;
}

/** True when this browser's participant already has an answer recorded for the activity. */
export function hasAnswered(
  answers: AnswerLike[],
  participantKey: string
): boolean {
  return answers.some((answer) => answer.participantKey === participantKey);
}
