import { test, expect } from '@playwright/test';

// Uses the member fixture (already onboarded, matches member-permissions.spec.ts)
// rather than the default user.json — that session gets stuck re-showing
// the profile onboarding step on every /setup visit in this environment,
// an unrelated pre-existing fixture issue.
test.use({ storageState: 'e2e/.auth/member.json' });

// End-to-end coverage for the Team Championship format (see memory
// project_pickleball_team_championship_plan): create a session with 2
// manually-split teams, generate suggested round pairings, and confirm the
// results page renders a stage-weighted breakdown. Minimal 4-player roster
// (2 per team, 1 court) — enough to exercise every code path
// (team-split, generation reusing lib/squads.ts at N=2, results
// computation) without needing a full 20-player tournament.

test('Team Championship: create, split teams, generate pairings, view results', async ({ page }) => {
  await page.goto('/setup');

  await page.getByLabel('Number of courts').fill('1');
  await page.getByLabel('Number of players').fill('4');
  await page.getByRole('button', { name: 'Next: Enter Names' }).click();

  const names = ['E2E TC One', 'E2E TC Two', 'E2E TC Three', 'E2E TC Four'];
  for (let i = 0; i < names.length; i++) {
    await page.getByPlaceholder(`Player ${i + 1}`).fill(names[i]);
  }

  await page.getByRole('button', { name: 'Next: Format & Options' }).click();
  await page.getByLabel(/Team Championship/).check();

  // Split into 2 teams of 2 by tapping each chip the right number of times:
  // Unassigned -> Team 1 (1 tap) -> Team 2 (2 taps).
  await page.getByRole('button', { name: 'E2E TC One' }).click();
  await page.getByRole('button', { name: 'E2E TC Two' }).click();
  await page.getByRole('button', { name: 'E2E TC Three' }).click();
  await page.getByRole('button', { name: 'E2E TC Three' }).click();
  await page.getByRole('button', { name: 'E2E TC Four' }).click();
  await page.getByRole('button', { name: 'E2E TC Four' }).click();

  // Reduce the default stage to 2 rounds so generation is fast.
  await page.locator('input[aria-label="Stage 1 name"]').fill('Session 1');
  const roundsInput = page.locator('label:has-text("Rounds") input[type="number"]').first();
  await roundsInput.fill('2');

  await page.getByRole('button', { name: 'Next: Cost & Details' }).click();
  await page.getByRole('button', { name: 'Generate Schedule' }).click();

  await page.waitForURL(/\/session\/[^/]+\/schedule/, { timeout: 15000 });
  const sessionUrl = page.url();
  const sessionId = sessionUrl.match(/\/session\/([^/]+)\//)?.[1];
  expect(sessionId).toBeTruthy();

  await page.goto(`/session/${sessionId}/team-championship/pairings`);
  await expect(page.getByRole('heading', { name: 'Round Pairings' })).toBeVisible();
  await page.getByRole('button', { name: 'Generate Suggested Pairings' }).click();
  await expect(page.getByText('Round 1 · Court 1')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Round 2 · Court 1')).toBeVisible();

  await page.goto(`/session/${sessionId}/team-championship/results`);
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await expect(page.getByText('Session 1')).toBeVisible();
  await expect(page.getByText(/League total/)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Total', exact: true })).toBeVisible();
});
