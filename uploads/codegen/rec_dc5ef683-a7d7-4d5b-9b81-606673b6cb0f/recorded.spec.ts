import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.facebook.com/');
  await page.getByRole('textbox', { name: 'Email or mobile number' }).click();
  await page.getByRole('textbox', { name: 'Email or mobile number' }).fill('hhh');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Email or mobile number' }).fill('hhhh');
  await page.getByRole('textbox', { name: 'Password' }).fill('hh');
  await page.getByRole('button', { name: 'Log In' }).click();
});