import type { Trip } from '../../rayfin/data/Trip';
import type { TripDay } from '../../rayfin/data/TripDay';
import type { TripPhoto } from '../../rayfin/data/TripPhoto';
import type { TripReportRecord as TripReport } from '../../rayfin/data/TripReport';
import { reportCoverPayload, type ReportCover } from '../../rayfin/report-cover';
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
let photos: TripPhoto[] = Array.from({ length: scenario === 'cover' ? 7 : 1 }, (_, index) => ({
  id: `00000000-0000-4000-8000-00000000000${index + 1}`, storageName: 'photo.jpg', contentType: 'image/jpeg',
  storageBackend: 'sql-v1', uploadState: 'ready', width: 400, height: 300,
  caption: scenario === 'cover' ? `Photo ${index + 1}` : 'Caption'.repeat(60), createdAt: date, trip_id: trip.id, owner_id: 'owner',
}));
export async function listTripPhotos() { return photos; }
export async function saveTripHeaderPhotos(_id: string, ids: string[]) { trip.headerPhotoIds = JSON.stringify(ids); }
let photoRequests = 0;
export function photoRequestCount() { return photoRequests; }
export async function getTripPhotoUrl(photo: TripPhoto) {
  photoRequests++;
  const index = Number(photo.id.slice(-1));
  const color = ['#FF6B6B', '#0B2A5B', '#fff', '#00C2AB', '#FFC629', '#7C3AED', '#000'][index - 1];
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 300;
  const context = canvas.getContext('2d')!;
  context.fillStyle = color; context.fillRect(0, 0, 400, 300);
  context.fillStyle = '#e5e7eb'; context.beginPath(); context.arc(200, 150, 70, 0, Math.PI * 2); context.fill();
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/jpeg', 0.8));
  return URL.createObjectURL(blob);
}
export async function getTripReport() { return report; }
export async function getSharedReport(shareId: string) {
  return report?.shareId === shareId && report.status === 'finalized' ? report : null;
}
export async function generateTripReport() {
  await new Promise(resolve => setTimeout(resolve, 250));
  if (scenario === 'error') throw new Error('Generation failed.');
  report = { ...report, id: 'report-1', title: trip.title, content: '## Summary\n\nGenerated brief.\n\n## Key takeaways\n\n- Follow up.',
    status: 'draft', trip_id: trip.id, shareId: 'share-1', generatedAt: date, owner_id: 'owner' };
}
export async function saveTripReport(_id: string, content: string, cover?: ReportCover | null) {
  if (report) report = { ...report, content, ...(cover !== undefined ? reportCoverPayload(cover) : {}) };
}
export async function finalizeTripReport(_id: string, content: string, cover?: ReportCover | null) {
  if (scenario === 'error') throw new Error('Could not finalize.');
  if (report) report = { ...report, content, status: 'finalized', finalizedAt: date, ...(cover !== undefined ? reportCoverPayload(cover) : {}) };
}
export async function reopenTripReport() {
  if (!report) throw new Error('Report not found.');
  report = { ...report, status: 'draft', finalizedAt: null };
}
export async function updateTrip() {}
export async function deleteTripDay(id: string) { days = days.filter(day => day.id !== id); }
export async function deleteTripPhoto(photo: TripPhoto) { photos = photos.filter(p => p.id !== photo.id); }
export async function uploadTripPhoto() { await new Promise(resolve => setTimeout(resolve, 20)); }
export async function saveTripDay() {
  if (scenario === 'error') throw new Error('Could not save daily note.');
}
