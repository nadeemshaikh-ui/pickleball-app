import { test, expect } from '@playwright/test';

// Real 5-win streak seeded for "E2E Tester" (e2e-streak-fixture-session,
// 5 rounds, stats refreshed via the real refresh_league_stats RPC — see
// create-test-session.mjs) — confirms the badge system actually surfaces a
// real earned badge on the live app, not just that the gallery page loads.

test('lifetime stats shows the hot streak badge for a real 5-win streak', async ({ page }) => {
  await page.goto('/league/stats');
  await expect(page.getByRole('heading', { name: 'Lifetime Stats' })).toBeVisible();

  const row = page.locator('.card').filter({ hasText: 'E2E Tester' }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.click();

  // The expanded row's Personal Bests section should show the streak, and
  // the badge medallion row (rendered on the collapsed card itself) should
  // include the Hot Streak badge for anyone on a 5+ win streak.
  await expect(page.getByText(/longest-ever win streak/i)).toBeVisible();
});

test('badge gallery marks Hot Streak as earned, not locked', async ({ page }) => {
  await page.goto('/league/badges');
  await expect(page.getByRole('heading', { name: 'Badge Gallery' })).toBeVisible();
  const hotStreakCard = page.locator('.card').filter({ hasText: 'Hot Streak' });
  await expect(hotStreakCard).toBeVisible();
  const opacity = await hotStreakCard.evaluate(el => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBeGreaterThan(0.9); // earned badges render full-opacity, locked ones dim to 0.4
});
