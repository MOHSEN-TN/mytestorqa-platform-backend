import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.tunisianet.com.tn/');
  await page.getByRole('heading', { name: 'Tunisianet' }).getByRole('link').click();
  await page.goto('https://www.tunisianet.com.tn/');
  await page.getByText('Informatique', { exact: true }).click();
  await page.getByRole('link', { name: 'Pc de bureau', exact: true }).click();
  await page.getByRole('link', { name: 'Mini Pc de bureau BMAX B1 PRO / N4000 / 8GB 128SSD / Windows 11 / Noir', exact: true }).click();
  await page.getByText('La mini clé PC B1Pro dispose').click();
  await page.getByText('La mini clé PC B1Pro dispose').click();
  await expect(page.locator('#description')).toContainText('La mini clé PC B1Pro dispose d\'une connexion Wi-Fi double bande 2,4 G/5,0 G avec antenne externe, Bluetooth 4.2, le signal sans fil est plus fort et plus stable, et le travail en ligne est plus fluide. Bluetooth 4.2 prend en charge la connexion des appareils (clavier, souris, etc.) et répond plus rapidement aux commandes en cours d\'exécution.');
});