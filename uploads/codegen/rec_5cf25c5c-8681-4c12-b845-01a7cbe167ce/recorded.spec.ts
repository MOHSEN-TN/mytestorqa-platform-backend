import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.tunisianet.com.tn/');
  await page.getByRole('heading', { name: 'Tunisianet' }).getByRole('link').click();
  await page.getByText('Informatique', { exact: true }).click();
  await page.getByRole('link', { name: 'Pc de bureau', exact: true }).click();
  await page.getByRole('link', { name: 'Mini Pc de bureau BMAX B1 PRO / N4000 / 8GB 128SSD / Windows 11 / Noir', exact: true }).click();
});