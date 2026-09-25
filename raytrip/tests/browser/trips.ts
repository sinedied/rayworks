import type { Trip } from '../../rayfin/data/Trip';
import type { TripDay } from '../../rayfin/data/TripDay';
import type { TripPhoto } from '../../rayfin/data/TripPhoto';
import type { TripReportRecord as TripReport } from '../../rayfin/data/TripReport';
const scenario = new URLSearchParams(location.search).get('scenario');
const date = new Date('2026-09-25');
const trip: Trip = {
  id: 'trip-1', title: `Conference and customer visits ${'LongTitle'.repeat(12)}`,
  destination: 'Seattle', purpose: 'Product meetings and customer feedback',
  startDate: date, endDate: date, status: 'active', owner_id: 'owner',
  createdAt: date, updatedAt: date,
};
let days: TripDay[] = [{
  id: 'day-1', day: date, title: 'Customer meetings', notes: `Meeting notes ${'https://example.test/'.repeat(30)}`,
  createdAt: date, updatedAt: date, trip_id: trip.id, owner_id: 'owner',
}];
let report: TripReport | null = scenario === 'empty' ? null : {
  id: 'report-1', title: trip.title, content: '## Summary\n\nA useful trip.\n\n## Key takeaways\n\n- Follow up with the team.',
  shareId: 'share-1', generatedAt: date, trip_id: trip.id, owner_id: 'owner',
  status: scenario === 'finalized' ? 'finalized' : 'draft',
};
if (scenario === 'legacy' && report) {
  report.content = undefined;
  report.summary = 'Legacy report '.repeat(300);
  report.keyTakeaways = 'Original takeaways';
  report.status = 'finalized';
}
export async function getTrip() { return scenario === 'missing' ? null : trip; }
export async function listTrips() { return scenario === 'empty' ? [] : [trip]; }
export async function createTrip() { if (scenario === 'error') throw new Error('Could not save trip.'); return trip; }
export async function listTripDays() { return days; }
export async function listTripPhotos(): Promise<TripPhoto[]> {
  return [{ id: 'photo-1', storageName: 'photo.png', contentType: 'image/png',
    storageBackend: 'sql-v1', uploadState: 'ready',
    caption: 'Caption'.repeat(60), createdAt: date, trip_id: trip.id, owner_id: 'owner' }];
}
export async function getTripPhotoUrl() { return URL.createObjectURL(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#FF6B6B"/></svg>'], { type: 'image/svg+xml' })); }
export async function getTripReport() { return report; }
export async function getSharedReport(shareId: string) {
  return report?.shareId === shareId && report.status === 'finalized' ? report : null;
}
export async function generateTripReport() {
  await new Promise(resolve => setTimeout(resolve, 250));
  if (scenario === 'error') throw new Error('Generation failed.');
  report = { id: 'report-1', title: trip.title, content: '## Summary\n\nGenerated brief.\n\n## Key takeaways\n\n- Follow up.',
    status: 'draft', trip_id: trip.id, shareId: 'share-1', generatedAt: date, owner_id: 'owner' };
}
export async function saveTripReport(_id: string, content: string) { if (report) report = { ...report, content }; }
export async function finalizeTripReport(_id: string, content: string) {
  if (scenario === 'error') throw new Error('Could not finalize.');
  if (report) report = { ...report, content, status: 'finalized', finalizedAt: date };
}
export async function reopenTripReport() {
  if (!report) throw new Error('Report not found.');
  report = { ...report, status: 'draft', finalizedAt: null };
}
export async function updateTrip() {}
export async function deleteTripDay(id: string) { days = days.filter(day => day.id !== id); }
export async function deleteTripPhoto() {}
export async function uploadTripPhoto() { await new Promise(resolve => setTimeout(resolve, 20)); }
export async function saveTripDay() {
  if (scenario === 'error') throw new Error('Could not save daily note.');
}
