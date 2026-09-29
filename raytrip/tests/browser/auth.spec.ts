import { expect, test } from '@playwright/test';

for (const width of [390, 768, 1280]) {
  test(`branded sign-in and retry keep the requested trip at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/tests/browser/index.html?scenario=auth&route=%2Ftrips%2Ftrip-1%3Ftab%3Dreport%23summary');
    await expect(page.getByRole('heading', { name: 'Sign in to Ray|Trip' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ray|Trip home' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
    await expect(page.getByText('Business travel reporting')).toBeVisible();
    const intro = await page.locator('.auth-intro').boundingBox();
    const card = await page.locator('.auth-card').boundingBox();
    if (width === 1280) expect(card!.x).toBeGreaterThan(intro!.x + intro!.width);
    else expect(card!.y).toBeGreaterThan(intro!.y + intro!.height);
    const button = page.getByRole('button', { name: 'Sign in with Microsoft' });
    const styles = await button.evaluate(element => ({
      background: getComputedStyle(element).backgroundColor,
      font: getComputedStyle(element).fontFamily,
      height: element.getBoundingClientRect().height,
    }));
    expect(styles.background).toBe('rgb(255, 107, 107)');
    expect(styles.font).toContain('IBM Plex Sans');
    if (width === 390) expect(styles.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`branded-sign-in-${width}.png`), fullPage: true });
    await button.click();
    await expect(page.getByRole('alert')).toHaveText('Sign-in canceled. Please try again.');
    await expect(page.getByRole('heading', { name: 'Sign in to Ray|Trip' })).toBeVisible();
    await button.click();
    await expect(page.getByRole('tab', { name: 'Notes & photos' })).toBeVisible();
    expect(await page.evaluate(async () => {
      const { router } = await import('/tests/browser/fixture.tsx');
      const { pathname, search, hash } = router.state.location;
      return `${pathname}${search}${hash}`;
    })).toBe('/trips/trip-1?tab=report#summary');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in to Ray|Trip' })).toBeVisible();
  });
}
