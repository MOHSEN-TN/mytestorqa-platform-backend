import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://tek-up.de/');
  await page.getByRole('img', { name: 'Close' }).click();
  await page.locator('#gk-main-menu').getByRole('link', { name: ' Home' }).click();
  await page.getByRole('img', { name: 'Close' }).click();
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'TEK-UP University Job Fair JET' }).click();
  const page1 = await page1Promise;
  await page1.getByRole('link', { name: 'Study & work (alternance)' }).click();
});