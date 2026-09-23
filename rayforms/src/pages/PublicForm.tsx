import { CheckIcon } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { EmptyState } from '@/components/EmptyState';
import { PageShell } from '@/components/PageShell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { usePublicForm } from '@/hooks/usePublicForm';
import { parseStringArray as parseChoices } from '@/lib/choices';
import type { AnswerDraft } from '@/services/interfaces/IResponseService';
import { ServiceContainer } from '@/services/ServiceContainer';

type AnswerState = Record<string, string | string[]>;

/** The page a share-link recipient sees. Works fully anonymously. */
export function PublicForm() {
  const { token } = useParams<{ token: string }>();
  const { data, loading, notFound, error } = usePublicForm(token);
  const responseService = ServiceContainer.getInstance().responseService;

  const [answers, setAnswers] = useState<AnswerState>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setAnswer = (fieldId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  const toggleChoice = (fieldId: string, choice: string) => {
    const current = (answers[fieldId] as string[] | undefined) ?? [];
    setAnswer(
      fieldId,
      current.includes(choice)
        ? current.filter((c) => c !== choice)
        : [...current, choice]
    );
  };

  const handleSubmit = async () => {
    if (!data) {
      return;
    }

    for (const field of data.fields) {
      const value = answers[field.id];
      const empty =
        value === undefined ||
        (Array.isArray(value) ? value.length === 0 : !String(value).trim());
      if (field.required && empty) {
        setSubmitError(`"${field.label}" is required.`);
        return;
      }
    }

    setSubmitting(true);
    setSubmitError(null);

    const drafts: AnswerDraft[] = data.fields.map((field) => ({
      fieldId: field.id,
      fieldLabel: field.label,
      position: field.position,
      value: answers[field.id] ?? (field.kind === 'multiChoice' ? [] : ''),
    }));

    try {
      await responseService.submitResponse(
        { id: data.form.id, owner_id: data.form.owner_id },
        drafts
      );
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit response:', err);
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to submit response'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell width="narrow" showSignOut={false}>
      {loading && (
        <p className="text-sm text-[var(--text-muted)]">Loading form…</p>
      )}

      {notFound && (
        <EmptyState
          title="This form isn't available"
          description="The link may be incorrect, or the form has been closed."
        />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && submitted && (
        <div className="fade-in card px-6 py-14 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--success)] text-white">
            <CheckIcon className="h-5 w-5" />
          </span>
          <h1 className="font-heading mt-4 text-xl text-[var(--text)]">
            Thank you
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Your response to &ldquo;{data.form.title}&rdquo; has been recorded.
          </p>
        </div>
      )}

      {data && !submitted && data.form.isClosed && (
        <EmptyState
          title={`"${data.form.title}" is closed`}
          description="This form is no longer accepting responses."
        />
      )}

      {data && !submitted && !data.form.isClosed && (
        <>
          <header className="fade-in mb-6">
            <h1 className="font-heading text-2xl text-[var(--text)] sm:text-3xl">
              {data.form.title}
            </h1>
            {data.form.description && (
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                {data.form.description}
              </p>
            )}
          </header>

          {submitError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <div className="fade-in space-y-3">
            {data.fields.map((field, index) => {
              const choices = parseChoices(field.choices);
              const value = answers[field.id];

              return (
                <fieldset
                  key={field.id}
                  className="card p-4 sm:p-5"
                >
                  <legend className="sr-only">{field.label}</legend>

                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--surface-sunk)] text-xs font-medium text-[var(--text-muted)]"
                    >
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <Label
                        htmlFor={field.id}
                        className="block text-[15px] font-semibold leading-snug text-[var(--text)]"
                      >
                        {field.label}
                        {field.required && (
                          <span
                            aria-hidden
                            className="ml-1 text-[var(--action)]"
                          >
                            *
                          </span>
                        )}
                      </Label>
                      {field.helpText && (
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {field.helpText}
                        </p>
                      )}

                      <div className="mt-3">
                        {field.kind === 'longText' && (
                          <Textarea
                            id={field.id}
                            rows={4}
                            value={(value as string) ?? ''}
                            onChange={(e) =>
                              setAnswer(field.id, e.target.value)
                            }
                          />
                        )}

                        {(field.kind === 'shortText' ||
                          field.kind === 'number' ||
                          field.kind === 'date') && (
                          <Input
                            id={field.id}
                            type={
                              field.kind === 'number'
                                ? 'number'
                                : field.kind === 'date'
                                  ? 'date'
                                  : 'text'
                            }
                            value={(value as string) ?? ''}
                            onChange={(e) =>
                              setAnswer(field.id, e.target.value)
                            }
                          />
                        )}

                        {field.kind === 'singleChoice' && (
                          <RadioGroup
                            value={(value as string) ?? ''}
                            onValueChange={(next) => setAnswer(field.id, next)}
                            className="gap-1"
                          >
                            {choices.map((choice) => (
                              <label
                                key={choice}
                                className="flex cursor-pointer items-center gap-2.5 border border-transparent px-2 py-2 text-sm hover:border-[var(--border-subtle)] hover:bg-[var(--bg)]"
                              >
                                <RadioGroupItem
                                  value={choice}
                                  id={`${field.id}-${choice}`}
                                />
                                {choice}
                              </label>
                            ))}
                          </RadioGroup>
                        )}

                        {field.kind === 'multiChoice' && (
                          <div className="space-y-1">
                            {choices.map((choice) => (
                              <label
                                key={choice}
                                className="flex cursor-pointer items-center gap-2.5 border border-transparent px-2 py-2 text-sm hover:border-[var(--border-subtle)] hover:bg-[var(--bg)]"
                              >
                                <Checkbox
                                  checked={(
                                    (value as string[] | undefined) ?? []
                                  ).includes(choice)}
                                  onCheckedChange={() =>
                                    toggleChoice(field.id, choice)
                                  }
                                />
                                {choice}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </fieldset>
              );
            })}
          </div>

          <Button
            className="mt-6 h-11 w-full text-base"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : 'Submit response'}
          </Button>

          <p className="mt-3 text-center text-xs text-[var(--text-subtle)]">
            No account needed to respond
          </p>
        </>
      )}
    </PageShell>
  );
}
