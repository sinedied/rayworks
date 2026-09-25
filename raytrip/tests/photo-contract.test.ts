import { describe, expect, it } from 'vitest';
import {
  assemblePhoto, photoHash, splitPhoto, validateManifest, PHOTO_BYTE_LIMIT,
} from '../rayfin/functions/src/photo-contract';

describe('SQL photo byte contract', () => {
  it('round trips the maximum photo across more than one query page', async () => {
    const bytes = Uint8Array.from({ length: PHOTO_BYTE_LIMIT }, (_, i) => i % 251);
    const chunks = splitPhoto(bytes);
    expect(chunks).toHaveLength(175);
    expect(chunks.every(chunk => chunk.length <= 4000 && chunk.length % 4 === 0)).toBe(true);
    const manifest = { byteLength: bytes.length, width: 1600, height: 900, chunkCount: chunks.length, sha256: await photoHash(bytes) };
    const shuffled = chunks.map((content, partIndex) => ({ content, partIndex })).reverse();
    expect(await assemblePhoto(manifest, shuffled)).toEqual(bytes);
  });
  it('rejects missing, duplicated, corrupted and noncanonical parts', async () => {
    const bytes = new Uint8Array(4000);
    const chunks = splitPhoto(bytes).map((content, partIndex) => ({ content, partIndex }));
    const manifest = { byteLength: bytes.length, width: 40, height: 40, chunkCount: chunks.length, sha256: await photoHash(bytes) };
    await expect(assemblePhoto(manifest, chunks.slice(1))).rejects.toThrow('incomplete');
    await expect(assemblePhoto(manifest, [chunks[0], chunks[0]])).rejects.toThrow();
    await expect(assemblePhoto(manifest, [{ ...chunks[0], content: '!'.repeat(4000) }, chunks[1]])).rejects.toThrow();
    await expect(assemblePhoto({ ...manifest, sha256: 'f'.repeat(64) }, chunks)).rejects.toThrow('integrity');
  });
  it('rejects empty/oversized images and forged manifest limits', () => {
    expect(() => splitPhoto(new Uint8Array())).toThrow();
    expect(() => splitPhoto(new Uint8Array(PHOTO_BYTE_LIMIT + 1))).toThrow();
    expect(() => validateManifest({ byteLength: 12, width: 1601, height: 10, chunkCount: 1, sha256: '0'.repeat(64) })).toThrow();
    expect(() => validateManifest({ byteLength: 12, width: 10, height: 10, chunkCount: 175, sha256: '0'.repeat(64) })).toThrow();
  });
});
