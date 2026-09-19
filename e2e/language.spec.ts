import { test, expect } from '@playwright/test';
import { registerHousehold, uniqueEmail } from './helpers';

test('switching to Swedish translates the UI immediately and persists across a reload', async ({ page }) => {
  await registerHousehold(page, { name: 'Anders', email: uniqueEmail('lang') });

  await expect(page.getByRole('heading', { name: 'Your library' })).toBeVisible();

  await page.getByRole('button', { name: 'SV', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ditt bibliotek' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bibliotek' }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ditt bibliotek' })).toBeVisible();

  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your library' })).toBeVisible();
});

test('the register page itself can be switched to Swedish before signing up', async ({ page }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: 'SV', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Skapa ditt konto' })).toBeVisible();
  await expect(page.getByLabel('Ditt namn')).toBeVisible();
});
