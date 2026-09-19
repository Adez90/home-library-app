import { test, expect } from '@playwright/test';
import { registerHousehold, uniqueEmail } from './helpers';

test('registering creates a household and lands on the library', async ({ page }) => {
  const email = uniqueEmail('auth-register');
  await registerHousehold(page, { name: 'Anders', email, householdName: "Anders's library" });

  await expect(page).toHaveURL(/\/library/);
  await expect(page.getByText("Anders's library")).toBeVisible();
});

test('visiting a protected page while logged out redirects to login', async ({ page }) => {
  await page.goto('/library');
  await expect(page).toHaveURL(/\/login/);
});

test('logs in with the right password and rejects the wrong one', async ({ page }) => {
  const email = uniqueEmail('auth-login');
  await registerHousehold(page, { name: 'Login Test', email });
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Invalid email or password')).toBeVisible();

  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/library/);
});

test('a second person joins the same household with the invite code', async ({ page }) => {
  const ownerEmail = uniqueEmail('auth-owner');
  await registerHousehold(page, { name: 'Owner', email: ownerEmail, householdName: 'Shared library' });

  await page.getByRole('button', { name: 'Shared library' }).click();
  const inviteCode = await page.locator('code').innerText();

  await page.getByRole('button', { name: 'Log out' }).click();

  const joinerEmail = uniqueEmail('auth-joiner');
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Joiner');
  await page.getByLabel('Email').fill(joinerEmail);
  await page.getByLabel('Password').fill('password123');
  await page.getByLabel('I have an invite code').check();
  await page.getByLabel('Invite code', { exact: true }).fill(inviteCode);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/library/);
  await expect(page.getByText('Shared library')).toBeVisible();
});

test('the invite code is visible and copyable from the household menu', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await registerHousehold(page, { name: 'Code Reader', email: uniqueEmail('auth-code'), householdName: "Code Reader's library" });

  await expect(page.getByText('Invite code')).toHaveCount(0);
  await page.getByRole('button', { name: "Code Reader's library" }).click();
  await expect(page.getByText('Invite code')).toBeVisible();

  const code = await page.locator('code').innerText();
  expect(code.length).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Copy' }).click();
  await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toBe(code);
});
