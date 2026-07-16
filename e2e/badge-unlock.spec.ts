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

  // The expanded row's Personal Bests section shows a "Best streak" value —
  // this test previously checked for "longest-ever win streak" text that
  // doesn't exist anywhere on the page (stale copy — app/league/stats/
  // page.tsx:421 has always said "Best streak", never that phrase).
  //
  // Asserts >= 5, not exactly 5: E2E Tester's real cumulative streak across
  // every fixture this suite seeds (not just the dedicated 5-win streak
  // session) is currently 7 — other fixtures also give this player wins, so
  // hardcoding "5" would break again the next time any fixture changes.
  // What actually matters is proving hot_streak_5 is earnable (>=5), not
  // pinning an incidental cumulative total.
  //
  // getByText(exact: true) finds the small label div itself precisely — a
  // substring `.filter({ hasText })` on 'div' matches every ancestor whose
  // concatenated text happens to contain "Best streak" too (the whole
  // stats-grid container, the card, etc.), which is how the previous
  // attempt at this fix grabbed the wrong, much-larger element.
  const bestStreakLabel = row.getByText('Best streak', { exact: true });
  await expect(bestStreakLabel).toBeVisible();
  const containerText = await bestStreakLabel.locator('..').innerText();
  const bestStreak = Number(containerText.replace('Best streak', '').trim());
  expect(bestStreak).toBeGreaterThanOrEqual(5);
});

test('badge gallery marks Hot Streak as earned, not locked', async ({ page }) => {
  await page.goto('/league/badges');
  await expect(page.getByRole('heading', { name: 'Badge Gallery' })).toBeVisible();
  const hotStreakCard = page.locator('.card').filter({ hasText: 'Hot Streak' });
  await expect(hotStreakCard).toBeVisible();
  const opacity = await hotStreakCard.evaluate(el => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBeGreaterThan(0.9); // earned badges render full-opacity, locked ones dim to 0.4
});

// Real gap this session: the badge gallery gained 3 new sections
// (Crowns, Trajectory, and the 10 dedication/calendar badges added to
// Dedication & Calendar) that the E2E suite never actually loaded on a
// live page — only lib/badgeGallerySections.test.ts checked the section
// data was well-formed, not that it renders. This confirms the live page.
test('badge gallery renders the Crowns, Dedication & Calendar, and Trajectory sections', async ({ page }) => {
  await page.goto('/league/badges');
  await expect(page.getByRole('heading', { name: 'Badge Gallery' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Crowns' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dedication & Calendar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trajectory' })).toBeVisible();
});
