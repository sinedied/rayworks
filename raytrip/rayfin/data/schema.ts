import { Trip } from './Trip.js';
import { TripDay } from './TripDay.js';
import { TripPhoto } from './TripPhoto.js';
import { TripReport } from './TripReport.js';

export type UniversalAppSchema = {
  Trip: Trip;
  TripDay: TripDay;
  TripPhoto: TripPhoto;
  TripReport: TripReport;
};

export const schema = [Trip, TripDay, TripPhoto, TripReport];
