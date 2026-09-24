import { ArrowLeftIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/EmptyState';
import { PageShell, PageTitle } from '@/components/PageShell';
import { QuestionCard } from '@/components/results/QuestionCard';
import { RawResponsesTable } from '@/components/results/RawResponsesTable';
import { ResultsFilters } from '@/components/results/ResultsFilters';
import { VolumeChart } from '@/components/results/VolumeChart';
import { ShareLinkButton } from '@/components/ShareLinkButton';
import { StatCard } from '@/components/StatCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useFormResults } from '@/hooks/useFormResults';
import {
  applyFilters,
  emptyFilters,
  formStats,
  hasActiveFilters,
  relativeTime,
  volumeByDay,
  type ResultsFilters as Filters,
} from '@/lib/results';

export function FormResults() {
  const { id } = useParams<{ id: string }>();
  const { form, rows, loading, error, deleteResponse } = useFormResults(id);
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const fields = useMemo(() => form?.fields ?? [], [form]);
  const filtered = useMemo(
    () => applyFilters(rows, filters),
    [rows, filters]
  );
  const stats = useMemo(
    () => formStats(filtered, fields),
    [filtered, fields]
  );
  const volume = useMemo(() => volumeByDay(filtered), [filtered]);

  const backButton = (
    <Button asChild variant="ghost" size="sm" >
      <Link to="/">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />
        All forms
      </Link>
    </Button>
  );

  if (loading) {
    return (
      <PageShell width="wide">
        <p className="text-sm text-[var(--text-muted)]">Loading results…</p>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell width="wide">
        {backButton}
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  if (!form) {
    return (
      <PageShell width="wide">
        {backButton}
        <div className="mt-6">
          <EmptyState
            title="Form not found"
            description="It may have been deleted, or you may not have access to it."
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <div className="mb-4">{backButton}</div>

      <PageTitle
        eyebrow="Results"
        title={form.form.title}
        description={form.form.description}
        actions={<ShareLinkButton shareToken={form.form.shareToken} formTitle={form.form.title} />}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No responses yet"
          description="Share the link and answers will appear here as they arrive."
          action={<ShareLinkButton shareToken={form.form.shareToken} formTitle={form.form.title} />}
        />
      ) : (
        <div className="space-y-6">
          <section className="fade-in grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Responses" value={stats.total} />
            <StatCard label="Questions" value={stats.questions} />
            <StatCard
              label="Completion"
              value={`${stats.completionRate}%`}
              hint="Mean answered per response"
            />
            <StatCard
              label="Last response"
              value={
                <span className="text-2xl">
                  {relativeTime(stats.lastSubmittedAt)}
                </span>
              }
            />
          </section>

          <section className="fade-in">
            <ResultsFilters
              fields={fields}
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters(emptyFilters)}
            />
          </section>

          {filtered.length === 0 ? (
            <EmptyState
              title="No responses match"
              description="Try widening the date range or clearing a filter."
              action={
                <Button
                  variant="outline"
                  
                  onClick={() => setFilters(emptyFilters)}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              {volume.length > 1 && (
                <section className="fade-in card min-w-0 bg-[var(--surface)] p-4 sm:p-5">
                  <h2 className="font-heading mb-3 text-xl">Responses over time</h2>
                  <VolumeChart points={volume} />
                </section>
              )}

              <section className="fade-in grid gap-4 lg:grid-cols-2">
                {fields.map((field, index) => (
                  <QuestionCard
                    key={field.id}
                    field={field}
                    rows={filtered}
                    index={index}
                  />
                ))}
              </section>
            </>
          )}

          <section className="fade-in">
            <RawResponsesTable
              rows={filtered}
              fields={fields}
              formTitle={form.form.title}
              onDelete={(responseId) => {
                if (window.confirm('Delete this response?')) {
                  deleteResponse(responseId);
                }
              }}
            />
            {hasActiveFilters(filters) && (
              <p className="font-data mt-2 text-[11px] text-[var(--text-subtle)]">
                Showing {filtered.length} of {rows.length} responses · export
                honours active filters
              </p>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}
