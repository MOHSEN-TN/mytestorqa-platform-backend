import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.tunisianet.com.tn/panier?action=show');
  await page.getByText('Téléphonie & Tablette', { exact: true }).click();
  await page.getByRole('link', { name: 'Tablette Graphique' }).click();
  await page.getByRole('article').filter({ hasText: 'TABLETTE D\'ECRITURE ET DE DESSIN 12" LCD -VERT [TAB-LCD-VR] Tablette D\'ecriture' }).getByRole('button').click();
});