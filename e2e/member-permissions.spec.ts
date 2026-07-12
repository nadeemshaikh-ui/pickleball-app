import { test, expect } from '@playwright/test';

// Real second identity — e2e-member@pickleball.test, a non-admin member of
// the same test club (see e2e/setup/create-test-session.mjs). Confirms the
// permission boundary that matters most: a regular member cannot reach or
// act on admin-only surfaces, not just "the button is hidden."

test.use({ storageState: 'e2e/.auth/member.json' });

test('member does not see admin-only nav item', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByLabel('Main navigation');
  await expect(nav.getByRole('link', { name: 'Admin' })).not.toBeVisible();
});

test('member is blocked from club settings page content', async ({ page }) => {
  await page.goto('/clubs/00000000-0000-0000-0000-0000000000e2/settings');
  // The settings page itself explicitly gates non-admins with this message
  // (app/clubs/[id]/settings/page.tsx) rather than a blank/broken page.
  await expect(page.getByText(/only this club.s admin can view settings/i)).toBeVisible();
});

test('member cannot see the Refresh Stats admin control on League page', async ({ page }) => {
  await page.goto('/league');
  await expect(page.getByRole('button', { name: /Refresh Stats Now/i })).not.toBeVisible();
});
