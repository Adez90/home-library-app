import { test, expect } from '@playwright/test';
import { registerHousehold, addBook, uniqueEmail } from './helpers';

test('a hunting book and a favorited author both show up on the wishlist page', async ({ page }) => {
  await registerHousehold(page, { name: 'Wishlist Reader', email: uniqueEmail('wishlist') });

  await addBook(page, { title: 'Hollow Court', author: 'Mira Voss' });
  await page.getByRole('button', { name: 'Hunting', exact: true }).click();
  await page.getByRole('button', { name: 'Favorite author' }).click();

  await page.goto('/wishlist');

  await expect(page.getByText('Hollow Court')).toBeVisible();
  await expect(page.getByText('Mira Voss', { exact: true })).toBeVisible();
  await expect(page.getByText('Favorite author')).toBeVisible();
});

test('removing a favorite takes it off the wishlist page', async ({ page }) => {
  await registerHousehold(page, { name: 'Unfavorite Reader', email: uniqueEmail('unfav') });
  await addBook(page, { title: 'The Quiet Atlas', author: 'H. Duval' });
  await page.getByRole('button', { name: 'Favorite author' }).click();

  await page.goto('/wishlist');
  await expect(page.getByText('H. Duval')).toBeVisible();

  await page.getByRole('button', { name: 'Remove favorite' }).click();
  await expect(page.getByText('H. Duval')).toHaveCount(0);
});

test('favoriting an author by name with no owned book shows up at zero owned', async ({ page }) => {
  await registerHousehold(page, { name: 'Look Ahead Reader', email: uniqueEmail('lookahead') });
  await page.goto('/wishlist');

  await page.getByLabel('Watch for something new').selectOption('author');
  await page.getByPlaceholder('Author or series name').fill('Brandon Sanderson');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(page.getByText('Brandon Sanderson')).toBeVisible();
  await expect(page.getByText('0 owned')).toBeVisible();
});

test('an author favorite\'s owned count updates live once a matching book is scanned in', async ({ page }) => {
  await registerHousehold(page, { name: 'Live Update Reader', email: uniqueEmail('live') });
  await page.goto('/wishlist');

  await page.getByLabel('Watch for something new').selectOption('author');
  await page.getByPlaceholder('Author or series name').fill('Mira Voss');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('0 owned')).toBeVisible();

  await addBook(page, { title: 'The Ember Road', author: 'Mira Voss' });

  await page.goto('/wishlist');
  await expect(page.getByText('1 owned')).toBeVisible();
});
