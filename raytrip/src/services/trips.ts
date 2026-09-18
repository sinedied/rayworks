import type { Trip } from '../../rayfin/data/Trip';
import type { TripDay } from '../../rayfin/data/TripDay';
import type { TripPhoto } from '../../rayfin/data/TripPhoto';
import type { TripReport } from '../../rayfin/data/TripReport';

import { getRayfinClient } from './rayfinClient';

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

export async function listTripPhotos(tripId: string): Promise<TripPhoto[]> {
  return getRayfinClient().data.TripPhoto.select([
    'id',
    'storageName',
    'contentType',
    'caption',
    'createdAt',
    'trip_id',
    'tripDay_id',
    'owner_id',
  ])
    .where({ trip_id: { eq: tripId } })
    .orderBy({ createdAt: 'desc' })
    .first(1000)
    .execute();
}

export async function uploadTripPhoto(
  tripId: string,
  ownerId: string,
  file: File,
  caption?: string,
  tripDayId?: string
): Promise<void> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const storageName = `${crypto.randomUUID()}-${safeName}`;
  await getRayfinClient().storage.TripPhotos.upload(storageName, file, {
    prefix: ownerId,
    contentType: file.type || 'application/octet-stream',
  });

  try {
    await getRayfinClient().data.TripPhoto.create({
      storageName,
      contentType: file.type || 'application/octet-stream',
      caption: caption?.trim() || undefined,
      createdAt: new Date(),
      trip_id: tripId,
      tripDay_id: tripDayId,
      owner_id: ownerId,
    });
  } catch (error) {
    await getRayfinClient().storage.TripPhotos.delete(storageName, {
      prefix: ownerId,
    });
    throw error;
  }
}

export async function getTripPhotoUrl(photo: TripPhoto): Promise<string> {
  const result = await getRayfinClient().storage.TripPhotos.download(
    photo.storageName,
    { prefix: photo.owner_id }
  );
  return URL.createObjectURL(
    await new Response(result.stream, {
      headers: { 'Content-Type': photo.contentType },
    }).blob()
  );
}

export async function deleteTripPhoto(photo: TripPhoto): Promise<void> {
  await getRayfinClient().storage.TripPhotos.delete(photo.storageName, {
    prefix: photo.owner_id,
  });
  await getRayfinClient().data.TripPhoto.delete({ id: photo.id });
}

export async function getTripReport(
  tripId: string
): Promise<TripReport | null> {
  const reports = await getRayfinClient().data.TripReport.select([
    'id',
    'title',
    'summary',
    'keyTakeaways',
    'status',
    'shareId',
    'generatedAt',
    'finalizedAt',
    'trip_id',
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
    'summary',
    'keyTakeaways',
    'status',
    'shareId',
    'generatedAt',
    'finalizedAt',
    'trip_id',
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
  updates: Pick<TripReport, 'summary' | 'keyTakeaways'>
): Promise<void> {
  await getRayfinClient().data.TripReport.update({ id }, updates);
}

export async function finalizeTripReport(id: string): Promise<void> {
  await getRayfinClient().data.TripReport.update(
    { id },
    { status: 'finalized', finalizedAt: new Date() }
  );
}
