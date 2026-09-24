import type { Answer } from '../../rayfin/data/Answer';
import type { FormField, FormFieldKind } from '../../rayfin/data/FormField';
import type { FormResponse } from '../../rayfin/data/FormResponse';

import { parseStringArray } from './choices';

export interface ResponseRow {
  response: FormResponse;
  answersByFieldId: Map<string, Answer>;
}

export interface ResultsFilters {
  /** Free-text search across every answer value. */
  search: string;
  /** fieldId -> selected choice values; a row matches if it holds any selected choice. */
  choices: Record<string, string[]>;
  /** Only keep responses submitted within this many days. `null` means no limit. */
  days: number | null;
}

export const emptyFilters: ResultsFilters = {
  search: '',
  choices: {},
  days: null,
};

/** Answers hold a raw string; choice kinds encode a JSON array. Normalise both to a list. */
export function answerValues(answer: Answer | undefined): string[] {
  if (!answer?.value) {
    return [];
  }
  const parsed = parseStringArray(answer.value);
  return parsed.length > 0 ? parsed : [answer.value];
}

export function isAnswered(answer: Answer | undefined): boolean {
  return answerValues(answer).some((value) => value.trim().length > 0);
}

export function isChartableKind(kind: FormFieldKind): boolean {
  return kind !== 'shortText' && kind !== 'longText';
}

export function hasActiveFilters(filters: ResultsFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.days !== null ||
    Object.values(filters.choices).some((values) => values.length > 0)
  );
}

export function applyFilters(
  rows: ResponseRow[],
  filters: ResultsFilters
): ResponseRow[] {
  const search = filters.search.trim().toLowerCase();
  const cutoff =
    filters.days === null
      ? null
      : Date.now() - filters.days * 24 * 60 * 60 * 1000;

  return rows.filter((row) => {
    if (cutoff !== null) {
      const submitted = new Date(row.response.submittedAt).getTime();
      if (Number.isNaN(submitted) || submitted < cutoff) {
        return false;
      }
    }

    if (search) {
      const haystack = [...row.answersByFieldId.values()]
        .flatMap((answer) => answerValues(answer))
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    for (const [fieldId, selected] of Object.entries(filters.choices)) {
      if (selected.length === 0) {
        continue;
      }
      const values = answerValues(row.answersByFieldId.get(fieldId));
      if (!selected.some((choice) => values.includes(choice))) {
        return false;
      }
    }

    return true;
  });
}

export interface ChoiceTally {
  label: string;
  count: number;
  percent: number;
}

/**
 * Counts each choice. Multi-choice answers contribute once per selected option, so
 * percentages are relative to the number of respondents who answered, not to the tally sum.
 */
export function tallyChoices(
  rows: ResponseRow[],
  field: FormField
): ChoiceTally[] {
  const declared = parseStringArray(field.choices);
  const counts = new Map<string, number>(
    declared.map((choice) => [choice, 0])
  );
  let answered = 0;

  for (const row of rows) {
    const values = answerValues(row.answersByFieldId.get(field.id)).filter(
      (value) => value.trim().length > 0
    );
    if (values.length === 0) {
      continue;
    }
    answered += 1;
    for (const value of values) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      percent: answered === 0 ? 0 : Math.round((count / answered) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

export interface NumberStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  buckets: { label: string; count: number }[];
}

export function numberStats(
  rows: ResponseRow[],
  field: FormField,
  bucketCount = 8
): NumberStats | null {
  const values = rows
    .flatMap((row) => answerValues(row.answersByFieldId.get(field.id)))
    .filter((value) => value.trim().length > 0)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (values.length === 0) {
    return null;
  }

  const min = values[0];
  const max = values[values.length - 1];
  const sum = values.reduce((total, value) => total + value, 0);
  const mid = Math.floor(values.length / 2);
  const median =
    values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];

  // A single distinct value has no range to bucket; show it as one bar.
  if (min === max) {
    return {
      count: values.length,
      min,
      max,
      mean: sum / values.length,
      median,
      buckets: [{ label: format(min), count: values.length }],
    };
  }

  const size = (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    label: `${format(min + index * size)}–${format(min + (index + 1) * size)}`,
    count: 0,
  }));

  for (const value of values) {
    const index = Math.min(
      bucketCount - 1,
      Math.floor((value - min) / size)
    );
    buckets[index].count += 1;
  }

  return {
    count: values.length,
    min,
    max,
    mean: sum / values.length,
    median,
    buckets,
  };
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export interface VolumePoint {
  date: string;
  label: string;
  count: number;
}

/** Responses per day, gap-filled so the trend line has no holes. */
export function volumeByDay(rows: ResponseRow[]): VolumePoint[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const date = new Date(row.response.submittedAt);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    const key = date.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return [];
  }

  const keys = [...counts.keys()].sort();
  const start = new Date(`${keys[0]}T00:00:00Z`);
  const end = new Date(`${keys[keys.length - 1]}T00:00:00Z`);
  const points: VolumePoint[] = [];

  for (let d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    points.push({
      date: key,
      label: new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      count: counts.get(key) ?? 0,
    });
  }

  return points;
}

export interface FormStats {
  total: number;
  questions: number;
  lastSubmittedAt: Date | null;
  /** Mean share of questions answered per response, 0-100. */
  completionRate: number;
}

export function formStats(
  rows: ResponseRow[],
  fields: FormField[]
): FormStats {
  const questions = fields.length;
  let answeredTotal = 0;
  let last: Date | null = null;

  for (const row of rows) {
    for (const field of fields) {
      if (isAnswered(row.answersByFieldId.get(field.id))) {
        answeredTotal += 1;
      }
    }
    const submitted = new Date(row.response.submittedAt);
    if (!Number.isNaN(submitted.getTime()) && (!last || submitted > last)) {
      last = submitted;
    }
  }

  const denominator = rows.length * questions;

  return {
    total: rows.length,
    questions,
    lastSubmittedAt: last,
    completionRate:
      denominator === 0 ? 0 : Math.round((answeredTotal / denominator) * 100),
  };
}

export function answeredCount(
  rows: ResponseRow[],
  fieldId: string
): number {
  return rows.filter((row) => isAnswered(row.answersByFieldId.get(fieldId)))
    .length;
}

export function relativeTime(date: Date | null): string {
  if (!date) {
    return '—';
  }

  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return date.toLocaleDateString();
}
