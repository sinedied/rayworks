import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { answerValues, type ResponseRow } from '@/lib/results';

const PAGE = 5;

/** Free text can't be charted, so surface the answers themselves as quoted cards. */
export function TextAnswers({
  rows,
  fieldId,
}: {
  rows: ResponseRow[];
  fieldId: string;
}) {
  const [shown, setShown] = useState(PAGE);

  const answers = rows
    .map((row) => answerValues(row.answersByFieldId.get(fieldId)).join(' '))
    .filter((value) => value.trim().length > 0);

  if (answers.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--text-muted)]">
        No answers yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {answers.slice(0, shown).map((answer, index) => (
        <blockquote
          key={index}
          className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-sunk)] px-3 py-2 text-sm text-[var(--text)]"
        >
          {answer}
        </blockquote>
      ))}

      {answers.length > shown && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setShown((count) => count + PAGE)}
        >
          Show {Math.min(PAGE, answers.length - shown)} more
        </Button>
      )}
    </div>
  );
}
