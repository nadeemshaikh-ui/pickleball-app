import { test, expect } from '@playwright/test';

// Regression coverage for real bugs found live-testing Mystery Partner
// (2026-07-19):
// 1. Team name was a required field — real friction at 10-20+ teams.
// 2. Generate Stage silently did nothing with 3 teams split into 2 groups —
//    an unavoidable 1-team group made the shared round-robin generator
//    throw deep inside generateGroupFixtures, with no pre-flight check and
//    no visible error (Generate Stage was never disabled for this case).
//    Fixed in components/tournaments/StageWizard.tsx: previewText now
//    carries an isError flag that both shows a clear message and disables
//    Generate Stage before the click, instead of failing silently after.

test('Mystery Partner: optional team names, blocks an invalid group split, generates a valid one', async ({ page }) => {
  await page.goto('/tournaments');
  await page.getByRole('button', { name: 'Start Mystery Partner' }).click();
  await page.waitForURL(/\/tournaments\/[^/]+\?mystery=1/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Step 1: Teams' })).toBeVisible();

  // Explicit Automatic/Manual choice, then manual mode's sequential
  // tap-2-players-per-team flow — no team name field.
  await page.getByRole('button', { name: 'Manual' }).click();
  const players = ['E2E Ladder A', 'E2E Ladder B', 'E2E Ladder C', 'E2E Ladder D', 'E2E Member', 'E2E Requester'];
  for (let i = 0; i < players.length; i += 2) {
    await page.getByRole('heading', { name: `Team ${i / 2 + 1}: pick 2 players` }).waitFor();
    await page.getByRole('button', { name: players[i], exact: true }).click();
    await page.getByRole('button', { name: players[i + 1], exact: true }).click();
    await expect(page.getByText(`Team ${i / 2 + 1}`).first()).toBeVisible({ timeout: 10000 });
  }

  // Bug #2, reproduced exactly: 3 teams, default 2 groups -> one group of 1.
  await page.getByRole('button', { name: /^Groups/ }).click();
  await page.getByPlaceholder(/Stage name/).fill('Group Stage');
  await expect(page.getByText(/leaves a group of just 1/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Generate Stage' })).toBeDisabled();

  // Switch to League (no group-size constraint) with the same 3 teams —
  // proves generation genuinely works now, not just that bad configs are
  // blocked.
  await page.getByRole('button', { name: /^League/ }).click();
  await expect(page.getByRole('button', { name: 'Generate Stage' })).toBeEnabled();
  await page.getByRole('button', { name: 'Generate Stage' }).click();

  await expect(page.getByText('No stages yet.')).not.toBeVisible({ timeout: 15000 });
  await expect(page.locator('a', { hasText: 'Group Stage' })).toBeVisible();
});
