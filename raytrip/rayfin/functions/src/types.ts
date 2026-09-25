/**
 * Function schema types for RayfinClient.
 *
 * AUTO-GENERATED — do not edit manually.
 * Re-generated automatically when function source files change.
 *
 * If this file is not updating automatically, run:
 *   rayfin dev functions apply
 *
 * The schema is a closed object type: only the function names listed
 * below are accepted by RayfinClient.functions.<name>.invoke(...).
 * Adding, renaming, or changing the signature of a udf.func() call
 * regenerates this file and surfaces type errors at every consumer.
 *
 * IMPORTANT: This file must NOT import any Node.js packages — it is
 * resolved by the frontend app's TypeScript compiler.
 */

export type AppFunctionsSchema = {
  beginTripPhotoUpload: {
    input: { photoId: string; tripId: string; dayId: string; fileName: string; caption: string; byteLength: number; width: number; height: number; chunkCount: number; sha256: string };
    output: { photoId: string; ownerId: string };
  };
  completeTripPhotoUpload: {
    input: { photoId: string };
    output: { photoId: string };
  };
  deleteTripPhoto: {
    input: { photoId: string };
    output: { photoId: string; deleted: boolean };
  };
  generateTripReport: {
    input: { tripId: string };
    output: { reportId: string; shareId: string; content: string };
  };
};
