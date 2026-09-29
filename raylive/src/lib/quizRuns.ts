import type { Activity } from '../../rayfin/data/Activity';
import type { ActivityOption } from '../../rayfin/data/ActivityOption';
import type { Answer } from '../../rayfin/data/Answer';
import type { QuizRun } from '../../rayfin/data/QuizRun';
import type { QuizQuestionRun } from '../../rayfin/data/QuizQuestionRun';
import type { QuizQuestionOption } from '../../rayfin/data/QuizQuestionOption';
import type { QuizParticipant } from '../../rayfin/data/QuizParticipant';
import type { QuizQuestionParticipant } from '../../rayfin/data/QuizQuestionParticipant';
import { scoreAnswer, type LeaderboardEntry } from './aggregate';
import { inRunOrder, type RunnableActivity } from './runOrder';

export interface QuizRunData {
  run: QuizRun;
  questions: QuizQuestionRun[];
  options: QuizQuestionOption[];
  participants: QuizParticipant[];
  members: QuizQuestionParticipant[];
  answers: Answer[];
}

export function quizSeries<T extends RunnableActivity>(activities: T[], activityId: string): T[] {
  const ordered = inRunOrder(activities);
  const index = ordered.findIndex((activity) => activity.id === activityId);
  if (index < 0 || ordered[index].kind !== 'quiz') return [];
  let first = index;
  let last = index;
  while (first > 0 && ordered[first - 1].kind === 'quiz') first--;
  while (last + 1 < ordered.length && ordered[last + 1].kind === 'quiz') last++;
  return ordered.slice(first, last + 1);
}

export function completeQuizAnswers(question: QuizQuestionRun, answers: Answer[]): Answer[] {
  const groups = new Map<string, Answer[]>();
  const start = question.startedAt ? new Date(question.startedAt).getTime() : Infinity;
  const deadline = question.timeLimitSeconds > 0 ? start + question.timeLimitSeconds * 1000 : Infinity;
  const close = question.closedAt ? new Date(question.closedAt).getTime() : Infinity;
  for (const answer of answers) {
    const at = new Date(answer.createdAt).getTime();
    if (answer.quizQuestionId !== question.id || !answer.submissionId ||
        at < start || at > Math.min(deadline, close)) continue;
    const key = `${answer.participantKey}:${answer.submissionId}`;
    const group = groups.get(key) ?? [];
    group.push(answer);
    groups.set(key, group);
  }
  const newest = new Map<string, Answer[]>();
  for (const group of groups.values()) {
    const size = group[0].submissionSize;
    if (!size || !Number.isInteger(size) || size < 1 ||
        group.length !== size || group.some((answer) => answer.submissionSize !== size || !answer.option_id) ||
        new Set(group.map((answer) => answer.option_id)).size !== size) continue;
    const current = newest.get(group[0].participantKey);
    const at = Math.max(...group.map((answer) => new Date(answer.createdAt).getTime()));
    if (!current || at > Math.max(...current.map((answer) => new Date(answer.createdAt).getTime()))) {
      newest.set(group[0].participantKey, group);
    }
  }
  return [...newest.values()].flat();
}

export function shouldAutoReveal(question: QuizQuestionRun, members: QuizQuestionParticipant[], answers: Answer[], now = Date.now()): boolean {
  if (question.state !== 'running' || !question.startedAt) return false;
  if (question.timeLimitSeconds > 0 &&
      now >= new Date(question.startedAt).getTime() + question.timeLimitSeconds * 1000) return true;
  const eligible = new Set(members.filter((member) => member.question_id === question.id).map((member) => member.participantKey));
  const answered = new Set(completeQuizAnswers(question, answers).map((answer) => answer.participantKey));
  return eligible.size > 0 && [...eligible].every((key) => answered.has(key));
}

export function visibleQuizAnswers(data: QuizRunData, question: QuizQuestionRun): Answer[] {
  if (question.state === 'cleared') return [];
  const members = data.members.filter((member) => member.question_id === question.id);
  if (['closed', 'revealing', 'revealed'].includes(question.state)) {
    return data.answers.filter((answer) => answer.quizQuestionId === question.id &&
      members.some((member) => member.participantKey === answer.participantKey &&
        member.scored && member.acceptedSubmissionId && member.acceptedSubmissionId === answer.submissionId));
  }
  const eligible = new Set(members.map((member) => member.participantKey));
  return completeQuizAnswers(question, data.answers).filter((answer) => eligible.has(answer.participantKey));
}

export function quizParticipantScore(question: QuizQuestionRun, options: QuizQuestionOption[], answers: Answer[], key: string) {
  const submission = completeQuizAnswers(question, answers).filter((answer) => answer.participantKey === key);
  const correctOptions = options.filter((option) => option.question_id === question.id && option.isCorrect);
  const selected = new Set(submission.map((answer) => answer.option_id));
  const correct = correctOptions.length > 0 && selected.size === correctOptions.length &&
    correctOptions.every((option) => selected.has(option.option_id));
  const elapsed = submission.length ? Math.max(...submission.map((answer) => answer.elapsedMs ?? Infinity)) : Infinity;
  return {
    answered: submission.length > 0,
    correct,
    score: correct ? scoreAnswer(Number.isFinite(elapsed) ? elapsed : undefined, question.timeLimitSeconds) : 0,
    acceptedSubmissionId: submission[0]?.submissionId,
  };
}

export function quizLeaderboard(data: QuizRunData): LeaderboardEntry[] {
  const entries = new Map<string, LeaderboardEntry>();
  for (const participant of data.participants) {
    entries.set(participant.participantKey, {
      participantKey: participant.participantKey, name: participant.participantName,
      score: 0, correctCount: 0, answeredCount: 0,
    });
  }
  for (const member of data.members) {
    const question = data.questions.find((item) => item.id === member.question_id);
    if (!question || question.state === 'cleared') continue;
    const entry = entries.get(member.participantKey);
    if (!entry) continue;
    const result = member.scored ? member : quizParticipantScore(question, data.options, data.answers, member.participantKey);
    entry.score += result.score;
    entry.correctCount += Number(result.correct);
    entry.answeredCount += Number(result.answered);
  }
  return [...entries.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function combinedQuizLeaderboard(runs: QuizRunData[]): LeaderboardEntry[] {
  const latest = new Map<string, LeaderboardEntry>();
  const ordered = runs.filter((data) => data.run.startedAt).sort((a, b) =>
    new Date(a.run.startedAt!).getTime() - new Date(b.run.startedAt!).getTime() ||
    a.run.id.localeCompare(b.run.id)
  );
  for (const data of ordered) {
    for (const entry of quizLeaderboard(data)) {
      latest.set(`${data.run.seriesKey}:${entry.participantKey}`, entry);
    }
  }
  const combined = new Map<string, LeaderboardEntry>();
  for (const entry of latest.values()) {
    const previous = combined.get(entry.participantKey);
    combined.set(entry.participantKey, previous ? {
      ...entry, score: previous.score + entry.score,
      correctCount: previous.correctCount + entry.correctCount,
      answeredCount: previous.answeredCount + entry.answeredCount,
    } : { ...entry });
  }
  return [...combined.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function quizActivity(question: QuizQuestionRun, source: Activity): Activity {
  return {
    ...source, prompt: question.prompt, quizQuestionId: question.id,
    state: question.state === 'running' || question.state === 'lobby' ? 'live' : 'ended',
    isPrepared: question.state === 'lobby', startedAt: question.startedAt,
    timeLimitSeconds: question.timeLimitSeconds, allowMultiple: question.allowMultiple,
    allowChangeAnswer: question.allowChangeAnswer, showResults: question.showResults,
  };
}

export function quizOptions(question: QuizQuestionRun, options: QuizQuestionOption[]): ActivityOption[] {
  return options.filter((option) => option.question_id === question.id).map((option) => ({
    ...option, id: option.option_id,
    revealedCorrect: question.state === 'revealed' && option.revealedCorrect,
  }));
}
