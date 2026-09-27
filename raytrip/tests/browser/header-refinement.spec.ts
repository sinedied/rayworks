import { expect, test, type Locator } from '@playwright/test';

async function geometry(header: Locator) {
  return header.evaluate(element => {
    const title = element.querySelector('.report-document-title')!;
    const date = element.querySelector('.report-trip-date')!;
    const root = element.getBoundingClientRect();
    const t = title.getBoundingClientRect();
    const d = date.getBoundingClientRect();
    const css = getComputedStyle(title);
    return {
      title: title.textContent, date: date.textContent,
      fontSize: css.fontSize, lineHeight: css.lineHeight, fontWeight: css.fontWeight, color: css.color,
      titleX: t.x - root.x, titleY: t.y - root.y,
      dateX: d.x - root.x, dateY: d.y - root.y,
      width: root.width, height: root.height,
    };
  });
}

for (const width of [320, 390, 768, 1280]) {
  test(`picker alignment, compact controls and exact header parity at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/tests/browser/index.html?route=/trips/trip-1&scenario=cover');
    await page.getByRole('button', { name: 'Edit header photos' }).click();
    const dialog = page.getByRole('dialog');
    // Align the checkbox with the first text line even when the caption wraps.
    await dialog.locator('.header-photo-caption-text').first().evaluate(element => {
      element.textContent = 'A long photo caption with several words and an unbroken reference '.repeat(3);
    });
    const caption = dialog.locator('.header-photo-caption').first();
    const alignment = await caption.evaluate(row => {
      const checkbox = row.querySelector('input')!;
      const text = row.querySelector('.header-photo-caption-text')!;
      const a = checkbox.getBoundingClientRect();
      const b = text.getBoundingClientRect();
      return { width: a.width, height: a.height, top: Math.abs(a.top - b.top), gap: b.left - a.right,
        padding: getComputedStyle(checkbox).padding, margin: getComputedStyle(checkbox).margin };
    });
    expect(alignment).toEqual({ width: 20, height: 20, top: 0, gap: 8, padding: '0px', margin: '0px' });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (width === 390) await dialog.screenshot({ path: test.info().outputPath('aligned-picker.png') });
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('tab', { name: 'Report', exact: true }).click();
    const checkbox = page.getByRole('checkbox', { name: 'Include photo header in shared report' });
    await expect(checkbox).not.toBeChecked();
    const order = await page.locator('.report-workspace').evaluate(workspace => {
      const selectors = ['.editor-toolbar', '.report-document-header', '.report-markdown', '.report-cover-controls', '.report-actions'];
      return selectors.every((selector, i) => i === 0 || !!(workspace.querySelector(selectors[i - 1])!
        .compareDocumentPosition(workspace.querySelector(selector)!) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(order).toBe(true);
    await expect(page.locator('.report-cover-controls')).toHaveCSS('padding', '0px');
    await expect(page.locator('.report-cover-controls')).toHaveCSS('border-top-width', '0px');
    await expect(page.locator('.report-trip-date')).toHaveText('Mar 11, 2026');
    await checkbox.check();
    await expect(page.locator('.report-cover-image img')).toBeVisible();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    // Compare like-for-like widths, regardless of the surrounding app chrome.
    const header = page.locator('.report-document-header');
    const before = await geometry(header);
    expect(Number.parseFloat(before.fontSize)).toBeGreaterThanOrEqual(width < 640 ? 24 : 30);
    if (width === 390) {
      await header.scrollIntoViewIfNeeded();
      await header.screenshot({ path: test.info().outputPath('editor-header.png') });
    }
    await page.getByRole('button', { name: 'Save & finalize' }).click();
    expect(await geometry(header)).toEqual(before);
    await page.getByRole('link', { name: 'Open shared report' }).click();
    await expect(page.locator('.report-cover-image img')).toBeVisible();
    await page.locator('.shared-report').evaluate((article, w) => {
      (article as HTMLElement).style.width = `${w}px`;
      (article as HTMLElement).style.maxWidth = 'none';
      (article as HTMLElement).style.padding = '0';
      (article as HTMLElement).style.border = '0';
    }, before.width);
    expect(await geometry(header)).toEqual(before);
    await expect(page.locator('.report-header-with-photo')).not.toContainText('Header preview');
    await expect(header).not.toContainText('Finalized');
  });
}

test('saving no header photos overrides automatic defaults across reloads and new uploads', async ({ page }) => {
  await page.goto('/tests/browser/index.html?route=/trips/trip-1&scenario=cover');
  await page.getByRole('button', { name: 'Edit header photos' }).click();
  const dialog = page.getByRole('dialog');
  for (let i = 1; i <= 6; i++) await dialog.getByRole('checkbox', { name: `Photo ${i}`, exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Save header photos' }).click();
  await expect(page.locator('.trip-masthead .photo-mosaic')).toHaveCount(0);
  expect(await page.evaluate(async () => (await (await import('/tests/browser/trips.ts')).getTrip())?.headerPhotoIds)).toBe('[]');
  await page.evaluate(async () => {
    const fixture = await import('/tests/browser/trips.ts');
    fixture.addFixturePhoto();
    const { router } = await import('/tests/browser/fixture.tsx');
    await router.navigate('/');
    await router.navigate('/trips/trip-1');
  });
  await expect(page.getByRole('button', { name: 'Choose header photos' })).toBeVisible();
  await expect(page.locator('.trip-masthead .photo-mosaic')).toHaveCount(0);
});
