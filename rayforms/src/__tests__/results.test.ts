import { describe, it, expect } from 'vitest';

import type { Answer } from '../../rayfin/data/Answer';
import type { FormField } from '../../rayfin/data/FormField';
import type { FormResponse } from '../../rayfin/data/FormResponse';
import { toCsv } from '../lib/csv';
import {
  applyFilters,
  emptyFilters,
  formStats,
  numberStats,
  tallyChoices,
  volumeByDay,
  type ResponseRow,
} from '../lib/results';

function field(overrides: Partial<FormField> & { id: string }): FormField {
  return {
    label: 'Question',
    kind: 'shortText',
    required: false,
    isDeleted: false,
    isClosed: false,
    position: 0,
    form_id: 'form-1',
    owner_id: 'owner-1',
    ...overrides,
  } as FormField;
}

function row(
  id: string,
  submittedAt: string,
  answers: Record<string, string>
): ResponseRow {
  return {
    response: {
      id,
      submittedAt: new Date(submittedAt),
      form_id: 'form-1',
      owner_id: 'owner-1',
    } as FormResponse,
    answersByFieldId: new Map(
      Object.entries(answers).map(([fieldId, value]) => [
        fieldId,
        { id: `${id}-${fieldId}`, value, field_id: fieldId } as Answer,
      ])
    ),
  };
}

describe('tallyChoices', () => {
  const colour = field({
    id: 'c',
    kind: 'singleChoice',
    choices: JSON.stringify(['Red', 'Blue', 'Green']),
  });

  it('counts each choice and ranks by frequency', () => {
    const tallies = tallyChoices(
      [
        row('1', '2026-01-01', { c: 'Red' }),
        row('2', '2026-01-01', { c: 'Blue' }),
        row('3', '2026-01-01', { c: 'Red' }),
      ],
      colour
    );

    expect(tallies[0]).toMatchObject({ label: 'Red', count: 2, percent: 67 });
    expect(tallies.find((t) => t.label === 'Green')).toMatchObject({
      count: 0,
    });
  });

  it('counts every selection of a multi-choice answer', () => {
    const multi = field({
      id: 'm',
      kind: 'multiChoice',
      choices: JSON.stringify(['A', 'B']),
    });
    const tallies = tallyChoices(
      [row('1', '2026-01-01', { m: JSON.stringify(['A', 'B']) })],
      multi
    );

    // One respondent picked both, so each option is at 100% of respondents.
    expect(tallies).toEqual([
      { label: 'A', count: 1, percent: 100 },
      { label: 'B', count: 1, percent: 100 },
    ]);
  });
});

describe('numberStats', () => {
  const score = field({ id: 'n', kind: 'number' });

  it('computes the five-number summary', () => {
    const stats = numberStats(
      [
        row('1', '2026-01-01', { n: '1' }),
        row('2', '2026-01-01', { n: '3' }),
        row('3', '2026-01-01', { n: '5' }),
        row('4', '2026-01-01', { n: '11' }),
      ],
      score
    );

    expect(stats).toMatchObject({ count: 4, min: 1, max: 11, median: 4 });
    expect(stats?.mean).toBe(5);
  });

  it('handles a single repeated value without dividing by a zero range', () => {
    const stats = numberStats(
      [row('1', '2026-01-01', { n: '7' }), row('2', '2026-01-01', { n: '7' })],
      score
    );
    expect(stats?.buckets).toEqual([{ label: '7', count: 2 }]);
  });

  it('returns null when nothing numeric was answered', () => {
    expect(numberStats([row('1', '2026-01-01', { n: '' })], score)).toBeNull();
  });

  it('aggregates ratings without counting skips or dropping historical values', () => {
    const rating = field({ id: 'r', kind: 'rating', numericSettings: '{"min":1,"max":5,"interval":1}' });
    const rows = [
      row('1', '2026-01-01', { r: '1' }),
      row('2', '2026-01-01', { r: '5' }),
      row('3', '2026-01-01', { r: '9' }),
      row('4', '2026-01-01', { r: '' }),
      row('5', '2026-01-01', { r: ' ' }),
      row('6', '2026-01-01', { r: 'bad' }),
    ];
    expect(numberStats(rows, rating)).toMatchObject({ count: 3, min: 1, max: 9, mean: 5 });
    expect(toCsv(rows.slice(0, 1), [rating])).toContain(',Anonymous,1');
  });
});

describe('applyFilters', () => {
  const rows = [
    row('1', '2026-01-01', { c: 'Red', t: 'loved it' }),
    row('2', '2026-01-02', { c: 'Blue', t: 'not for me' }),
  ];

  it('matches answer text case-insensitively', () => {
    const result = applyFilters(rows, { ...emptyFilters, search: 'LOVED' });
    expect(result.map((r) => r.response.id)).toEqual(['1']);
  });

  it('keeps rows holding any selected choice', () => {
    const result = applyFilters(rows, {
      ...emptyFilters,
      choices: { c: ['Blue'] },
    });
    expect(result.map((r) => r.response.id)).toEqual(['2']);
  });

  it('ignores a choice filter with nothing selected', () => {
    expect(
      applyFilters(rows, { ...emptyFilters, choices: { c: [] } })
    ).toHaveLength(2);
  });
});

describe('volumeByDay', () => {
  it('fills gaps so quiet days read as zero', () => {
    const points = volumeByDay([
      row('1', '2026-01-01T10:00:00Z', {}),
      row('2', '2026-01-03T10:00:00Z', {}),
    ]);

    expect(points.map((p) => p.count)).toEqual([1, 0, 1]);
  });
});

describe('formStats', () => {
  it('reports completion as the mean share of answered questions', () => {
    const fields = [field({ id: 'a' }), field({ id: 'b' })];
    const stats = formStats(
      [
        row('1', '2026-01-01', { a: 'x', b: 'y' }),
        row('2', '2026-01-02', { a: 'x', b: '' }),
      ],
      fields
    );

    expect(stats).toMatchObject({ total: 2, questions: 2, completionRate: 75 });
  });
});

describe('toCsv', () => {
  it('escapes quotes, commas, and newlines', () => {
    const csv = toCsv(
      [row('1', '2026-01-01T00:00:00Z', { a: 'say "hi", please' })],
      [field({ id: 'a', label: 'Note' })]
    );

    expect(csv.split('\r\n')[0]).toBe('Submitted,Respondent,Note');
    expect(csv).toContain('"say ""hi"", please"');
  });

  it('labels rows without an email as anonymous', () => {
    const csv = toCsv(
      [row('1', '2026-01-01T00:00:00Z', { a: 'x' })],
      [field({ id: 'a', label: 'Note' })]
    );
    expect(csv).toContain('Anonymous');
  });
});
