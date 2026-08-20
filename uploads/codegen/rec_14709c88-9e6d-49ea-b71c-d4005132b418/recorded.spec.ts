import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.fbi.gov/');
  await page.getByRole('searchbox', { name: 'Search FBI' }).click();
  await page.getByRole('searchbox', { name: 'Search FBI' }).fill('inves');
  await page.getByRole('button', { name: 'Submit search' }).click();
  await page.getByRole('link', { name: 'refresh this page' }).click();
  await page.locator('iframe[src="https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/zharn/0x4AAAAAAADnPIDROrmt1Wwj/light/fbE/new/normal?lang=auto"]').contentFrame().locator('body').click();
  await page.goto('https://www.fbi.gov/@@search?SearchableText=inves');
  await page.locator('iframe[src="https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/uu6qw/0x4AAAAAAADnPIDROrmt1Wwj/light/fbE/new/normal?lang=auto"]').contentFrame().locator('body').click();
  await page.goto('https://www.fbi.gov/@@search?SearchableText=inves');
  await page.locator('iframe[src="https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/eiii3/0x4AAAAAAADnPIDROrmt1Wwj/light/fbE/new/normal?lang=auto"]').contentFrame().locator('body').click();
  await page.goto('https://www.fbi.gov/@@search?SearchableText=inves');
});