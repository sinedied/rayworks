import { useEffect, useState } from 'react';
import type { Room } from '../../rayfin/data/Room';
import type { Activity } from '../../rayfin/data/Activity';
import type { QuizRun } from '../../rayfin/data/QuizRun';
import type { Answer } from '../../rayfin/data/Answer';
import type { ActivityOption } from '../../rayfin/data/ActivityOption';
import { ActivityResults } from './ActivityResults';
import { Leaderboard } from './Leaderboard';
import { listQuizRuns, loadQuizRun } from '@/services/quizRuns';
import { visibleQuizAnswers, quizActivity, quizOptions, quizLeaderboard, type QuizRunData } from '@/lib/quizRuns';
import { buildLeaderboard } from '@/lib/aggregate';
import { listAnswers } from '@/services/answers';
import { listOptions } from '@/services/activities';

export function QuizHistory({ room, activities }: { room: Room; activities: Activity[] }) {
  const [runs, setRuns] = useState<QuizRun[]>([]);
  const [selected, setSelected] = useState('');
  const [data, setData] = useState<QuizRunData | null>(null);
  const [legacy, setLegacy] = useState<{ answers: Answer[]; options: ActivityOption[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    void listQuizRuns(room.id).then((rows) => { if (active) setRuns(rows); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Could not load quiz runs.'); });
    return () => { active = false; };
  }, [room.id, room.quizRunId, retry]);
  useEffect(() => {
    if (!selected) { setData(null); setLegacy(null); return; }
    let active = true;
    setLoading(true);
    setError(null);
    setLegacy(null);
    setData(null);
    const load = selected === 'legacy'
      ? Promise.all([listAnswers(room.id, undefined, true), listOptions(room.id)]).then(([answers, options]) => {
        if (active) setLegacy({ answers, options });
      })
      : loadQuizRun({ id: room.id, owner_id: room.owner_id }, selected).then((value) => { if (active) setData(value); });
    void load
      .catch((err) => { if (active) { setData(null); setError(err instanceof Error ? err.message : 'Could not load this run.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [room.id, room.owner_id, selected, retry]);
  return (
    <section className="mt-8 border-t border-admin-border pt-5 [overflow-wrap:anywhere]">
      <h2 className="text-lg font-semibold text-admin-heading">Quiz run history</h2>
      <p className="mt-1 text-sm text-admin-muted">Read-only. Selecting a run does not change the audience or projector.</p>
      <button onClick={() => setRetry((value) => value + 1)} className="mt-2 rounded-lg border border-admin-control-border px-3 py-2 text-sm">Refresh history</button>
      <label className="mt-3 block text-sm text-admin-muted">
        Run
        <select aria-label="Run" value={selected} onChange={(event) => setSelected(event.target.value)}
          className="mt-1 w-full rounded-lg border border-admin-control-border bg-white px-3 py-2">
          <option value="">Choose a run</option>
          <option value="legacy">Legacy results (before quiz runs)</option>
          {runs.filter((run) => run.state !== 'building').map((run) => (
            <option key={run.id} value={run.id}>{run.title} - {run.createdAt.toLocaleString()} ({run.state})</option>
          ))}
        </select>
      </label>
      {loading && <p role="status" className="mt-3 text-sm">Loading run...</p>}
      {error && <p role="alert" className="mt-3 text-sm text-admin-danger">{error} <button onClick={() => setRetry((value) => value + 1)}>Retry</button></p>}
      {legacy && !loading && <div className="mt-5 space-y-4">
        <p className="text-sm text-admin-muted">Legacy answers have no run or attendee roster. They are excluded from run-aware combined scores.</p>
        <Leaderboard entries={buildLeaderboard(activities.filter((activity) => activity.kind === 'quiz').map((activity) => ({
          id: activity.id, timeLimitSeconds: activity.timeLimitSeconds,
          answers: legacy.answers.filter((answer) => answer.activity_id === activity.id),
          options: legacy.options.filter((option) => option.activity_id === activity.id),
        })))} limit={legacy.answers.length} />
        {activities.filter((activity) => activity.kind === 'quiz').map((activity) => (
          <article key={activity.id}>
            <h3 className="mb-2 font-medium">{activity.prompt}</h3>
            <ActivityResults activity={{ ...activity, state: 'ended' }}
              answers={legacy.answers.filter((answer) => answer.activity_id === activity.id)}
              options={legacy.options.filter((option) => option.activity_id === activity.id)} />
          </article>
        ))}
      </div>}
      {data && !loading && (
        <div className="mt-5 space-y-5">
          <Leaderboard entries={quizLeaderboard(data)} limit={data.participants.length} />
          {data.questions.map((question) => {
            const source = activities.find((activity) => activity.id === question.activity_id);
            if (!source) return <p key={question.id}>{question.prompt} - activity deleted</p>;
            return (
              <article key={question.id} className="rounded-lg border border-admin-border p-4">
                <h3 className="font-medium text-admin-heading">{question.position + 1}. {question.prompt}</h3>
                <p className="mb-3 text-xs text-admin-subtle">{question.state}</p>
                {question.state === 'cleared' ? <p>Responses cleared.</p> : <>
                  <ActivityResults activity={quizActivity(question, source)} options={quizOptions(question, data.options)}
                    answers={visibleQuizAnswers(data, question)} />
                  <ul className="mt-3 space-y-2 text-sm text-admin-muted">
                    {data.members.filter((member) => member.question_id === question.id).map((member) => (
                      <li key={member.id}>
                        {member.participantName}: {member.answered ? data.answers
                          .filter((answer) => answer.quizQuestionId === question.id && answer.submissionId === member.acceptedSubmissionId)
                          .map((answer) => data.options.find((option) => option.question_id === question.id && option.option_id === answer.option_id)?.label ?? 'Unknown option')
                          .join(', ') : 'No finalized answer'} - {member.score} points
                      </li>
                    ))}
                  </ul>
                </>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
