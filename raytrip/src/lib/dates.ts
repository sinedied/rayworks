export function toValidDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(
  value: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }
): string {
  const date = toValidDate(value);
  return date
    ? new Intl.DateTimeFormat('en', options).format(date)
    : 'Date unavailable';
}

export function toDateInputValue(
  value: Date | string | null | undefined
): string {
  const date = toValidDate(value);
  return date ? date.toISOString().slice(0, 10) : '';
}
