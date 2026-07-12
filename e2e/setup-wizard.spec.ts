import { test, expect } from '@playwright/test';

// Setup was split into 3 screens this session (Players -> Format & Options
// -> Cost & Details). create-and-score-session.spec.ts covers the scramble
// forward-path only — this covers the Back button and a second format
// (squad_rivalry) driven all the way through.

test('Back button returns to Players, and squad_rivalry can be generated end-to-end', async ({ page }) => {
  await page.goto('/setup');

  await page.getByLabel('Number of courts').fill('1');
  await page.getByLabel('Number of players').fill('4');
  await page.getByRole('button', { name: 'Next: Enter Names' }).click();

  const names = ['E2E Wizard One', 'E2E Wizard Two', 'E2E Wizard Three', 'E2E Wizard Four'];
  for (let i = 0; i < names.length; i++) {
    await page.getByPlaceholder(`Player ${i + 1}`).fill(names[i]);
  }

  await page.getByRole('button', { name: 'Next: Format & Options' }).click();
  await expect(page.getByRole('heading', { name: 'Ladder League (optional)' })).toBeVisible();

  // Back returns to the Players screen, not all the way to court/player count.
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByRole('heading', { name: 'Players (4)' })).toBeVisible();

  await page.getByRole('button', { name: 'Next: Format & Options' }).click();
  await page.getByLabel(/Squad Rivalry/).check();
  await page.getByRole('button', { name: 'Next: Cost & Details' }).click();
  await page.getByRole('button', { name: 'Generate Schedule' }).click();

  await page.waitForURL(/\/session\/[^/]+\/schedule/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
});
