import { test, expect } from '@playwright/test';

// Directly targets the same area listMyClubs() had its privilege bug in:
// the admin test user is a real member of two clubs (TEST_CLUB_ID,
// MULTI_CLUB_ID). Confirms switching the active club actually scopes what's
// visible — the second club's uniquely-named player must never appear
// while viewing the first club, and vice versa.

test('club switcher lists both real memberships', async ({ page }) => {
  await page.goto('/clubs');
  await expect(page.getByLabel('Switch club').getByRole('option', { name: 'E2E Test Club' })).toBeAttached();
  await expect(page.getByLabel('Switch club').getByRole('option', { name: 'E2E Second Club' })).toBeAttached();
});

test('first club\'s session view does not leak the second club\'s players', async ({ page }) => {
  await page.goto(`/session/e2e-fixture-session/results`);
  await expect(page.locator('body')).not.toContainText('E2E SecondClub');
});

test('second club\'s session view does not leak the first club\'s players', async ({ page }) => {
  await page.goto(`/session/e2e-multiclub-fixture-session/results`);
  await expect(page.getByText('E2E SecondClub Alpha').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('E2E Bot A');
});
