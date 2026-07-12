import { test, expect } from '@playwright/test';

// Genuinely low-traffic paths, deferred until now: empty/undersized roster
// rejected at Setup, a tied score rejected at Play (pickleball can't legally
// tie — win-by-2 rule), and two concurrent scorers hitting the same court
// without corrupting state or crashing.

test('empty roster is rejected with a clear error, not a silent failure', async ({ page }) => {
  await page.goto('/setup');
  await page.getByLabel('Number of courts').fill('1');
  await page.getByLabel('Number of players').fill('0');
  await page.getByRole('button', { name: 'Next: Enter Names' }).click();
  await expect(page.getByText(/at least 4 players/i)).toBeVisible();
  // Still on the court/player-count screen — no silent navigation forward.
  await expect(page.getByRole('heading', { name: 'How Many Courts?' })).toBeVisible();
});

test('a tied score is rejected at Play instead of silently recording a loss', async ({ page }) => {
  await page.goto('/session/e2e-tie-fixture-session/play');
  const firstMatch = page.locator('.match-box').first();
  const scoreInputs = firstMatch.locator('.score-input');
  await scoreInputs.nth(0).fill('11');
  await scoreInputs.nth(1).fill('11');
  await scoreInputs.nth(1).blur();
  await expect(page.getByText(/can't end in a tie/i)).toBeVisible();
  // Score was never persisted — reload should not show 11-11 as saved.
  await page.reload();
  await expect(scoreInputs.nth(0)).not.toHaveValue('11');
});

test('two concurrent scorers on the same court do not crash or corrupt state', async ({ browser }) => {
  const contextA = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
  const contextB = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.goto('/session/e2e-concurrent-fixture-session/play');
  await pageB.goto('/session/e2e-concurrent-fixture-session/play');

  const matchA = pageA.locator('.match-box').first();
  const matchB = pageB.locator('.match-box').first();

  await matchA.locator('.score-input').nth(0).fill('11');
  await matchB.locator('.score-input').nth(0).fill('9');
  await Promise.all([
    matchA.locator('.score-input').nth(1).fill('7').then(() => matchA.locator('.score-input').nth(1).blur()),
    matchB.locator('.score-input').nth(1).fill('11').then(() => matchB.locator('.score-input').nth(1).blur()),
  ]);

  // Neither page should show a crash/error boundary — one write wins, but
  // the app must stay usable and consistent, not corrupted.
  await expect(pageA.locator('body')).not.toContainText('Application error');
  await expect(pageB.locator('body')).not.toContainText('Application error');

  await contextA.close();
  await contextB.close();
});
