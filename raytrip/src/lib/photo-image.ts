import {
  PHOTO_BYTE_LIMIT, PHOTO_EDGE_LIMIT, PHOTO_SOURCE_LIMIT, photoHash, splitPhoto,
  type PhotoManifest,
} from '../../rayfin/functions/src/photo-contract';

export interface PreparedPhoto extends PhotoManifest {
  parts: string[];
}

export async function preparePhoto(file: File, signal?: AbortSignal): Promise<PreparedPhoto> {
  if (!file.size) throw new Error('Choose a nonempty image.');
  if (file.size > PHOTO_SOURCE_LIMIT) throw new Error('Choose a source photo no larger than 20 MiB.');
  if (file.type === 'image/svg+xml' || /\.svgz?$/i.test(file.name)) throw new Error('Choose a raster photo such as JPEG, PNG, or WebP, not SVG.');
  signal?.throwIfAborted();
  let image: ImageBitmap;
  try { image = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('This browser cannot decode the photo. Convert it to JPEG or PNG and try again.'); }
  try {
    const scale = Math.min(1, PHOTO_EDGE_LIMIT / Math.max(image.width, image.height));
    let width = Math.max(1, Math.round(image.width * scale));
    let height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image preparation is not supported in this browser.');
    for (let step = 0; step < 4; step++) {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      for (const quality of [0.85, 0.7, 0.55]) {
        signal?.throwIfAborted();
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not encode this image.')), 'image/jpeg', quality);
        });
        if (blob.type !== 'image/jpeg') throw new Error('JPEG encoding is not available in this browser.');
        if (blob.size <= PHOTO_BYTE_LIMIT) {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const parts = splitPhoto(bytes);
          return { parts, byteLength: bytes.length, width, height, chunkCount: parts.length, sha256: await photoHash(bytes) };
        }
      }
      width = Math.max(1, Math.floor(width * 0.75));
      height = Math.max(1, Math.floor(height * 0.75));
    }
    throw new Error('Could not optimize this photo below 512 KiB. Choose a smaller image.');
  } finally { image.close(); }
}
