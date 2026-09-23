import { useState } from 'react';

import type { ActivityKind } from '../../rayfin/data/Activity';

import {
  ACTIVITY_LABELS,
  OPTION_BASED_KINDS,
  type NewActivityInput,
} from '@/services/activities';

const KIND_HINTS: Record<ActivityKind, string> = {
  multipleChoice: 'Vote on predefined options',
  wordCloud: 'Short answers, sized by how often they repeat',
  rating: 'Score on a star scale',
  openText: 'Longer free-form answers',
  ranking: 'Order options by preference',
  quiz: 'Right answers, a timer, and a leaderboard',
};

const KINDS = Object.keys(ACTIVITY_LABELS) as ActivityKind[];

const inputClass =
  'w-full rounded-lg border border-admin-control-border px-3 py-2 text-sm focus:border-admin-accent-strong focus:outline-none focus:ring-1 focus:ring-admin-accent-strong';

interface OptionDraft {
  label: string;
  isCorrect: boolean;
}

/** Creates any activity kind. Options and quiz answers are edited inline. */
export function ActivityBuilder({
  onCreate,
  busy,
}: {
  onCreate: (input: NewActivityInput) => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ActivityKind>('multipleChoice');
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState<OptionDraft[]>([
    { label: '', isCorrect: false },
    { label: '', isCorrect: false },
  ]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [maxRating, setMaxRating] = useState(5);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(20);
  const [showResults, setShowResults] = useState(true);
  const [allowChangeAnswer, setAllowChangeAnswer] = useState(false);

  const needsOptions = OPTION_BASED_KINDS.includes(kind);
  const filledOptions = options
    .map((option) => ({ ...option, label: option.label.trim() }))
    .filter((option) => option.label);
  const canSubmit =
    prompt.trim().length > 0 && (!needsOptions || filledOptions.length >= 2);

  const reset = () => {
    setPrompt('');
    setOptions([
      { label: '', isCorrect: false },
      { label: '', isCorrect: false },
    ]);
    setAllowMultiple(false);
    setShowResults(true);
    setAllowChangeAnswer(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || busy) return;

    await onCreate({
      kind,
      prompt,
      optionLabels: needsOptions
        ? filledOptions.map((option) => option.label)
        : undefined,
      correctLabels:
        kind === 'quiz'
          ? filledOptions
              .filter((option) => option.isCorrect)
              .map((option) => option.label)
          : undefined,
      allowMultiple,
      allowChangeAnswer,
      maxRating,
      timeLimitSeconds,
      showResults,
    });

    reset();
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-admin-control-border px-4 py-4 text-sm font-medium text-admin-muted transition-colors hover:border-admin-accent-strong hover:text-admin-accent-strong"
      >
        + Add an activity
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="rounded-lg border border-admin-border bg-white p-5 shadow-sm"
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {KINDS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
              kind === option
                ? 'border-admin-accent-strong bg-admin-accent-soft text-admin-accent-strong'
                : 'border-admin-border hover:border-admin-accent-strong'
            }`}
          >
            <span className="block font-semibold">
              {ACTIVITY_LABELS[option]}
            </span>
            <span className="mt-0.5 block text-xs text-admin-muted">
              {KIND_HINTS[option]}
            </span>
          </button>
        ))}
      </div>

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Your question…"
        className={`${inputClass} resize-none`}
      />

      {needsOptions && (
        <div className="mt-4 space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              {kind === 'quiz' && (
                <input
                  type="checkbox"
                  checked={option.isCorrect}
                  onChange={(event) =>
                    setOptions((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, isCorrect: event.target.checked }
                          : item
                      )
                    )
                  }
                  title="Correct answer"
                  className="h-4 w-4 accent-green-600"
                />
              )}
              <input
                value={option.label}
                onChange={(event) =>
                  setOptions((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, label: event.target.value }
                        : item
                    )
                  )
                }
                maxLength={200}
                placeholder={`Option ${index + 1}`}
                className={inputClass}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() =>
                    setOptions((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  aria-label="Remove option"
                  className="rounded-lg px-2 py-1 text-admin-subtle hover:text-admin-danger"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setOptions((current) => [
                ...current,
                { label: '', isCorrect: false },
              ])
            }
            className="text-xs font-medium text-admin-accent-strong hover:text-admin-accent-strong"
          >
            + Add option
          </button>
          {kind === 'quiz' && (
            <p className="text-xs text-admin-subtle">
              Tick the correct answer(s). They stay hidden from the audience
              until you reveal them.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-admin-muted">
        {(kind === 'multipleChoice' || kind === 'quiz') && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={(event) => setAllowMultiple(event.target.checked)}
              className="h-4 w-4 accent-admin-accent-strong"
            />
            Allow multiple answers
          </label>
        )}

        {kind === 'rating' && (
          <label className="flex items-center gap-2">
            Scale
            <input
              type="number"
              min={2}
              max={10}
              value={maxRating}
              onChange={(event) => setMaxRating(Number(event.target.value))}
              className="w-16 rounded-lg border border-admin-control-border px-2 py-1"
            />
          </label>
        )}

        {kind === 'quiz' && (
          <label className="flex items-center gap-2">
            Time limit (s, 0 = none)
            <input
              type="number"
              min={0}
              max={300}
              value={timeLimitSeconds}
              onChange={(event) =>
                setTimeLimitSeconds(Number(event.target.value))
              }
              className="w-16 rounded-lg border border-admin-control-border px-2 py-1"
            />
          </label>
        )}

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showResults}
            onChange={(event) => setShowResults(event.target.checked)}
            className="h-4 w-4 accent-admin-accent-strong"
          />
          Show results on attendee devices
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allowChangeAnswer}
            onChange={(event) => setAllowChangeAnswer(event.target.checked)}
            className="h-4 w-4 accent-admin-accent-strong"
          />
          Let people change their answer
        </label>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2 text-sm text-admin-muted hover:text-admin-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit || busy}
          className="rounded-lg admin-primary px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Add {ACTIVITY_LABELS[kind].toLowerCase()}
        </button>
      </div>
    </form>
  );
}
