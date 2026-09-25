import { assemblePhoto, photoHash, splitPhoto } from '../../rayfin/functions/src/photo-contract';
import {
  COVER_BYTE_LIMIT, COVER_WIDTH, COVER_HEIGHT, reportCoverPayload, readReportCover,
  type ReportCover, type ReportCoverColumns,
} from '../../rayfin/report-cover';
import { mosaicLayout } from './photo-mosaic';

export function readCoverState(row?: ReportCoverColumns | null): { cover: ReportCover | null; error: string } {
  try { return { cover: row ? readReportCover(row) : null, error: '' }; }
  catch (reason) { return { cover: null, error: reason instanceof Error ? reason.message : 'Report header is invalid.' }; }
}

export async function coverBlob(cover: ReportCover): Promise<Blob> {
  readReportCover(reportCoverPayload(cover));
  const bytes = await assemblePhoto(
    { ...cover, chunkCount: cover.parts.length },
    cover.parts.map((content, partIndex) => ({ content, partIndex }))
  );
  if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error('Report header must be a JPEG image.');
  const blob = new Blob([Uint8Array.from(bytes).buffer], { type: 'image/jpeg' });
  const image = await createImageBitmap(blob);
  try {
    if (image.width !== cover.width || image.height !== cover.height) throw new Error('Report header dimensions do not match.');
  } finally { image.close(); }
  return blob;
}

export async function createReportCover(urls: readonly string[]): Promise<ReportCover> {
  if (!urls.length || urls.length > 6) throw new Error('Choose one to six header photos first.');
  const images: ImageBitmap[] = [];
  try {
    // Decode in order; cap the working set to the selected six images.
    for (const url of urls) {
      if (!url.startsWith('blob:')) throw new Error('Only loaded private trip photos can be used.');
      const response = await fetch(url);
      if (!response.ok) throw new Error('Could not load a selected photo.');
      images.push(await createImageBitmap(await response.blob()));
    }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot create a report photo header.');
    for (const scale of [1, 0.75, 0.5]) {
      canvas.width = Math.round(COVER_WIDTH * scale);
      canvas.height = Math.round(COVER_HEIGHT * scale);
      context.fillStyle = '#0b2a5b';
      context.fillRect(0, 0, canvas.width, canvas.height);
      for (const tile of mosaicLayout(images, canvas.width, canvas.height)) {
        const image = images[tile.index];
        const gap = images.length > 1 ? 2 * scale : 0;
        const w = tile.width - gap;
        const h = tile.height - gap;
        const ratio = Math.max(w / image.width, h / image.height);
        const sw = w / ratio;
        const sh = h / ratio;
        context.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, tile.x, tile.y, w, h);
      }
      for (const quality of [0.8, 0.65, 0.5, 0.35]) {
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
          value => value ? resolve(value) : reject(new Error('Could not encode report header.')), 'image/jpeg', quality
        ));
        if (blob.type !== 'image/jpeg') throw new Error('JPEG encoding is not supported.');
        if (blob.size <= COVER_BYTE_LIMIT) {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          return { byteLength: bytes.length, width: canvas.width, height: canvas.height, sha256: await photoHash(bytes), parts: splitPhoto(bytes) };
        }
      }
    }
    throw new Error('The selected photos could not fit the report header size limit. Try fewer photos.');
  } finally { images.forEach(image => image.close()); }
}
