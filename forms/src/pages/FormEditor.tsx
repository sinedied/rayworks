import { ArrowLeftIcon, PlusIcon, SaveIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { FieldEditor, isChoiceKind } from '@/components/FieldEditor';
import { PageShell, PageTitle } from '@/components/PageShell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseStringArray } from '@/lib/choices';
import type { FormFieldDraft } from '@/services/interfaces/IFormService';
import { ServiceContainer } from '@/services/ServiceContainer';

function blankField(): FormFieldDraft {
  return {
    label: '',
    helpText: '',
    kind: 'shortText',
    choices: [],
    required: false,
  };
}

/** Creates a new form, or edits an existing one when `:id` is present. */
export function FormEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const formService = ServiceContainer.getInstance().formService;
  const isEdit = Boolean(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FormFieldDraft[]>([blankField()]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await formService.getFormById(id);
        if (cancelled || !result) {
          if (!cancelled) {
            setError('Form not found.');
          }
          return;
        }

        setTitle(result.form.title);
        setDescription(result.form.description ?? '');
        setFields(
          result.fields.length
            ? result.fields.map((field) => ({
                id: field.id,
                label: field.label,
                helpText: field.helpText ?? '',
                kind: field.kind,
                choices: parseStringArray(field.choices),
                required: field.required,
              }))
            : [blankField()]
        );
      } catch (err) {
        console.error('Failed to load form:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load form');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, formService]);

  const updateField = (index: number, patch: Partial<FormFieldDraft>) => {
    setFields((prev) =>
      prev.map((field, i) => (i === index ? { ...field, ...patch } : field))
    );
  };

  const moveField = (index: number, direction: -1 | 1) => {
    setFields((prev) => {
      const next = [...prev];
      const target = index + direction;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const validate = (): string | null => {
    if (!title.trim()) {
      return 'Give your form a title.';
    }
    if (fields.length === 0) {
      return 'Add at least one question.';
    }
    for (const [index, field] of fields.entries()) {
      if (!field.label.trim()) {
        return `Question ${index + 1} needs a label.`;
      }
      if (
        isChoiceKind(field.kind) &&
        field.choices.filter((choice) => choice.trim()).length === 0
      ) {
        return `Question ${index + 1} needs at least one choice.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      fields: fields.map((field) => ({
        ...field,
        label: field.label.trim(),
        helpText: field.helpText?.trim() || undefined,
        choices: isChoiceKind(field.kind)
          ? field.choices.map((c) => c.trim()).filter(Boolean)
          : [],
      })),
    };

    try {
      if (id) {
        await formService.updateForm(id, payload);
      } else {
        await formService.createForm(payload);
      }
      navigate('/');
    } catch (err) {
      console.error('Failed to save form:', err);
      setError(err instanceof Error ? err.message : 'Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell width="regular">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/">
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          All forms
        </Link>
      </Button>

      <PageTitle
        eyebrow={isEdit ? 'Revise' : 'Compose'}
        title={isEdit ? 'Edit form' : 'New form'}
      />

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading form…</p>
      ) : (
        <div className="fade-in">
          <div className="card mb-6 space-y-4 bg-[var(--surface)] p-4 sm:p-5">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                placeholder="Team offsite survey"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                placeholder="Tell respondents what this form is about."
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <FieldEditor
                key={field.id ?? index}
                field={field}
                index={index}
                total={fields.length}
                onChange={(patch) => updateField(index, patch)}
                onRemove={() =>
                  setFields((prev) => prev.filter((_, i) => i !== index))
                }
                onMove={(direction) => moveField(index, direction)}
              />
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              
              onClick={() => setFields((prev) => [...prev, blankField()])}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Add question
            </Button>

            <Button
             
              onClick={handleSave}
              disabled={saving}
            >
              <SaveIcon className="mr-2 h-4 w-4" />
              {saving ? 'Saving…' : 'Save form'}
            </Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
