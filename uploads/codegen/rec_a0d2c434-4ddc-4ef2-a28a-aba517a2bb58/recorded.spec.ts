import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.w3schools.com/');
  await page.getByRole('link', { name: 'Home link' }).click();
  await page.goto('https://www.w3schools.com/');
  await page.getByRole('link', { name: 'Home link' }).click();
  await page.getByRole('button', { name: 'Sign in to your account' }).click();
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Google' }).click();
  const page1 = await page1Promise;
  await page1.getByRole('textbox', { name: 'Email or phone' }).click();
  await page1.getByRole('textbox', { name: 'Email or phone' }).fill('hhh');
  await page1.getByRole('button', { name: 'Next' }).click();
});