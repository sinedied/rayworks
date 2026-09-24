import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { defaultRatingSettings } from '@/lib/numericFields';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FormFieldKind } from '../../rayfin/data/FormField';
import type { FormFieldDraft } from '../services/interfaces/IFormService';

const KIND_LABELS: Record<FormFieldKind, string> = {
  shortText: 'Short answer',
  longText: 'Paragraph',
  number: 'Number',
  rating: 'Rating',
  date: 'Date',
  singleChoice: 'Single choice',
  multiChoice: 'Multiple choice',
};

export function isChoiceKind(kind: FormFieldKind): boolean {
  return kind === 'singleChoice' || kind === 'multiChoice';
}

interface FieldEditorProps {
  field: FormFieldDraft;
  index: number;
  total: number;
  onChange: (patch: Partial<FormFieldDraft>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

/** Editor for a single question. Stacks to one column below `sm`. */
export function FieldEditor({
  field,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: FieldEditorProps) {
  const choiceKind = isChoiceKind(field.kind);

  const updateChoice = (choiceIndex: number, value: string) => {
    const choices = [...field.choices];
    choices[choiceIndex] = value;
    onChange({ choices });
  };

  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded bg-[var(--surface-sunk)] text-xs font-medium text-[var(--text-muted)]"
        >
          {index + 1}
        </span>

        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={index === 0}
            aria-label="Move question up"
            onClick={() => onMove(-1)}
          >
            <ChevronUpIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={index === total - 1}
            aria-label="Move question down"
            onClick={() => onMove(1)}
          >
            <ChevronDownIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Delete question"
            onClick={onRemove}
          >
            <Trash2Icon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor={`label-${index}`}>Question</Label>
            <Input
              id={`label-${index}`}
              value={field.label}
              placeholder="What would you like to ask?"
              onChange={(e) => onChange({ label: e.target.value })}
            />
          </div>
          <div className="w-full space-y-1.5 sm:w-48">
            <Label htmlFor={`kind-${index}`}>Type</Label>
            <Select
              value={field.kind}
              onValueChange={(kind) =>
                onChange({
                  kind: kind as FormFieldKind,
                  numericSettings: kind === 'rating' ? defaultRatingSettings() : undefined,
                  choices: isChoiceKind(kind as FormFieldKind)
                    ? field.choices.length
                      ? field.choices
                      : ['Option 1']
                    : [],
                })
              }
            >
              <SelectTrigger id={`kind-${index}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`help-${index}`}>Help text (optional)</Label>
          <Input
            id={`help-${index}`}
            value={field.helpText ?? ''}
            placeholder="Extra guidance shown under the question"
            onChange={(e) => onChange({ helpText: e.target.value })}
          />
        </div>

        {(field.kind === 'number' || field.kind === 'rating') && (
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              ['min', 'Minimum'],
              ['max', 'Maximum'],
              ...(field.kind === 'rating' ? [['interval', 'Interval'] as const] : []),
            ] as const).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`${key}-${index}`}>
                  {label}{field.kind === 'number' && ' (optional)'}
                </Label>
                <Input
                  id={`${key}-${index}`}
                  type="number"
                  step={field.kind === 'rating' ? 1 : 'any'}
                  min={key === 'interval' ? 1 : undefined}
                  value={Number.isFinite(field.numericSettings?.[key])
                    ? field.numericSettings?.[key] : ''}
                  onInput={(e) => {
                    if (e.currentTarget.validity.badInput) {
                      onChange({ numericSettings: { ...field.numericSettings, [key]: NaN } });
                    }
                  }}
                  onChange={(e) => onChange({
                    numericSettings: {
                      ...field.numericSettings,
                      [key]: e.target.value === '' && !e.target.validity.badInput
                        ? undefined : e.target.valueAsNumber,
                    },
                  })}
                />
              </div>
            ))}
          </div>
        )}

        {field.kind === 'rating' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(['min', 'max'] as const).map((endpoint) => {
              const key = endpoint === 'min' ? 'minLabel' : 'maxLabel';
              return (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`${key}-${index}`}>
                    {endpoint === 'min' ? 'Minimum' : 'Maximum'} help text (optional)
                  </Label>
                  <Input
                    id={`${key}-${index}`}
                    value={field.numericSettings?.[key] ?? ''}
                    maxLength={500}
                    placeholder={endpoint === 'min' ? 'Not useful' : 'Extremely useful'}
                    onChange={(e) => onChange({
                      numericSettings: { ...field.numericSettings, [key]: e.target.value },
                    })}
                  />
                </div>
              );
            })}
          </div>
        )}

        {choiceKind && (
          <div className="space-y-2">
            <Label>Choices</Label>
            {field.choices.map((choice, choiceIndex) => (
              <div key={choiceIndex} className="flex items-center gap-2">
                <Input
                  value={choice}
                  placeholder={`Option ${choiceIndex + 1}`}
                  onChange={(e) => updateChoice(choiceIndex, e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label={`Remove option ${choiceIndex + 1}`}
                  disabled={field.choices.length <= 1}
                  onClick={() =>
                    onChange({
                      choices: field.choices.filter(
                        (_, i) => i !== choiceIndex
                      ),
                    })
                  }
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              
              onClick={() =>
                onChange({
                  choices: [
                    ...field.choices,
                    `Option ${field.choices.length + 1}`,
                  ],
                })
              }
            >
              <PlusIcon className="mr-2 h-3.5 w-3.5" />
              Add choice
            </Button>
          </div>
        )}

        <label className="flex items-center gap-2 border-t border-[var(--border-subtle)] pt-3 text-sm">
          <Checkbox
            checked={field.required}
            onCheckedChange={(checked) =>
              onChange({ required: checked === true })
            }
          />
          Required
        </label>
      </div>
    </div>
  );
}
