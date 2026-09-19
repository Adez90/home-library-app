import { test, expect } from '@playwright/test';
import { registerHousehold, addBook, uniqueEmail } from './helpers';

test('series completion counts a volume owned in any language once, with a working language filter', async ({
  page,
}) => {
  await registerHousehold(page, { name: 'Series Reader', email: uniqueEmail('series') });

  await addBook(page, { title: 'Book 1: The First Flame', author: 'Mira Voss', series: 'The Lantern Cycle', volume: 1, language: 'en' });
  await addBook(page, { title: 'Eldflamman', author: 'Mira Voss', series: 'The Lantern Cycle', volume: 1, language: 'sv' });
  await addBook(page, { title: 'Book 2: Ashfall', author: 'Mira Voss', series: 'The Lantern Cycle', volume: 2, language: 'en' });

  await page.goto('/series');
  await page.getByText('The Lantern Cycle').first().click();
  await page.waitForURL(/\/series\/.+/);

  await expect(page.getByText('2 of 2 owned')).toBeVisible();

  // Filter chip for a specific language (not the UI language switcher) — drills the
  // completion count down to just that edition.
  await page.getByRole('button', { name: 'sv', exact: true }).click();
  await expect(page.getByText('1 of 1 owned')).toBeVisible();

  await page.getByRole('button', { name: 'All languages' }).click();
  await expect(page.getByText('2 of 2 owned')).toBeVisible();
});

test('a series page appears in the series list once a series book is added', async ({ page }) => {
  await registerHousehold(page, { name: 'Series List Reader', email: uniqueEmail('serieslist') });
  await addBook(page, { title: 'Crown of Midnight', author: 'Sarah J. Maas', series: 'Throne of Glass', volume: 2 });

  await page.goto('/series');
  await expect(page.getByText('Throne of Glass')).toBeVisible();
});

test('owning only volume 28 infers the series has at least 28, and the total is editable', async ({ page }) => {
  await registerHousehold(page, { name: 'Manga Reader', email: uniqueEmail('manga') });
  await addBook(page, { title: 'One Piece, Vol. 28', author: 'Eiichiro Oda', series: 'One Piece', volume: 28 });

  await page.goto('/series');
  await page.getByText('One Piece').first().click();
  await page.waitForURL(/\/series\/.+/);

  // Nobody publishes volume 28 first — owning just that one still implies 28 volumes exist,
  // and the 27 unscanned ones show up as gaps to look for, not just a bare "1 of 28".
  await expect(page.getByText('1 of 28 owned')).toBeVisible();
  await expect(page.getByText('Missing')).toHaveCount(27);

  // Editable in case the inferred number is wrong, or the household knows the real count.
  await page.getByRole('button', { name: 'Set total volumes' }).click();
  await page.getByPlaceholder('Total volumes').fill('30');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('1 of 30 owned')).toBeVisible();

  await page.getByRole('button', { name: 'Edit total volumes' }).click();
  await page.getByRole('button', { name: 'Clear (infer from highest volume)' }).click();
  await expect(page.getByText('1 of 28 owned')).toBeVisible();
});
