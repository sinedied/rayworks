import { expect, test } from '@playwright/test';

test('browser optimization re-encodes, bounds dimensions and rejects unsupported sources', async ({ page }) => {
  await page.goto('/tests/browser/index.html');
  const results = await page.evaluate(async () => {
    const { preparePhoto } = await import('/src/lib/photo-image.ts');
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1200;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ff6b6b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'));
    const optimized = await preparePhoto(new File([blob], 'test.png', { type: 'image/png' }));
    const first = atob(optimized.parts.join('')).charCodeAt(0);
    const rejected: string[] = [];
    for (const file of [
      new File([], 'empty.jpg'),
      new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.jpg'),
      new File(['<svg/>'], 'image.svg', { type: 'image/svg+xml' }),
      new File(['not a picture'], 'broken.jpg', { type: 'image/jpeg' }),
    ]) {
      try { await preparePhoto(file); } catch (error) { rejected.push((error as Error).message); }
    }
    return { width: optimized.width, height: optimized.height, bytes: optimized.byteLength, first, rejected };
  });
  expect(results.width).toBe(1600);
  expect(results.height).toBe(800);
  expect(results.bytes).toBeLessThanOrEqual(512 * 1024);
  expect(results.first).toBe(255);
  expect(results.rejected).toHaveLength(4);
});
