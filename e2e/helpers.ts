import type { Page } from '@playwright/test';

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

export async function registerHousehold(
  page: Page,
  opts: { name: string; email: string; password?: string; householdName?: string },
) {
  await page.goto('/register');
  await page.getByLabel('Your name').fill(opts.name);
  await page.getByLabel('Email').fill(opts.email);
  await page.getByLabel('Password').fill(opts.password ?? 'password123');
  if (opts.householdName) {
    await page.getByLabel(/Household name/).fill(opts.householdName);
  }
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/library/);
}

export async function addBook(
  page: Page,
  opts: { title: string; author?: string; series?: string; volume?: number; language?: string; format?: string },
) {
  await page.goto('/add');
  await page.getByLabel(/^Title/).fill(opts.title);
  if (opts.author) await page.getByLabel(/^Author/).fill(opts.author);
  if (opts.language) await page.getByLabel(/^Language/).fill(opts.language);
  if (opts.format) await page.getByLabel(/^Format/).fill(opts.format);
  if (opts.series) {
    await page.getByRole('button', { name: '+ Add series info' }).click();
    await page.getByLabel(/^Series/).fill(opts.series);
    await page.getByLabel('Book #').fill(String(opts.volume ?? 1));
  }
  await page.getByRole('button', { name: 'Add to library' }).click();
  await page.waitForURL(/\/library\/.+/);
}
