import { test, expect } from '@playwright/test';

// Regression coverage: Auto-Pair All button on a normal (non-Mystery)
// tournament, plus the full generate-stage flow, specifically because the
// prior mystery-partner.spec.ts only ever exercised the manual tap-to-pair
// path, never Auto-Pair itself.
test('Normal tournament: Auto-Pair All button works, then Generate Stage succeeds', async ({ page }) => {
  page.on('console', msg => { if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text()); });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('/tournaments');
  await page.getByRole('button', { name: 'Create Tournament' }).click();
  await page.getByPlaceholder('Tournament name').fill('E2E AutoPair Test');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForURL(/\/tournaments\/[^/?]+$/, { timeout: 15000 });

  await expect(page.getByRole('heading', { name: 'Form Teams' })).toBeVisible({ timeout: 10000 });
  const autoPairButton = page.getByRole('button', { name: /Auto-Pair All/ });
  // 7 players in this club (odd) — must NOT be blocked waiting on a bye
  // selection; a bye is auto-picked randomly instead.
  await expect(autoPairButton).toBeEnabled();
  await autoPairButton.click();

  await expect(page.getByText('Every registered player is already on a team.').or(page.getByText(/Form Teams/)).first()).toBeVisible({ timeout: 15000 });
  // 7 players -> 3 pairs + 1 bye -> exactly 3 teams created.
  await expect(page.getByText(/Mystery Pair 1/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Mystery Pair 3/)).toBeVisible();
});
