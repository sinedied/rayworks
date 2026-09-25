import type { Trip } from '../../rayfin/data/Trip';
import type { TripDay } from '../../rayfin/data/TripDay';
import type { TripReportRecord as TripReport } from '../../rayfin/data/TripReport';

import { getRayfinClient } from './rayfinClient';
import { validateReportContent } from '@/lib/report';
import { coverBlob } from '@/lib/report-cover';
import { COVER_FIELDS, parseHeaderPhotoIds, reportCoverPayload, type ReportCover } from '../../rayfin/report-cover';
import { listTripPhotos } from './photos';
export { listTripPhotos, uploadTripPhoto, getTripPhotoUrl, deleteTripPhoto } from './photos';

export type TripInput = Pick<
  Trip,
  'title' | 'destination' | 'purpose' | 'startDate' | 'endDate'
>;

export async function listTrips(): Promise<Trip[]> {
  return getRayfinClient().data.Trip.select([
    'id',
    'title',
    'destination',
    'purpose',
    'startDate',
    'endDate',
    'status',
    'createdAt',
    'updatedAt',
    'owner_id',
  ])
    .orderBy({ startDate: 'desc' })
    .first(1000)
    .execute();
}

export async function getTrip(id: string): Promise<Trip | null> {
  const trips = await getRayfinClient().data.Trip.select([
    'id',
    'title',
    'destination',
    'purpose',
    'startDate',
    'endDate',
    'status',
    'createdAt',
    'updatedAt',
    'owner_id',
    'headerPhotoIds',
  ])
    .where({ id: { eq: id } })
    .first(1)
    .execute();
  return trips[0] ?? null;
}

export async function createTrip(
  input: TripInput,
  ownerId: string
): Promise<Trip> {
  const now = new Date();
  return getRayfinClient().data.Trip.create({
    ...input,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    owner_id: ownerId,
  });
}

export async function updateTrip(
  id: string,
  input: Partial<TripInput & Pick<Trip, 'status'>>
): Promise<void> {
  await getRayfinClient().data.Trip.update(
    { id },
    { ...input, updatedAt: new Date() }
  );
}

export async function saveTripHeaderPhotos(id: string, ids: string[]): Promise<void> {
  const encoded = JSON.stringify(ids);
  parseHeaderPhotoIds(encoded);
  const photos = ids.length ? await listTripPhotos(id) : [];
  if (ids.some(photoId => !photos.some(photo =>
    photo.id === photoId && photo.trip_id === id && photo.storageBackend === 'sql-v1' && photo.uploadState === 'ready'
  ))) throw new Error('Some selected photos are unavailable. Refresh and choose again.');
  await getRayfinClient().data.Trip.update({ id }, { headerPhotoIds: encoded, updatedAt: new Date() });
}

export async function deleteTrip(id: string): Promise<void> {
  await getRayfinClient().data.Trip.delete({ id });
}

export async function listTripDays(tripId: string): Promise<TripDay[]> {
  return getRayfinClient().data.TripDay.select([
    'id',
    'day',
    'title',
    'notes',
    'createdAt',
    'updatedAt',
    'trip_id',
    'owner_id',
  ])
    .where({ trip_id: { eq: tripId } })
    .orderBy({ day: 'asc' })
    .first(1000)
    .execute();
}

export async function saveTripDay(
  tripId: string,
  ownerId: string,
  input: Pick<TripDay, 'day' | 'title' | 'notes'>,
  id?: string
): Promise<void> {
  const now = new Date();
  if (id) {
    await getRayfinClient().data.TripDay.update(
      { id },
      { ...input, updatedAt: now }
    );
    return;
  }
  await getRayfinClient().data.TripDay.create({
    ...input,
    createdAt: now,
    updatedAt: now,
    trip_id: tripId,
    owner_id: ownerId,
  });
}

export async function deleteTripDay(id: string): Promise<void> {
  await getRayfinClient().data.TripDay.delete({ id });
}

export async function getTripReport(
  tripId: string
): Promise<TripReport | null> {
  const reports = await getRayfinClient().data.TripReport.select([
    'id',
    'title',
    'content',
    'summary',
    'keyTakeaways',
    'status',
    'shareId',
    'generatedAt',
    'finalizedAt',
    'trip_id',
    ...COVER_FIELDS,
    'owner_id',
  ])
    .where({ trip_id: { eq: tripId } })
    .first(1)
    .execute();
  return reports[0] ?? null;
}

export async function getSharedReport(
  shareId: string
): Promise<TripReport | null> {
  const reports = await getRayfinClient().data.TripReport.select([
    'id',
    'title',
    'content',
    'summary',
    'keyTakeaways',
    'status',
    'shareId',
    'generatedAt',
    'finalizedAt',
    'trip_id',
    ...COVER_FIELDS,
  ])
    .where({ shareId: { eq: shareId }, status: { eq: 'finalized' } })
    .first(1)
    .execute();
  return reports[0] ?? null;
}

export async function generateTripReport(tripId: string): Promise<void> {
  await getRayfinClient().functions.generateTripReport.invoke({ tripId });
}

export async function saveTripReport(
  id: string,
  content: string,
  cover?: ReportCover | null
): Promise<void> {
  const text = validateReportContent(content);
  if (cover) await coverBlob(cover);
  await getRayfinClient().data.TripReport.update(
    { id }, { content: text, ...(cover !== undefined ? reportCoverPayload(cover) : {}) }
  );
}

export async function finalizeTripReport(id: string, content: string, cover?: ReportCover | null): Promise<void> {
  const text = validateReportContent(content);
  if (cover) await coverBlob(cover);
  await getRayfinClient().data.TripReport.update(
    { id },
    { content: text, status: 'finalized', finalizedAt: new Date(), ...(cover !== undefined ? reportCoverPayload(cover) : {}) }
  );
}

export async function reopenTripReport(id: string): Promise<void> {
  await getRayfinClient().data.TripReport.update(
    { id },
    { status: 'draft', finalizedAt: null }
  );
}
