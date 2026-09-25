import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`reopen pauses sharing and refinalization restores the same link at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/tests/browser/index.html?route=/trips/trip-1&scenario=finalized');
    await page.getByRole('tab', { name: 'Report', exact: true }).click();
    const originalLink = await page.getByRole('link', { name: 'Open shared report' }).getAttribute('href');
    await page.getByRole('button', { name: 'Reopen for editing' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reopen this report?' });
    await expect(dialog).toContainText('The shared link will be unavailable');
    await expect(dialog.getByRole('button', { name: 'Keep finalized' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open shared report' })).toHaveAttribute('href', originalLink!);

    await page.getByRole('button', { name: 'Reopen for editing' }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await dialog.getByRole('button', { name: 'Reopen for editing' }).click();
    await expect(page.getByRole('textbox', { name: 'Report (Markdown)' })).toHaveValue(/A useful trip\./);
    await expect(page.getByRole('status')).toContainText('Sharing is paused');
    await expect(page.getByRole('link', { name: 'Open shared report' })).toHaveCount(0);
    await page.evaluate(async () => {
      const { router } = await import('/tests/browser/fixture.tsx');
      await router.navigate('/reports/share-1');
    });
    await expect(page.getByRole('heading', { name: 'This report is unavailable.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reopen for editing' })).toHaveCount(0);

    await page.evaluate(async () => {
      const { router } = await import('/tests/browser/fixture.tsx');
      await router.navigate('/trips/trip-1');
    });
    await page.getByRole('tab', { name: 'Report', exact: true }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('textbox', { name: 'Report (Markdown)' }).fill('## Key takeaways\n\n- **Updated after reopening**.');
    await page.getByRole('button', { name: 'Save & finalize' }).click();
    await expect(page.getByRole('link', { name: 'Open shared report' })).toHaveAttribute('href', originalLink!);
    await page.getByRole('link', { name: 'Open shared report' }).click();
    await expect(page.getByText('Updated after reopening', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reopen for editing' })).toHaveCount(0);
  });
}
