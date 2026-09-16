import type { FormField } from '../../rayfin/data/FormField';

import { answerValues, type ResponseRow } from './results';

/**
 * Quotes a CSV cell. Fields containing a delimiter, quote, or newline must be wrapped and
 * have their quotes doubled, otherwise the row structure breaks in Excel.
 */
function escapeCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: ResponseRow[], fields: FormField[]): string {
  const header = ['Submitted', 'Respondent', ...fields.map((f) => f.label)];

  const body = rows.map((row) => {
    const submitted = new Date(row.response.submittedAt);
    return [
      Number.isNaN(submitted.getTime()) ? '' : submitted.toISOString(),
      row.response.respondentEmail ?? 'Anonymous',
      ...fields.map((field) =>
        answerValues(row.answersByFieldId.get(field.id)).join('; ')
      ),
    ];
  });

  return [header, ...body]
    .map((line) => line.map((cell) => escapeCell(cell ?? '')).join(','))
    .join('\r\n');
}

export function downloadCsv(filename: string, contents: string): void {
  // Excel needs a BOM to read UTF-8 accented characters correctly.
  const blob = new Blob([`\uFEFF${contents}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
