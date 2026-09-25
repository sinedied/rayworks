import { expect, test } from '@playwright/test';

for (const width of [320, 390, 768, 1280]) {
  test(`selected mosaic and frozen report cover at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/tests/browser/index.html?route=/trips/trip-1&scenario=cover');
    await page.getByRole('button', { name: 'Choose header photos' }).click();
    let dialog = page.getByRole('dialog', { name: 'Choose header photos' });
    for (let i = 1; i <= 6; i++) await dialog.getByRole('checkbox', { name: `Photo ${i}`, exact: true }).check();
    await expect(dialog.getByRole('checkbox', { name: 'Photo 7', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.trip-masthead .photo-mosaic')).toHaveCount(0);
    await page.getByRole('button', { name: 'Choose header photos' }).click();
    dialog = page.getByRole('dialog', { name: 'Choose header photos' });
    for (let i = 1; i <= 6; i++) await dialog.getByRole('checkbox', { name: `Photo ${i}`, exact: true }).check();
    await dialog.getByRole('button', { name: 'Save header photos' }).click();
    await expect(page.locator('.trip-masthead .mosaic-tile img')).toHaveCount(6);
    await expect(page.locator('.trip-masthead')).toHaveCSS('background-color', 'rgb(11, 42, 91)');
    await expect(page.locator('.trip-masthead h1')).toHaveCSS('color', 'rgb(255, 255, 255)');
    const contrast = await page.locator('.trip-masthead').evaluate(header => {
      const mosaic = header.querySelector('.photo-mosaic')!;
      const scrim = getComputedStyle(mosaic, '::after').backgroundColor.match(/[\d.]+/g)!.map(Number);
      const text = getComputedStyle(header.querySelector('h1')!).color.match(/[\d.]+/g)!.map(Number);
      const background = scrim.slice(0, 3).map(channel => channel * scrim[3] + 255 * (1 - scrim[3]));
      const luminance = (rgb: number[]) => rgb.map(channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      return (luminance(text) + 0.05) / (luminance(background) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('tab', { name: 'Report', exact: true }).click();
    const option = page.getByRole('checkbox', { name: 'Include photo header in shared report' });
    await expect(option).not.toBeChecked();
    await option.check();
    await expect(page.locator('.report-cover-image img')).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('status')).toHaveText('Changes saved.');
    const savedHash = await page.evaluate(async () => (await (await import('/tests/browser/trips.ts')).getTripReport())?.headerImageHash);
    await page.getByRole('button', { name: 'Regenerate', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Regenerate report' }).click();
    await expect(page.getByText('Generated brief.', { exact: true })).toBeVisible();
    await expect(option).toBeChecked();
    expect(await page.evaluate(async () => (await (await import('/tests/browser/trips.ts')).getTripReport())?.headerImageHash)).toBe(savedHash);
    await expect(page.getByRole('button', { name: 'Save & finalize' })).toBeEnabled();
    await page.getByRole('button', { name: 'Save & finalize' }).click();
    const snapshot = await page.evaluate(async () => {
      const fixture = await import('/tests/browser/trips.ts');
      const report = await fixture.getTripReport();
      const photos = await fixture.listTripPhotos();
      for (const photo of photos) await fixture.deleteTripPhoto(photo);
      return { hash: report?.headerImageHash, bytes: report?.headerImageBytes, shareId: report?.shareId, photoRequests: fixture.photoRequestCount() };
    });
    expect(snapshot.bytes).toBeLessThanOrEqual(32768);
    expect(snapshot.hash).toMatch(/^[a-f0-9]{64}$/);
    await page.getByRole('link', { name: 'Open shared report' }).click();
    await expect(page.locator('.report-cover-image img')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const frozenHash = await page.evaluate(async () => (await (await import('/tests/browser/trips.ts')).getSharedReport('share-1'))?.headerImageHash);
    expect(frozenHash).toBe(snapshot.hash);
    expect(await page.evaluate(async () => (await import('/tests/browser/trips.ts')).photoRequestCount())).toBe(snapshot.photoRequests);
    if (width === 390) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: test.info().outputPath('shared-cover-mobile.png'), fullPage: true });
    }
    await page.evaluate(async () => { const { router } = await import('/tests/browser/fixture.tsx'); await router.navigate('/trips/trip-1'); });
    await page.getByRole('tab', { name: 'Report', exact: true }).click();
    await page.getByRole('button', { name: 'Reopen for editing' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reopen for editing' }).click();
    await expect(option).toBeChecked();
    const hidden = await page.evaluate(async () => (await import('/tests/browser/trips.ts')).getSharedReport('share-1'));
    expect(hidden).toBeNull();
    await option.uncheck();
    await page.getByRole('button', { name: 'Save & finalize' }).click();
    await page.getByRole('link', { name: 'Open shared report' }).click();
    await expect(page.locator('.report-cover-image')).toHaveCount(0);
    const cleared = await page.evaluate(async () => (await import('/tests/browser/trips.ts')).getSharedReport('share-1'));
    expect(cleared?.includePhotoHeader).toBe(false);
    expect(cleared?.headerImageHash).toBeNull();
    expect(cleared?.headerImagePart01).toBeNull();
  });
}
