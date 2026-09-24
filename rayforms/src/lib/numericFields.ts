import { z } from 'zod';

import type { FormFieldKind } from '../../rayfin/data/FormField';

const settingsSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    interval: z.number().optional(),
    minLabel: z.string().optional(),
    maxLabel: z.string().optional(),
  })
  .strict();

export type NumericFieldSettings = z.infer<typeof settingsSchema>;

export function defaultRatingSettings(): NumericFieldSettings {
  return { min: 1, max: 5, interval: 1 };
}

export function validateNumericSettings(
  kind: FormFieldKind,
  settings: NumericFieldSettings = {}
): string | null {
  if (kind !== 'number' && kind !== 'rating') return null;

  const { min, max, interval } = settings;
  for (const [label, value] of [
    ['Minimum', min],
    ['Maximum', max],
  ] as const) {
    if (value !== undefined && !Number.isFinite(value)) {
      return `${label} must be a finite number.`;
    }
  }

  if (kind === 'number') {
    return min !== undefined && max !== undefined && min > max
      ? 'Minimum must not exceed maximum.'
      : null;
  }

  if (min === undefined || max === undefined || interval === undefined) {
    return 'Rating requires a minimum, maximum, and interval.';
  }
  if (![min, max, interval].every(Number.isSafeInteger)) {
    return 'Rating minimum, maximum, and interval must be safe whole numbers.';
  }
  if (min >= max) return 'Rating minimum must be less than maximum.';
  if (interval <= 0) return 'Rating interval must be greater than zero.';
  const range = max - min;
  if (!Number.isSafeInteger(range)) {
    return 'Rating range must contain a safe whole number of choices.';
  }
  if (range % interval !== 0) {
    return 'Rating interval must divide the range exactly to reach the maximum.';
  }
  if (!Number.isSafeInteger(range / interval + 1)) {
    return 'Rating range must contain a safe whole number of choices.';
  }
  if (
    [settings.minLabel, settings.maxLabel].some(
      (label) => (label?.length ?? 0) > 500
    )
  ) {
    return 'Rating endpoint help text must be 500 characters or fewer.';
  }
  if (JSON.stringify(settings).length > 4000) {
    return 'Rating settings are too long to store. Shorten the endpoint help text.';
  }
  return null;
}

export function readNumericSettings(
  kind: FormFieldKind,
  stored: string | null | undefined
): { settings: NumericFieldSettings; error: string | null } {
  if (kind !== 'number' && kind !== 'rating') {
    return { settings: {}, error: null };
  }
  let raw: unknown = {};
  if (stored) {
    try {
      raw = JSON.parse(stored);
    } catch {
      return {
        settings: {},
        error: 'This question has invalid numeric settings.',
      };
    }
  }
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { settings: {}, error: 'This question has invalid numeric settings.' };
  }
  return {
    settings: parsed.data,
    error: validateNumericSettings(kind, parsed.data),
  };
}

export function serializeNumericSettings(
  kind: FormFieldKind,
  settings: NumericFieldSettings = {}
): string {
  const error = validateNumericSettings(kind, settings);
  if (error) throw new Error(error);
  if (kind !== 'number' && kind !== 'rating') return '';

  const { min, max, interval, minLabel, maxLabel } = settings;
  if (kind === 'number') {
    return min === undefined && max === undefined
      ? ''
      : JSON.stringify({ min, max });
  }
  return JSON.stringify({
    min,
    max,
    interval,
    minLabel: minLabel?.trim() || undefined,
    maxLabel: maxLabel?.trim() || undefined,
  });
}

export function ratingChoiceCount(settings: NumericFieldSettings): number {
  const error = validateNumericSettings('rating', settings);
  if (error) throw new Error(error);
  if (
    settings.min === undefined ||
    settings.max === undefined ||
    settings.interval === undefined
  ) {
    throw new Error('Rating settings are incomplete.');
  }
  return (settings.max - settings.min) / settings.interval + 1;
}

export function validateNumericAnswer(
  kind: FormFieldKind,
  settings: NumericFieldSettings,
  value: string
): string | null {
  if (kind !== 'number' && kind !== 'rating') return null;
  const settingsError = validateNumericSettings(kind, settings);
  if (settingsError) return settingsError;
  if (!value.trim()) return null;

  const number = Number(value);
  if (!Number.isFinite(number)) return 'Enter a valid finite number.';
  if (settings.min !== undefined && number < settings.min) {
    return `Enter a value of at least ${settings.min}.`;
  }
  if (settings.max !== undefined && number > settings.max) {
    return `Enter a value of at most ${settings.max}.`;
  }
  if (kind === 'rating') {
    if (!Number.isSafeInteger(number)) return 'Choose a whole-number rating.';
    if (
      settings.min !== undefined &&
      settings.interval !== undefined &&
      (number - settings.min) % settings.interval !== 0
    ) {
      return `Choose a rating in intervals of ${settings.interval} from ${settings.min}.`;
    }
  }
  return null;
}
