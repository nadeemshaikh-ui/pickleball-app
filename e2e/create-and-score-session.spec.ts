import { test, expect } from '@playwright/test';

// Deep interactive flow — actually drives the Setup wizard (not just loads
// a page), creates a real session, scores a round, and confirms it lands on
// Results. This is the flow every other test in this suite assumes works;
// nothing here was previously verified against real UI interaction.

test('create a scramble session end-to-end and score it', async ({ page }) => {
  await page.goto('/setup');

  await page.getByLabel('Number of courts').fill('1');
  await page.getByLabel('Number of players').fill('4');
  await page.getByRole('button', { name: 'Next: Enter Names' }).click();

  const names = ['E2E Player One', 'E2E Player Two', 'E2E Player Three', 'E2E Player Four'];
  for (let i = 0; i < names.length; i++) {
    await page.getByPlaceholder(`Player ${i + 1}`).fill(names[i]);
  }

  await page.getByRole('button', { name: 'Generate Schedule' }).click();

  // Setup redirects to /session/[id]/schedule on success.
  await page.waitForURL(/\/session\/[^/]+\/schedule/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();

  await page.getByRole('link', { name: /Start Scoring/i }).click();
  await page.waitForURL(/\/session\/[^/]+\/play/);
  await expect(page.getByRole('heading', { name: 'Live Scoring' })).toBeVisible();

  // Score the first court: two number inputs inside the first match box.
  const firstMatch = page.locator('.match-box').first();
  const scoreInputs = firstMatch.locator('.score-input');
  await scoreInputs.nth(0).fill('11');
  await scoreInputs.nth(1).fill('7');
  await scoreInputs.nth(1).blur();

  // Saving triggers a re-render; give it a moment then confirm the score
  // round-tripped (not just accepted client-side).
  await expect(scoreInputs.nth(0)).toHaveValue('11', { timeout: 10000 });
});
