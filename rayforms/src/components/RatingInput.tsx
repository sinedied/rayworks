import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { RadioGroup } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { ratingChoiceCount, type NumericFieldSettings } from '@/lib/numericFields';

interface RatingInputProps {
  id: string;
  label: string;
  settings: NumericFieldSettings;
  value: string;
  required: boolean;
  describedBy?: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}

export function RatingInput({
  id,
  label,
  settings,
  value,
  required,
  describedBy,
  invalid,
  onChange,
}: RatingInputProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const count = ratingChoiceCount(settings);
  const { min, max, interval, minLabel, maxLabel } = settings;
  if (min === undefined || max === undefined || interval === undefined) {
    throw new Error('Rating settings are incomplete.');
  }
  const selected = value !== '';
  const current = selected ? Number(value) : min;
  const description = [
    describedBy,
    `${id}-endpoints`,
    required ? `${id}-required` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="space-y-2">
      {required && (
        <span id={`${id}-required`} className="sr-only">
          Required. Choose a rating.
        </span>
      )}
      {count <= 5 ? (
        <RadioGroup
          id={id}
          aria-label={label}
          aria-describedby={description}
          aria-required={required}
          aria-invalid={invalid}
          value={value}
          onValueChange={onChange}
          className="flex flex-wrap gap-2"
        >
          {Array.from({ length: count }, (_, index) => {
            const option = String(min + index * interval);
            return (
              <RadioGroupPrimitive.Item
                ref={(node) => {
                  buttons.current[index] = node;
                }}
                key={option}
                value={option}
                aria-label={option}
                onKeyDown={(event) => {
                  const targets: Partial<Record<string, number>> = {
                    Home: 0,
                    End: count - 1,
                    ArrowRight: (index + 1) % count,
                    ArrowDown: (index + 1) % count,
                    ArrowLeft: (index + count - 1) % count,
                    ArrowUp: (index + count - 1) % count,
                  };
                  const next = targets[event.key];
                  if (next === undefined) return;
                  event.preventDefault();
                  // Radix's deferred focus can run after keyup, missing the selection.
                  onChange(String(min + next * interval));
                  buttons.current[next]?.focus();
                }}
                className="font-data flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-md border border-input bg-background px-3 text-base font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
              >
                {option}
              </RadioGroupPrimitive.Item>
            );
          })}
        </RadioGroup>
      ) : (
        <div>
          <p aria-live="polite" className="font-data text-center text-sm text-muted-foreground">
            {selected ? `Selected: ${value}` : 'No rating selected'}
          </p>
          <Slider
            className="min-h-11 [&_[data-slot=slider-track]]:bg-[var(--text-subtle)]"
            min={min}
            max={max}
            step={interval}
            value={[current]}
            onValueChange={([next]) => onChange(String(next))}
            // Radix does not emit a change when the parked minimum is selected.
            onPointerUp={() => onChange(String(current))}
            thumbProps={{
              id,
              'aria-label': label,
              'aria-describedby': description,
              'aria-valuetext': selected ? value : 'No rating selected',
              'aria-invalid': invalid,
              onKeyDown: (event) => {
                if ([
                  'Enter', ' ', 'Home', 'End', 'ArrowLeft', 'ArrowRight',
                  'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown',
                ].includes(event.key)) {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                  }
                  onChange(String(current));
                }
              },
            }}
          />
        </div>
      )}
      <div id={`${id}-endpoints`} className="flex justify-between gap-4 text-sm text-muted-foreground">
        <span className="min-w-0 flex-1 break-words">
          <span className="font-data">{min}</span>
          {minLabel && ` - ${minLabel}`}
        </span>
        <span className="min-w-0 flex-1 break-words text-right">
          <span className="font-data">{max}</span>
          {maxLabel && ` - ${maxLabel}`}
        </span>
      </div>
      {!required && selected && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange('')}
        >
          Clear rating
        </Button>
      )}
    </div>
  );
}
