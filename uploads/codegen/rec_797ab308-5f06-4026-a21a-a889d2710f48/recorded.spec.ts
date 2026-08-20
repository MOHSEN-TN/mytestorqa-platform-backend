import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.sofrecom.com/');
  await page.getByRole('button', { name: 'Allow all' }).click();
  await page.getByRole('button', { name: 'Nos Marchés' }).click();
  await page.getByRole('textbox', { name: 'Recherche' }).click();
  await page.getByRole('textbox', { name: 'Recherche' }).fill('ismail');
  await page.getByRole('textbox', { name: 'Recherche' }).press('Enter');
});