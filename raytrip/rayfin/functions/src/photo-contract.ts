export const PHOTO_SOURCE_LIMIT = 20 * 1024 * 1024;
export const PHOTO_BYTE_LIMIT = 512 * 1024;
export const PHOTO_EDGE_LIMIT = 1600;
export const PHOTO_CHUNK_LENGTH = 4000;
export const PHOTO_MAX_CHUNKS = 175;
export const PHOTO_BACKEND = 'sql-v1';

export interface PhotoManifest {
  byteLength: number;
  width: number;
  height: number;
  chunkCount: number;
  sha256: string;
}

export function validateManifest(value: {
  byteLength?: number | null; width?: number | null; height?: number | null;
  chunkCount?: number | null; sha256?: string | null;
}): PhotoManifest {
  const { byteLength, width, height, chunkCount, sha256 } = value;
  if (typeof byteLength !== 'number' || !Number.isInteger(byteLength) || byteLength < 1 || byteLength > PHOTO_BYTE_LIMIT
    || typeof width !== 'number' || !Number.isInteger(width) || width < 1 || width > PHOTO_EDGE_LIMIT
    || typeof height !== 'number' || !Number.isInteger(height) || height < 1 || height > PHOTO_EDGE_LIMIT
    || typeof chunkCount !== 'number' || chunkCount !== Math.ceil(4 * Math.ceil(byteLength / 3) / PHOTO_CHUNK_LENGTH)
    || typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error('Invalid photo metadata. Photos must be JPEG copies up to 1,600 pixels and 512 KiB.');
  }
  return { byteLength, width, height, chunkCount, sha256 };
}

export function encodePhoto(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

export async function photoHash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function splitPhoto(bytes: Uint8Array): string[] {
  if (!bytes.length || bytes.length > PHOTO_BYTE_LIMIT) throw new Error('Photo exceeds the stored size limit.');
  const encoded = encodePhoto(bytes);
  const parts: string[] = [];
  for (let i = 0; i < encoded.length; i += PHOTO_CHUNK_LENGTH) parts.push(encoded.slice(i, i + PHOTO_CHUNK_LENGTH));
  return parts;
}

export async function assemblePhoto(
  manifest: PhotoManifest, parts: readonly { partIndex: number; content: string }[]
): Promise<Uint8Array> {
  validateManifest(manifest);
  if (parts.length !== manifest.chunkCount) throw new Error('Photo is incomplete: missing or duplicate parts.');
  const ordered = [...parts].sort((a, b) => a.partIndex - b.partIndex);
  const totalLength = 4 * Math.ceil(manifest.byteLength / 3);
  for (let i = 0; i < ordered.length; i++) {
    const part = ordered[i];
    const expected = i === ordered.length - 1 ? totalLength - i * PHOTO_CHUNK_LENGTH : PHOTO_CHUNK_LENGTH;
    if (part.partIndex !== i || typeof part.content !== 'string' || part.content.length !== expected
      || !/^[A-Za-z0-9+/]*={0,2}$/.test(part.content)) {
      throw new Error('Photo parts are invalid or incomplete.');
    }
  }
  const encoded = ordered.map(part => part.content).join('');
  let binary: string;
  try { binary = atob(encoded); } catch { throw new Error('Photo encoding is invalid.'); }
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  if (bytes.length !== manifest.byteLength || encodePhoto(bytes) !== encoded
    || await photoHash(bytes) !== manifest.sha256) {
    throw new Error('Photo integrity check failed. Try uploading the photo again.');
  }
  return bytes;
}
