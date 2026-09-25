export const HEADER_PHOTO_LIMIT = 6;
export const COVER_BYTE_LIMIT = 32 * 1024;
export const COVER_WIDTH = 1200;
export const COVER_HEIGHT = 360;
export const COVER_PART_FIELDS = [
  'headerImagePart01', 'headerImagePart02', 'headerImagePart03',
  'headerImagePart04', 'headerImagePart05', 'headerImagePart06',
  'headerImagePart07', 'headerImagePart08', 'headerImagePart09',
  'headerImagePart10', 'headerImagePart11',
] as const;

export const COVER_FIELDS = [
  'includePhotoHeader', 'headerImageBytes', 'headerImageWidth',
  'headerImageHeight', 'headerImageHash', ...COVER_PART_FIELDS,
] as const;

export interface ReportCover {
  byteLength: number;
  width: number;
  height: number;
  sha256: string;
  parts: string[];
}

export type ReportCoverColumns = {
  includePhotoHeader?: boolean | null;
  headerImageBytes?: number | null;
  headerImageWidth?: number | null;
  headerImageHeight?: number | null;
  headerImageHash?: string | null;
} & Partial<Record<typeof COVER_PART_FIELDS[number], string | null>>;

export function parseHeaderPhotoIds(value?: string | null): string[] {
  if (value == null) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('The saved header photo selection is invalid. Choose the photos again.'); }
  if (!Array.isArray(parsed) || parsed.length > HEADER_PHOTO_LIMIT
    || parsed.some(id => typeof id !== 'string' || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))
    || new Set(parsed).size !== parsed.length) {
    throw new Error('Choose up to six different trip photos for the header.');
  }
  return parsed;
}

export function readReportCover(row: ReportCoverColumns): ReportCover | null {
  if (!row.includePhotoHeader) return null;
  const { headerImageBytes: byteLength, headerImageWidth: width, headerImageHeight: height, headerImageHash: sha256 } = row;
  if (typeof byteLength !== 'number' || !Number.isInteger(byteLength) || byteLength < 1 || byteLength > COVER_BYTE_LIMIT
    || typeof width !== 'number' || !Number.isInteger(width) || width < 1 || width > COVER_WIDTH
    || typeof height !== 'number' || !Number.isInteger(height) || height < 1 || height > COVER_HEIGHT
    || typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error('The saved report header is invalid. Turn it off or update it from trip photos.');
  }
  const count = Math.ceil(4 * Math.ceil(byteLength / 3) / 4000);
  const parts: string[] = [];
  for (let i = 0; i < COVER_PART_FIELDS.length; i++) {
    const part = row[COVER_PART_FIELDS[i]];
    if (i < count) {
      if (typeof part !== 'string' || !part.length) throw new Error('The report header is incomplete.');
      parts.push(part);
    } else if (part != null) throw new Error('The report header has unexpected image parts.');
  }
  return { byteLength, width, height, sha256, parts };
}

export function reportCoverPayload(cover: ReportCover | null) {
  const payload: Required<ReportCoverColumns> = {
    includePhotoHeader: cover !== null,
    headerImageBytes: cover?.byteLength ?? null,
    headerImageWidth: cover?.width ?? null,
    headerImageHeight: cover?.height ?? null,
    headerImageHash: cover?.sha256 ?? null,
    headerImagePart01: null, headerImagePart02: null,
    headerImagePart03: null, headerImagePart04: null,
    headerImagePart05: null, headerImagePart06: null,
    headerImagePart07: null, headerImagePart08: null,
    headerImagePart09: null, headerImagePart10: null,
    headerImagePart11: null,
  };
  if (cover) {
    if (cover.parts.length > COVER_PART_FIELDS.length) throw new Error('Report header exceeds the image limit.');
    cover.parts.forEach((part, index) => { payload[COVER_PART_FIELDS[index]] = part; });
    readReportCover(payload);
  }
  return payload;
}
