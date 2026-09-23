import { SearchIcon, XIcon } from 'lucide-react';

import type { FormField } from '../../../rayfin/data/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseStringArray } from '@/lib/choices';
import { hasActiveFilters, type ResultsFilters } from '@/lib/results';
import { cn } from '@/lib/utils';

const RANGES = [
  { label: 'All time', days: null },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
] as const;

interface Props {
  fields: FormField[];
  filters: ResultsFilters;
  onChange: (filters: ResultsFilters) => void;
  onReset: () => void;
}

/** Filters drive the charts and the raw table alike, so results always agree. */
export function ResultsFilters({ fields, filters, onChange, onReset }: Props) {
  const choiceFields = fields.filter(
    (field) => field.kind === 'singleChoice' || field.kind === 'multiChoice'
  );

  const toggleChoice = (fieldId: string, choice: string) => {
    const selected = filters.choices[fieldId] ?? [];
    const next = selected.includes(choice)
      ? selected.filter((value) => value !== choice)
      : [...selected, choice];

    onChange({
      ...filters,
      choices: { ...filters.choices, [fieldId]: next },
    });
  };

  return (
    <div className="card space-y-4 bg-[var(--surface)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
          <Input
            value={filters.search}
            placeholder="Search answers"
            className="pl-9"
            onChange={(event) =>
              onChange({ ...filters, search: event.target.value })
            }
          />
        </div>

        <div className="flex gap-1">
          {RANGES.map((range) => (
            <Button
              key={range.label}
              size="sm"
              variant={filters.days === range.days ? 'default' : 'outline'}
              className="flex-1 sm:flex-none"
              onClick={() => onChange({ ...filters, days: range.days })}
            >
              {range.label}
            </Button>
          ))}
        </div>
      </div>

      {choiceFields.length > 0 && (
        <div className="space-y-3">
          {choiceFields.map((field) => {
            const selected = filters.choices[field.id] ?? [];
            return (
              <div key={field.id}>
                <p className="label-caps mb-1.5">
                  {field.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {parseStringArray(field.choices).map((choice) => {
                    const active = selected.includes(choice);
                    return (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => toggleChoice(field.id, choice)}
                        aria-pressed={active}
                        className={cn(
                          'min-h-9 rounded-lg border px-3 py-1 text-sm transition-colors max-sm:min-h-11 coarse:min-h-11',
                          active
                            ? 'border-[var(--action)] bg-[var(--action)] text-white'
                            : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]'
                        )}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasActiveFilters(filters) && (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={onReset}
        >
          <XIcon className="mr-1.5 h-3.5 w-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
