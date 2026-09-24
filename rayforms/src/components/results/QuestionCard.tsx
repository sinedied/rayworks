import type { FormField } from '../../../rayfin/data/FormField';
import {
  answeredCount,
  numberStats,
  tallyChoices,
  type ResponseRow,
} from '@/lib/results';

import { ChoiceChart } from './ChoiceChart';
import { NumberChart } from './NumberChart';
import { TextAnswers } from './TextAnswers';

const KIND_LABELS: Record<FormField['kind'], string> = {
  shortText: 'Short answer',
  longText: 'Paragraph',
  number: 'Number',
  rating: 'Rating',
  date: 'Date',
  singleChoice: 'Single choice',
  multiChoice: 'Multiple choice',
};

/** One question, visualised according to its kind, with a skipped count for context. */
export function QuestionCard({
  field,
  rows,
  index,
}: {
  field: FormField;
  rows: ResponseRow[];
  index: number;
}) {
  const answered = answeredCount(rows, field.id);
  const skipped = rows.length - answered;

  return (
    <section className="card relative min-w-0 bg-[var(--surface)] p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--surface-sunk)] text-xs font-medium text-[var(--text-muted)]"
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug">
            {field.label}
          </h3>
          <p className="label-caps mt-1">
            {KIND_LABELS[field.kind]} · {answered} answered
            {skipped > 0 && ` · ${skipped} skipped`}
            {field.isDeleted && ' · removed from form'}
          </p>
        </div>
      </div>

      <Visualisation field={field} rows={rows} />
    </section>
  );
}

function Visualisation({
  field,
  rows,
}: {
  field: FormField;
  rows: ResponseRow[];
}) {
  if (field.kind === 'singleChoice' || field.kind === 'multiChoice') {
    return (
      <ChoiceChart
        tallies={tallyChoices(rows, field)}
        variant={field.kind === 'singleChoice' ? 'donut' : 'bars'}
      />
    );
  }

  if (field.kind === 'number' || field.kind === 'rating') {
    const stats = numberStats(rows, field);
    return stats ? (
      <NumberChart stats={stats} />
    ) : (
      <p className="py-6 text-center text-sm text-[var(--text-muted)]">
        No numeric answers yet.
      </p>
    );
  }

  // Dates and free text both read best as the raw values.
  return <TextAnswers rows={rows} fieldId={field.id} />;
}
