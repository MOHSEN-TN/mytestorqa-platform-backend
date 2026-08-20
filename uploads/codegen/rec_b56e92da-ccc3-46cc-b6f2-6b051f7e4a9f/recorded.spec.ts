import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.w3schools.com/');
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Home link' }).click();
  const page1 = await page1Promise;
  await page.goto('https://www.w3schools.com/');
  await page1.getByRole('textbox', { name: 'Password' }).click();
  await page1.getByRole('textbox', { name: 'Password' }).fill('brother');
  await page1.getByRole('button', { name: 'Log In' }).click();
});