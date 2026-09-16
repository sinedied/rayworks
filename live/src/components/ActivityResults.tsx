import type { Activity } from '../../rayfin/data/Activity';
import type { ActivityOption } from '../../rayfin/data/ActivityOption';
import type { Answer } from '../../rayfin/data/Answer';

import { useFlipList } from '@/hooks/useFlipList';
import { showsCorrectness, showsDistribution } from '@/lib/quiz';
import {
  buildWordCloud,
  countChoices,
  countParticipants,
  listOpenText,
  rankOptions,
  summarizeRating,
  tallyAnswers,
} from '@/lib/aggregate';

export interface ResultsProps {
  activity: Activity;
  options: ActivityOption[];
  answers: Answer[];
  /** Dark, large-format styling for the projected view. */
  stage?: boolean;
}

/** Renders the live results for any activity kind, themed for console or stage. */
export function ActivityResults({
  activity,
  options,
  answers: rawAnswers,
  stage = false,
}: ResultsProps) {
  // One participant counts once, unless the activity invites several entries.
  const answers = tallyAnswers(activity, rawAnswers) as Answer[];

  switch (activity.kind) {
    case 'wordCloud':
      return <WordCloudResults answers={answers} stage={stage} />;
    case 'rating':
      return (
        <RatingResults
          answers={answers}
          maxRating={activity.maxRating ?? 5}
          stage={stage}
        />
      );
    case 'openText':
      return <OpenTextResults answers={answers} stage={stage} />;
    case 'ranking':
      return <RankingResults options={options} answers={answers} stage={stage} />;
    default:
      // While a quiz question is open its distribution stays hidden, otherwise late answerers
      // can simply follow the crowd on the projected screen.
      return showsDistribution(activity) ? (
        <ChoiceResults
          options={options}
          answers={answers}
          stage={stage}
          showCorrect={activity.kind === 'quiz'}
        />
      ) : (
        <AnswersLocked answers={answers} stage={stage} />
      );
  }
}

export function ResponseCount({
  answers,
  stage,
}: {
  answers: Answer[];
  stage?: boolean;
}) {
  const count = countParticipants(answers);
  return (
    <p className={'text-[var(--ia-muted)] ' + (stage ? 'text-lg' : 'text-xs')}>
      {count} {count === 1 ? 'response' : 'responses'}
    </p>
  );
}

function ChoiceResults({
  options,
  answers,
  stage,
  showCorrect,
}: {
  options: ActivityOption[];
  answers: Answer[];
  stage: boolean;
  showCorrect: boolean;
}) {
  const results = countChoices(options, answers);
  const optionById = new Map(options.map((option) => [option.id, option]));

  return (
    <ul className={stage ? 'space-y-4' : 'space-y-2'}>
      {results.map((result) => {
        const option = optionById.get(result.optionId);
        // Never `isCorrect`: the projected screen runs in the presenter's signed-in session,
        // so reading it here would print the answer key on the wall. Only an explicit reveal
        // (`revealedCorrect`) may highlight an option.
        const highlight =
          showCorrect && !!option && showsCorrectness(option);

        return (
          <li
            key={result.optionId}
            className={`relative overflow-hidden rounded-xl ${
              stage
              ? 'bg-[var(--ia-surface)] px-4 py-3 sm:px-6 sm:py-4'
              : 'border border-[var(--ia-border)] bg-[var(--ia-surface)] px-4 py-3'
            } ${highlight ? 'ring-2 ring-green-500' : ''}`}
          >
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                highlight ? 'bg-green-500/25' : 'bg-[var(--ia-accent-soft)]'
              }`}
              style={{ width: `${result.percentage}%` }}
              aria-hidden="true"
            />
            <div className="relative flex items-center justify-between gap-4">
              <span
                className={
                  stage
                    ? 'text-[clamp(1.125rem,2.5vw,1.5rem)] text-[var(--ia-text)]'
                    : 'text-sm text-[var(--ia-text)]'
                }
              >
                {result.label}
                {highlight && (
                  <span className="ml-2 text-green-500" aria-label="Correct">
                    ✓
                  </span>
                )}
              </span>
              <span
                className={`shrink-0 font-semibold ${
                  stage
                    ? 'text-[clamp(1.125rem,2.5vw,1.5rem)] text-[var(--ia-accent)]'
                    : 'text-sm text-[var(--ia-muted)]'
                }`}
              >
                {result.percentage}%{' '}
                <span className={'text-[var(--ia-muted)]'}>
                  ({result.count})
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function WordCloudResults({
  answers,
  stage,
}: {
  answers: Answer[];
  stage: boolean;
}) {
  const words = buildWordCloud(answers);

  if (words.length === 0) return <Empty stage={stage} />;

  const minSize = stage ? 1.4 : 0.9;
  const maxSize = stage ? 5 : 2.2;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 py-4">
      {words.map((entry) => (
        <span
          key={entry.word}
          title={`${entry.count}×`}
          style={{
            fontSize: `${minSize + (maxSize - minSize) * entry.weight}rem`,
            opacity: 0.55 + 0.45 * entry.weight,
          }}
          className={`font-semibold leading-none ${
            'text-[var(--ia-accent)]'
          }`}
        >
          {entry.word}
        </span>
      ))}
    </div>
  );
}

function RatingResults({
  answers,
  maxRating,
  stage,
}: {
  answers: Answer[];
  maxRating: number;
  stage: boolean;
}) {
  const summary = summarizeRating(answers, maxRating);

  if (summary.count === 0) return <Empty stage={stage} />;

  const max = Math.max(1, ...summary.distribution.map((entry) => entry.count));

  return (
    <div>
      <p
        className={`text-center font-bold ${
          stage ? 'text-6xl text-[var(--ia-text)]' : 'text-3xl text-[var(--ia-text)]'
        }`}
      >
        {summary.average.toFixed(1)}
        <span className={stage ? 'text-3xl text-[var(--ia-muted)]' : 'text-lg text-[var(--ia-muted)]'}>
          {' '}
          / {maxRating}
        </span>
      </p>

      <div className={`mt-4 space-y-2 ${stage ? 'text-lg' : 'text-xs'}`}>
        {[...summary.distribution].reverse().map((entry) => (
          <div key={entry.value} className="flex items-center gap-3">
            <span className={stage ? 'w-16 text-[var(--ia-muted)]' : 'w-10 text-[var(--ia-muted)]'}>
              {entry.value} ★
            </span>
            <div
              className={`h-3 flex-1 overflow-hidden rounded-full ${
                'bg-[var(--ia-border)]'
              }`}
            >
              <div
                className={'h-full bg-[var(--ia-accent)]'}
                style={{ width: `${(entry.count / max) * 100}%` }}
              />
            </div>
            <span className={stage ? 'w-10 text-[var(--ia-muted)]' : 'w-8 text-[var(--ia-muted)]'}>
              {entry.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OpenTextResults({
  answers,
  stage,
}: {
  answers: Answer[];
  stage: boolean;
}) {
  const visible = listOpenText(answers);

  if (visible.length === 0) return <Empty stage={stage} />;

  return (
    <ul className={stage ? 'space-y-3' : 'space-y-2'}>
      {visible.slice(0, stage ? 8 : 50).map((answer, index) => (
        <li
          key={index}
          className={
            stage
              ? 'rounded-xl bg-[var(--ia-surface)] px-6 py-4 text-2xl text-[var(--ia-text)]'
              : 'rounded-xl border border-[var(--ia-border)] bg-[var(--ia-surface)] px-4 py-3 text-sm text-[var(--ia-text)]'
          }
        >
          {answer.textValue}
          {answer.participantName && (
            <span
              className={
                stage ? 'ml-3 text-lg text-[var(--ia-muted)]' : 'ml-2 text-xs text-[var(--ia-muted)]'
              }
            >
              — {answer.participantName}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function RankingResults({
  options,
  answers,
  stage,
}: {
  options: ActivityOption[];
  answers: Answer[];
  stage: boolean;
}) {
  const results = rankOptions(options, answers);
  const max = Math.max(1, ...results.map((result) => result.score));
  // Rows change order as votes arrive, which no CSS transition can cover.
  const register = useFlipList(results.map((result) => result.optionId));

  return (
    <ol className={stage ? 'space-y-4' : 'space-y-2'}>
      {results.map((result, index) => (
        <li
          key={result.optionId}
          ref={register(result.optionId)}
          className={`relative overflow-hidden rounded-xl ${
            stage
              ? 'bg-[var(--ia-surface)] px-6 py-4'
              : 'border border-[var(--ia-border)] bg-[var(--ia-surface)] px-4 py-3'
          }`}
        >
          <div
            className="absolute inset-y-0 left-0 bg-[var(--ia-accent-soft)] transition-all duration-500"
            style={{ width: `${(result.score / max) * 100}%` }}
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-4">
            <span
              className={`shrink-0 font-bold ${
                stage ? 'text-3xl text-[var(--ia-accent)]' : 'text-lg text-[var(--ia-accent)]'
              }`}
            >
              #{index + 1}
            </span>
            <span
              className={`flex-1 ${stage ? 'text-2xl text-[var(--ia-text)]' : 'text-sm text-[var(--ia-text)]'}`}
            >
              {result.label}
            </span>
            <span
              className={'text-[var(--ia-muted)] ' + (stage ? 'text-lg' : 'text-xs')}
            >
              {result.count > 0
                ? `avg ${result.averageRank.toFixed(1)}`
                : 'no votes'}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Placeholder shown instead of a running quiz's distribution. */
function AnswersLocked({
  answers,
  stage,
}: {
  answers: Answer[];
  stage: boolean;
}) {
  const count = countParticipants(answers);

  return (
    <div className="py-8 text-center">
      <p
        className={`font-bold text-[var(--ia-accent)] ${
          stage ? 'text-7xl' : 'text-4xl'
        }`}
      >
        {count}
      </p>
      <p
        className={`mt-2 text-[var(--ia-muted)] ${
          stage ? 'text-2xl' : 'text-sm'
        }`}
      >
        {count === 1 ? 'answer in' : 'answers in'} · results after the question
        closes
      </p>
    </div>
  );
}

function Empty({ stage }: { stage: boolean }) {
  return (
    <p
      className={`py-8 text-center ${
        stage ? 'text-2xl text-[var(--ia-muted)]' : 'text-sm text-[var(--ia-muted)]'
      }`}
    >
      Waiting for responses…
    </p>
  );
}
