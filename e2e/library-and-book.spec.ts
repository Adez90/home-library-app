import { test, expect } from '@playwright/test';
import { registerHousehold, addBook, uniqueEmail } from './helpers';

test.beforeEach(async ({ page }) => {
  await registerHousehold(page, { name: 'Reader', email: uniqueEmail('book') });
});

test('adding a book shows it in the library and its own detail page', async ({ page }) => {
  await addBook(page, { title: 'Coastal Noir', author: 'J. Alderman' });

  await expect(page.getByRole('heading', { name: 'Coastal Noir' })).toBeVisible();
  await expect(page.getByText('J. Alderman')).toBeVisible();

  await page.getByRole('link', { name: 'Back to library' }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByText('Coastal Noir').first()).toBeVisible();
});

test('changing status and saving a note persists after reload', async ({ page }) => {
  await addBook(page, { title: 'Nordic Tides', author: 'E. Sorensen' });
  const url = page.url();

  await page.getByRole('button', { name: 'Wishlist', exact: true }).click();
  await page.getByPlaceholder('Add a note…').fill('Found at the flea market');
  await page.getByPlaceholder('Add a note…').blur();
  await page.waitForTimeout(300);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Wishlist', exact: true })).toHaveClass(/bg-text/);
  await expect(page.getByPlaceholder('Add a note…')).toHaveValue('Found at the flea market');
  expect(page.url()).toBe(url);
});

test('removing a book takes it out of the library', async ({ page }) => {
  await addBook(page, { title: 'A Room of Ash', author: 'Nadia Krol' });

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove from library' }).click();

  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByText('A Room of Ash')).toHaveCount(0);
});

test('search filters the library grid', async ({ page }) => {
  await addBook(page, { title: 'Salt and Ember', author: 'T. Okafor' });
  await page.goto('/library');
  await page.getByPlaceholder('Search your books…').fill('Salt');
  await expect(page.getByText('Salt and Ember').first()).toBeVisible();

  await page.getByPlaceholder('Search your books…').fill('Nonexistent Title Xyz');
  await expect(page.getByText('Salt and Ember')).toHaveCount(0);
});
