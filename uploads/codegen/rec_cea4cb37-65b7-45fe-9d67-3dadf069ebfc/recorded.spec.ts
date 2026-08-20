import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.tunisianet.com.tn/');
  await page.getByText('Informatique', { exact: true }).click();
  await page.getByRole('link', { name: 'Ecran', exact: true }).click();
  await page.getByRole('link', { name: 'Écran Enter ECR-MO-A012 19" HD / VGA / HDMI / 75 Hz', exact: true }).click();
  await page.getByRole('button').nth(1).click();
  await page.getByRole('button', { name: 'Ajouter au panier' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
});