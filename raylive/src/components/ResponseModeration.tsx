import { useRef } from 'react';

import type { Activity } from '../../rayfin/data/Activity';
import type { Answer } from '../../rayfin/data/Answer';

import {
  buildWordCloud,
  normalizeWordCloudText,
  tallyAnswers,
  type WordCloudEntry,
} from '@/lib/aggregate';

interface ResponseModerationProps {
  activity: Activity;
  answers: Answer[];
  busy: boolean;
  onDeleteResponse: (answer: Answer) => Promise<boolean>;
  onDeleteWord: (entry: WordCloudEntry) => Promise<boolean>;
}

const deleteClass =
  'min-h-11 shrink-0 self-start rounded-lg border border-admin-control-border px-3 py-2 text-sm font-medium text-admin-danger hover:border-admin-danger hover:bg-admin-danger-soft disabled:opacity-40';

export function ResponseModeration({
  activity,
  answers,
  busy,
  onDeleteResponse,
  onDeleteWord,
}: ResponseModerationProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const current = new Set(tallyAnswers(activity, answers));
  const entries = answers
    .filter((answer) => answer.textValue?.trim())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const words = buildWordCloud(answers);

  const remove = async (action: () => Promise<boolean>) => {
    if (await action()) heading.current?.focus();
  };

  return (
    <section aria-label={`Responses to ${activity.prompt}`} className="mt-4 border-t border-admin-border pt-4">
      <h3 ref={heading} tabIndex={-1} className="text-lg font-semibold text-admin-heading focus-visible:outline-2 focus-visible:outline-admin-accent-strong">
        Manage responses
      </h3>
      <p className="mt-1 text-sm text-admin-muted">
        All stored responses, including hidden entries and earlier versions.
        Deletion is permanent and does not unlock another answer attempt.
      </p>
      <fieldset disabled={busy} className="mt-4 min-w-0 disabled:opacity-60">
        {entries.length === 0 ? (
          <p className="py-4 text-sm text-admin-subtle">No stored responses to manage.</p>
        ) : activity.kind === 'wordCloud' ? (
          <ul className="space-y-3">
            {words.map((entry, index) => (
              <li key={normalizeWordCloudText(entry.word)} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-admin-border p-3">
                <div className="min-w-0 flex-1 basis-40">
                  <p id={`cloud-text-${activity.id}-${index}`} className="break-words text-sm text-admin-text">{entry.word}</p>
                  <p className="mt-1 text-xs text-admin-subtle">
                    {entry.count} stored {entry.count === 1 ? 'occurrence' : 'occurrences'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  aria-describedby={`cloud-text-${activity.id}-${index}`}
                  onClick={() => void remove(() => onDeleteWord(entry))}
                  className={deleteClass}
                >
                  Delete all occurrences
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-3">
            {entries.map((answer) => (
              <li key={answer.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-admin-border p-3">
                <div className="min-w-0 flex-1 basis-40">
                  <p id={`response-text-${answer.id}`} className="whitespace-pre-wrap break-words text-sm text-admin-text">
                    {answer.textValue}
                  </p>
                  <p className="mt-1 text-xs text-admin-subtle">
                    {answer.participantName || 'Anonymous'} · {answer.createdAt.toLocaleString()}
                    {answer.isHidden && ' · Hidden'}
                    {!current.has(answer) && ' · Earlier version'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  aria-describedby={`response-text-${answer.id}`}
                  onClick={() => void remove(() => onDeleteResponse(answer))}
                  className={deleteClass}
                >
                  Delete response
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </section>
  );
}
