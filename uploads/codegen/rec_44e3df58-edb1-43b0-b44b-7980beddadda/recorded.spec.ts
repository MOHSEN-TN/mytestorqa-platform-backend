import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.speedtest.net/');
  await page.getByRole('link', { name: 'Speedtest', exact: true }).click();
  await page.goto('https://www.speedtest.net/');
  await page.getByRole('button', { name: 'start speed test - connection' }).click();
  await page.goto('https://www.speedtest.net/result/19421044671');
  await page.getByRole('link', { name: 'Speedtest', exact: true }).click();
});