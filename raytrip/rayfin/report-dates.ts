export interface TripDates {
  startDate: Date | string;
  endDate: Date | string;
}

function calendarDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function snapshotTripDates(dates: TripDates) {
  const tripStartDate = calendarDate(dates.startDate);
  const tripEndDate = calendarDate(dates.endDate);
  if (!tripStartDate || !tripEndDate || tripEndDate < tripStartDate) {
    throw new Error('The trip dates are invalid. Reload the trip and check its dates before saving the report.');
  }
  return { tripStartDate, tripEndDate };
}

export function formatTripDateRange(start: Date | string | null | undefined, end: Date | string | null | undefined): string | null {
  if (start == null && end == null) return null;
  const first = calendarDate(start);
  const last = calendarDate(end);
  if (!first || !last || last < first) return 'Trip dates unavailable';
  const formatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  if (first.getTime() === last.getTime()) return formatter.format(first);
  return `${formatter.format(first)} – ${formatter.format(last)}`;
}
