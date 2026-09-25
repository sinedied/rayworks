import { Trip } from './Trip.js';
import { TripDay } from './TripDay.js';
import { TripPhoto } from './TripPhoto.js';
import { TripPhotoChunk } from './TripPhotoChunk.js';
import { TripReport, type TripReportRecord } from './TripReport.js';

export type UniversalAppSchema = {
  Trip: Trip;
  TripDay: TripDay;
  TripPhoto: TripPhoto;
  TripPhotoChunk: TripPhotoChunk;
  TripReport: TripReportRecord;
};

export const schema = [Trip, TripDay, TripPhoto, TripPhotoChunk, TripReport];
