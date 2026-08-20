import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.w3schools.com/');
  await page.getByRole('link', { name: 'SQL', exact: true }).click();
  await page.locator('.w3-code').click();
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Try it Yourself »' }).click();
  const page1 = await page1Promise;
  await page1.locator('pre').nth(1).click();
  await page1.getByText('Customers;', { exact: true }).click();
  await page1.locator('pre').nth(1).click();
  await page1.getByRole('textbox').fill('println()');
});