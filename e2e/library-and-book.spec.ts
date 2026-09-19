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

test('bulk-selecting books removes all of them from the library at once', async ({ page }) => {
  await addBook(page, { title: 'The Glass Orchard', author: 'R. Petrov' });
  await addBook(page, { title: 'A Winter for Wolves', author: 'R. Petrov' });
  await page.goto('/library');
  await expect(page.getByText('The Glass Orchard').first()).toBeVisible();
  await expect(page.getByText('A Winter for Wolves').first()).toBeVisible();

  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('button', { name: /The Glass Orchard/ }).click();
  await page.getByRole('button', { name: /A Winter for Wolves/ }).click();
  await expect(page.getByText('2 selected')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Remove' }).click();

  await expect(page.getByText('The Glass Orchard')).toHaveCount(0);
  await expect(page.getByText('A Winter for Wolves')).toHaveCount(0);
});

test('canceling select mode leaves the library untouched', async ({ page }) => {
  await addBook(page, { title: 'The Last Lighthouse', author: 'M. Enge' });
  await page.goto('/library');

  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByRole('link', { name: /The Last Lighthouse/ })).toBeVisible();
});
