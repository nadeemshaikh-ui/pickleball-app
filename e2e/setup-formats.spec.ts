import { test, expect } from '@playwright/test';

// Remaining formats not covered by create-and-score-session.spec.ts
// (scramble) or setup-wizard.spec.ts (squad_rivalry) — drives each all the
// way through the real Setup wizard on default/auto settings, confirming
// generation actually succeeds for every format the app offers.

async function fillPlayersStep(page: import('@playwright/test').Page, courts: number, players: number, names: string[]) {
  await page.goto('/setup');
  await page.getByLabel('Number of courts').fill(String(courts));
  await page.getByLabel('Number of players').fill(String(players));
  await page.getByRole('button', { name: 'Next: Enter Names' }).click();
  for (let i = 0; i < names.length; i++) {
    await page.getByPlaceholder(`Player ${i + 1}`).fill(names[i]);
  }
  await page.getByRole('button', { name: 'Next: Format & Options' }).click();
}

test('fixed_partners can be generated end-to-end', async ({ page }) => {
  await fillPlayersStep(page, 1, 4, ['E2E FP One', 'E2E FP Two', 'E2E FP Three', 'E2E FP Four']);
  await page.getByLabel(/Fixed Partners/).check();
  await page.getByRole('button', { name: 'Next: Cost & Details' }).click();
  await page.getByRole('button', { name: 'Generate Schedule' }).click();
  await page.waitForURL(/\/session\/[^/]+\/schedule/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
});

test('court_blocks can be generated end-to-end', async ({ page }) => {
  await fillPlayersStep(page, 1, 4, ['E2E CB One', 'E2E CB Two', 'E2E CB Three', 'E2E CB Four']);
  await page.getByLabel(/Court Swap/).check();
  await page.getByRole('button', { name: 'Next: Cost & Details' }).click();
  await page.getByRole('button', { name: 'Generate Schedule' }).click();
  await page.waitForURL(/\/session\/[^/]+\/schedule/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
});

test('king_of_court can be generated end-to-end and routes straight to Play', async ({ page }) => {
  await fillPlayersStep(page, 1, 4, ['E2E KOTC One', 'E2E KOTC Two', 'E2E KOTC Three', 'E2E KOTC Four']);
  await page.getByLabel(/King of the Court/).check();
  await page.getByRole('button', { name: 'Next: Cost & Details' }).click();
  await page.getByRole('button', { name: 'Generate Schedule' }).click();
  // KOTC generates rounds live and skips Schedule — routes straight to Play.
  await page.waitForURL(/\/session\/[^/]+\/play/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Live Scoring' })).toBeVisible();
});
