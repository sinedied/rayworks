import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

import type { Activity } from '../../rayfin/data/Activity';
import type { ActivityOption } from '../../rayfin/data/ActivityOption';

import { QuizTimer } from '@/components/QuizTimer';
import {
  submitChoice,
  submitRanking,
  submitRating,
  submitText,
} from '@/services/answers';
import { moveItem, moveItemById } from '@/lib/reorder';
import { getParticipantName, setParticipantName } from '@/services/identity';

const buttonBase =
  'w-full rounded-xl border px-4 py-3 text-left text-sm text-[var(--ia-text)] transition-colors';

const fieldClass =
  'w-full rounded-lg border border-[var(--ia-border)] bg-[var(--ia-bg)] px-4 py-2 text-sm text-[var(--ia-text)] placeholder-[var(--ia-muted)] focus:border-[var(--ia-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--ia-accent)]';

const primaryButton =
  'rounded-xl bg-[var(--ia-accent)] px-5 py-3 text-sm font-medium text-[var(--ia-bg)] transition-all disabled:opacity-40';

export interface AnswerFormProps {
  activity: Activity;
  options: ActivityOption[];
  onSubmitted: () => Promise<void> | void;
}

/** Renders the right answer control for the activity kind and submits it. */
export function ActivityAnswerForm({
  activity,
  options,
  onSubmitted,
}: AnswerFormProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(getParticipantName());

  const needsName = activity.kind === 'quiz' && !getParticipantName();

  const run = async (submit: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await submit();
      await onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send answer.');
    } finally {
      setBusy(false);
    }
  };

  if (needsName) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) setParticipantName(name);
          setName(name.trim());
        }}
        className="rounded-xl border border-[var(--ia-border)] bg-[var(--ia-surface)] p-4"
      >
        <label className="text-sm font-medium text-[var(--ia-text)]">
          Pick a nickname for the leaderboard
        </label>
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="e.g. Ada"
            className={`flex-1 ${fieldClass}`}
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-lg bg-[var(--ia-accent)] px-4 py-2 text-sm font-medium text-[var(--ia-bg)] disabled:opacity-40"
          >
            Join
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      {activity.kind === 'quiz' && <QuizTimer activity={activity} />}

      {error && (
        <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {(activity.kind === 'multipleChoice' || activity.kind === 'quiz') && (
        <ChoiceInput
          activity={activity}
          options={options}
          busy={busy}
          onSubmit={(optionIds) => run(() => submitChoice(activity, optionIds))}
        />
      )}

      {activity.kind === 'rating' && (
        <RatingInput
          maxRating={activity.maxRating ?? 5}
          busy={busy}
          onSubmit={(value) => run(() => submitRating(activity, value))}
        />
      )}

      {(activity.kind === 'wordCloud' || activity.kind === 'openText') && (
        <TextInput
          kind={activity.kind}
          busy={busy}
          onSubmit={(value) => run(() => submitText(activity, [value]))}
        />
      )}

      {activity.kind === 'ranking' && (
        <RankingInput
          options={options}
          busy={busy}
          onSubmit={(ordered) => run(() => submitRanking(activity, ordered))}
        />
      )}
    </div>
  );
}

function ChoiceInput({
  activity,
  options,
  busy,
  onSubmit,
}: {
  activity: Activity;
  options: ActivityOption[];
  busy: boolean;
  onSubmit: (optionIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  };

  if (!activity.allowMultiple) {
    return (
      <ul className="space-y-2">
        {options.map((option) => (
          <li key={option.id}>
            <button
              disabled={busy}
              onClick={() => onSubmit([option.id])}
              className={`${buttonBase} border-[var(--ia-border)] bg-[var(--ia-surface)] hover:border-[var(--ia-accent)] disabled:opacity-50`}
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      <ul className="space-y-2">
        {options.map((option) => (
          <li key={option.id}>
            <button
              onClick={() => toggle(option.id)}
              className={`${buttonBase} ${
                selected.includes(option.id)
                  ? 'border-[var(--ia-accent)] bg-[var(--ia-accent-soft)]'
                  : 'border-[var(--ia-border)] bg-[var(--ia-surface)] hover:border-[var(--ia-accent)]'
              }`}
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>
      <button
        disabled={selected.length === 0 || busy}
        onClick={() => onSubmit(selected)}
        className={`mt-3 w-full ${primaryButton}`}
      >
        Submit {selected.length > 0 && `(${selected.length})`}
      </button>
    </div>
  );
}

function RatingInput({
  maxRating,
  busy,
  onSubmit,
}: {
  maxRating: number;
  busy: boolean;
  onSubmit: (value: number) => void;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: maxRating }, (_, index) => index + 1).map(
        (value) => (
          <button
            key={value}
            disabled={busy}
            onMouseEnter={() => setHovered(value)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onSubmit(value)}
            aria-label={`Rate ${value} of ${maxRating}`}
            className={`text-4xl transition-transform hover:scale-110 disabled:opacity-50 ${
              value <= hovered ? 'text-amber-400' : 'text-[var(--ia-muted)]'
            }`}
          >
            ★
          </button>
        )
      )}
    </div>
  );
}

function TextInput({
  kind,
  busy,
  onSubmit,
}: {
  kind: 'wordCloud' | 'openText';
  busy: boolean;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  const isWordCloud = kind === 'wordCloud';

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) return;
        onSubmit(value);
        setValue('');
      }}
    >
      {isWordCloud ? (
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={80}
          placeholder="One or two words…"
          className={fieldClass}
        />
      ) : (
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={4}
          maxLength={500}
          placeholder="Type your answer…"
          className={`${fieldClass} resize-none`}
        />
      )}
      <button
        type="submit"
        disabled={!value.trim() || busy}
        className={`mt-3 w-full ${primaryButton}`}
      >
        Send
      </button>
    </form>
  );
}

/**
 * Ranking supports dragging and move up/down buttons.
 *
 * dnd-kit is used rather than the HTML5 drag-and-drop API, which never fires on touch devices —
 * most of the audience is on a phone. A small activation distance keeps taps and page scrolling
 * working, dragging is limited to an explicit handle, and the arrow buttons remain as a
 * discoverable, fully accessible fallback.
 */
function RankingInput({
  options,
  busy,
  onSubmit,
}: {
  options: ActivityOption[];
  busy: boolean;
  onSubmit: (orderedIds: string[]) => void;
}) {
  const [ordered, setOrdered] = useState(() => options.map((o) => o.id));
  const labels = new Map(options.map((option) => [option.id, option.label]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const move = (index: number, direction: -1 | 1) => {
    setOrdered((current) => moveItem(current, index, index + direction));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrdered((current) =>
      moveItemById(current, String(active.id), String(over.id))
    );
  };

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ordered} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {ordered.map((id, index) => (
              <SortableRow
                key={id}
                id={id}
                label={labels.get(id) ?? ''}
                index={index}
                total={ordered.length}
                onMove={move}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <button
        disabled={busy}
        onClick={() => onSubmit(ordered)}
        className={`mt-3 w-full ${primaryButton}`}
      >
        Submit ranking
      </button>
    </div>
  );
}

function SortableRow({
  id,
  label,
  index,
  total,
  onMove,
}: {
  id: string;
  label: string;
  index: number;
  total: number;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : undefined,
      }}
      className={`flex items-center gap-3 rounded-xl border bg-[var(--ia-surface)] px-3 py-3 ${
        isDragging
          ? 'border-[var(--ia-accent)] shadow-lg'
          : 'border-[var(--ia-border)]'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${label}`}
        // touch-none stops the browser scrolling the page instead of starting the drag.
        className="cursor-grab touch-none px-1 text-[var(--ia-muted)] active:cursor-grabbing"
      >
        ⠿
      </button>
      <span className="w-5 shrink-0 font-semibold text-[var(--ia-accent)]">
        {index + 1}
      </span>
      <span className="flex-1 text-sm text-[var(--ia-text)]">{label}</span>
      <button
        type="button"
        onClick={() => onMove(index, -1)}
        disabled={index === 0}
        aria-label={`Move ${label} up`}
        className="rounded-lg border border-[var(--ia-border)] px-2 py-1 text-xs text-[var(--ia-text)] disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => onMove(index, 1)}
        disabled={index === total - 1}
        aria-label={`Move ${label} down`}
        className="rounded-lg border border-[var(--ia-border)] px-2 py-1 text-xs text-[var(--ia-text)] disabled:opacity-30"
      >
        ↓
      </button>
    </li>
  );
}
