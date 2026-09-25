import { expect, test, type Page } from '@playwright/test';
const fixture = (route: string, scenario = 'draft') => `/tests/browser/index.html?route=${encodeURIComponent(route)}&scenario=${scenario}`;
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

for (const width of [320, 360, 390, 430, 768, 1280]) {
  test(`phone workflows fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(fixture('/trips/trip-1'));
    await expect(page.getByRole('tab', { name: 'Report', exact: true })).toBeVisible();
    await noOverflow(page);
    await page.getByRole('button', { name: 'Add day' }).click();
    await expect(page.getByRole('dialog', { name: 'Add daily note' })).toBeVisible();
    await noOverflow(page);
    const box = await page.getByRole('button', { name: 'Close dialog' }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.getByRole('tab', { name: 'Report', exact: true }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('textbox', { name: 'Report (Markdown)' }).fill('## Summary\n\nPhone-edited brief.');
    await page.getByRole('tab', { name: 'Notes & photos' }).click();
    await page.getByRole('tab', { name: 'Report', exact: true }).click();
    await expect(page.getByRole('textbox')).toHaveValue('## Summary\n\nPhone-edited brief.');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.getByText('Phone-edited brief.')).toBeVisible();
    await noOverflow(page);
    if (width === 390) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: test.info().outputPath('mobile-report.png'), fullPage: true });
    }
    await page.getByRole('button', { name: 'Save & finalize' }).click();
    await page.getByRole('link', { name: 'Open shared report' }).click();
    await expect(page.getByText('Phone-edited brief.')).toBeVisible();
    await noOverflow(page);
  });
}

test('touch targets, upload, unsaved navigation and generation failure', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true });
    const page = await context.newPage();
    await page.goto(fixture('/trips/trip-1'));
    await expect(page.getByRole('tab', { name: 'Report', exact: true })).toBeVisible();
    for (const label of ['Add day', 'Edit', 'Delete', 'Upload photo']) {
      const box = await page.getByRole('button', { name: label, exact: true }).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    await page.getByLabel('Photo', { exact: true }).setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('test') });
    await page.getByRole('button', { name: 'Upload photo' }).click();
    await expect(page.getByLabel('Photo', { exact: true })).toHaveValue('');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Report', exact: true }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('textbox').fill('Unsaved report');
    await page.getByRole('link', { name: 'All trips' }).click();
    await expect(page.getByRole('dialog', { name: 'Leave this trip?' })).toBeVisible();
    await page.getByRole('button', { name: 'Stay', exact: true }).click();
    await expect(page.getByRole('textbox')).toHaveValue('Unsaved report');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('status')).toHaveText('Changes saved.');
    await page.goto(fixture('/trips/trip-1', 'error'));
    await page.getByRole('tab', { name: 'Report', exact: true }).click();
    await page.getByRole('button', { name: 'Regenerate', exact: true }).click();
    await page.getByRole('button', { name: 'Regenerate report' }).click();
    await expect(page.getByRole('alert')).toContainText('Generation failed');
    await expect(page.getByText('A useful trip.')).toBeVisible();
    await context.close();
  });

test('auth, dashboard, generation, errors, legacy content and short dialogs', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const route of ['/auth', '/']) {
    await page.goto(fixture(route));
    await expect(page.locator('h1')).toBeVisible();
    await noOverflow(page);
  }
  await page.getByRole('button', { name: 'Create trip', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.setViewportSize({ width: 667, height: 320 });
  await page.getByRole('dialog').getByRole('button', { name: 'Create trip', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Create trip', exact: true })).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(fixture('/trips/trip-1', 'empty'));
  await page.getByRole('tab', { name: 'Report', exact: true }).click();
  await page.getByRole('button', { name: 'Generate trip report' }).click();
  await expect(page.getByText('Generated brief.')).toBeVisible();
  await page.goto(fixture('/trips/trip-1', 'error'));
  await page.getByRole('button', { name: 'Add day' }).click();
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Test');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Could not save');
  await page.goto(fixture('/reports/share-1', 'legacy'));
  await expect(page.getByText('Original takeaways')).toBeVisible();
  await noOverflow(page);
});

test('leaving a running generation cannot populate the next trip visit', async ({ page }) => {
  await page.goto(fixture('/trips/trip-1', 'empty'));
  await page.getByRole('tab', { name: 'Report', exact: true }).click();
  await page.getByRole('button', { name: 'Generate trip report' }).click();
  await page.getByRole('link', { name: 'All trips' }).click();
  await expect(page.getByRole('dialog', { name: 'Leave this trip?' })).toBeVisible();
  await page.getByRole('button', { name: 'Leave trip', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your trips and reports' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trip report', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your trips and reports' })).toBeVisible();
});
