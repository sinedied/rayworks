import { ChevronDownIcon, DownloadIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

import type { FormField } from '../../../rayfin/data/FormField';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { downloadCsv, toCsv } from '@/lib/csv';
import { answerValues, type ResponseRow } from '@/lib/results';
import { cn } from '@/lib/utils';

interface Props {
  rows: ResponseRow[];
  fields: FormField[];
  formTitle: string;
  onDelete: (responseId: string) => void;
}

function cellText(row: ResponseRow, fieldId: string): string {
  const values = answerValues(row.answersByFieldId.get(fieldId));
  return values.length > 0 ? values.join(', ') : '—';
}

/**
 * The raw data, collapsed by default so the dashboard leads. On small screens the table
 * becomes stacked cards, which avoids the horizontal scrolling a wide table forces.
 */
export function RawResponsesTable({
  rows,
  fields,
  formTitle,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);

  const exportCsv = () => {
    const slug = formTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'form';
    downloadCsv(`${slug}-responses.csv`, toCsv(rows, fields));
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="card">
        <div className="flex items-center justify-between gap-3 p-4">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 items-center gap-2 text-left"
            >
              <ChevronDownIcon
                className={cn(
                  'h-4 w-4 shrink-0 transition-transform',
                  open && 'rotate-180'
                )}
              />
              <span className="font-heading text-base text-[var(--text)]">Raw responses</span>
              <span className="font-data text-xs text-[var(--text-subtle)]">
                ({rows.length})
              </span>
            </button>
          </CollapsibleTrigger>

          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            <DownloadIcon className="h-3.5 w-3.5 sm:mr-2" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>

        <CollapsibleContent>
          {rows.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-[var(--text-muted)]">
              No responses match the current filters.
            </p>
          ) : (
            <>
              {/* Desktop: contained scroll with a sticky header and first column. */}
              <div className="hidden max-h-[60vh] overflow-auto border-t border-[var(--border-subtle)] md:block">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-[var(--surface-sunk)]">
                    <tr>
                      <th className="sticky left-0 z-20 whitespace-nowrap border-b border-r border-[var(--border-subtle)] bg-[var(--surface-sunk)] px-3 py-2 text-left font-medium">
                        Submitted
                      </th>
                      <th className="whitespace-nowrap border-b border-[var(--border-subtle)] px-3 py-2 text-left font-medium">
                        Respondent
                      </th>
                      {fields.map((field) => (
                        <th
                          key={field.id}
                          className="min-w-[160px] border-b border-[var(--border-subtle)] px-3 py-2 text-left font-medium"
                        >
                          {field.label}
                        </th>
                      ))}
                      <th className="border-b border-[var(--border-subtle)] px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ response, answersByFieldId }) => (
                      <tr key={response.id} className="hover:bg-[var(--surface-sunk)]">
                        <td className="font-data sticky left-0 z-10 whitespace-nowrap border-b border-r border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-xs">
                          {new Date(response.submittedAt).toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap border-b border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-muted)]">
                          {response.respondentEmail ?? 'Anonymous'}
                        </td>
                        {fields.map((field) => (
                          <td
                            key={field.id}
                            className="border-b border-[var(--border-subtle)] px-3 py-2 align-top"
                          >
                            {cellText({ response, answersByFieldId }, field.id)}
                          </td>
                        ))}
                        <td className="border-b border-[var(--border-subtle)] px-2 py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="Delete response"
                            onClick={() => onDelete(response.id)}
                          >
                            <Trash2Icon className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: one card per response instead of a scrolling table. */}
              <ul className="space-y-3 border-t border-[var(--border-subtle)] p-4 md:hidden">
                {rows.map(({ response, answersByFieldId }) => (
                  <li
                    key={response.id}
                    className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-sunk)] p-3"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-data text-xs">
                          {new Date(response.submittedAt).toLocaleString()}
                        </p>
                        <p className="truncate text-xs text-[var(--text-muted)]">
                          {response.respondentEmail ?? 'Anonymous'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label="Delete response"
                        onClick={() => onDelete(response.id)}
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <dl className="space-y-1.5">
                      {fields.map((field) => (
                        <div key={field.id}>
                          <dt className="label-caps">
                            {field.label}
                          </dt>
                          <dd className="text-sm">
                            {cellText({ response, answersByFieldId }, field.id)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
