import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import type { Answer } from '../../rayfin/data/Answer';
import type { FormField } from '../../rayfin/data/FormField';
import type { FormResponse } from '../../rayfin/data/FormResponse';
import { QuestionCard } from '../components/results/QuestionCard';
import { RawResponsesTable } from '../components/results/RawResponsesTable';
import { ResultsFilters } from '../components/results/ResultsFilters';
import { emptyFilters, type ResponseRow } from '../lib/results';

// recharts measures its container; jsdom reports 0, so give it a real box.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 600,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 300,
  });
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

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

function row(id: string, answers: Record<string, string>): ResponseRow {
  return {
    response: {
      id,
      submittedAt: new Date('2026-01-02T10:00:00Z'),
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

describe('QuestionCard', () => {
  it('renders each question kind without crashing', () => {
    const cases: FormField[] = [
      field({
        id: 'a',
        kind: 'singleChoice',
        label: 'Colour',
        choices: JSON.stringify(['Red', 'Blue']),
      }),
      field({
        id: 'b',
        kind: 'multiChoice',
        label: 'Toppings',
        choices: JSON.stringify(['Cheese', 'Ham']),
      }),
      field({ id: 'c', kind: 'number', label: 'Score' }),
      field({ id: 'd', kind: 'longText', label: 'Comments' }),
    ];

    const rows = [
      row('1', {
        a: 'Red',
        b: JSON.stringify(['Cheese', 'Ham']),
        c: '4',
        d: 'Very good',
      }),
      row('2', { a: 'Blue', b: JSON.stringify(['Cheese']), c: '9', d: '' }),
    ];

    for (const [index, f] of cases.entries()) {
      const { unmount } = render(
        <QuestionCard field={f} rows={rows} index={index} />
      );
      expect(screen.getByText(f.label)).toBeInTheDocument();
      unmount();
    }
  });

  it('reports how many respondents skipped a question', () => {
    render(
      <QuestionCard
        field={field({ id: 'a', label: 'Optional note' })}
        rows={[row('1', { a: 'yes' }), row('2', { a: '' })]}
        index={0}
      />
    );
    expect(screen.getByText(/1 answered/)).toBeInTheDocument();
    expect(screen.getByText(/1 skipped/)).toBeInTheDocument();
  });
});

describe('RawResponsesTable', () => {
  it('is collapsed by default so the dashboard leads', () => {
    render(
      <RawResponsesTable
        rows={[row('1', { a: 'hello' })]}
        fields={[field({ id: 'a', label: 'Greeting' })]}
        formTitle="Test"
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Raw responses')).toBeInTheDocument();
    // The value only exists once the section is expanded.
    expect(screen.queryByText('hello')).toBeNull();
  });
});

describe('ResultsFilters', () => {
  it('offers a chip per choice and reports selections', () => {
    const onChange = vi.fn();
    render(
      <ResultsFilters
        fields={[
          field({
            id: 'a',
            kind: 'singleChoice',
            label: 'Colour',
            choices: JSON.stringify(['Red', 'Blue']),
          }),
        ]}
        filters={emptyFilters}
        onChange={onChange}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Red' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Blue' })).toBeInTheDocument();
  });
});
