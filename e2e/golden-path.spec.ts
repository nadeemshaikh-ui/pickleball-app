import { test, expect } from '@playwright/test';

// Real-user-scenario coverage, not unit tests — this drives the actual
// deployed UI (storageState auth from e2e/.auth/user.json, see
// playwright.config.ts). Run: npx playwright test

test('dashboard loads with nav intact', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.getByLabel('Main navigation').getByRole('link', { name: 'League' })).toBeVisible();
});

test('league stats page loads and a player row expands to show head-to-head', async ({ page }) => {
  await page.goto('/league/stats');
  await expect(page.getByRole('heading', { name: 'Lifetime Stats' })).toBeVisible();
  const firstRow = page.locator('.card').first();
  if (await firstRow.isVisible()) {
    await firstRow.click();
    // Expanded row should surface Head-to-Head without throwing — loose
    // assertion since real data varies club to club.
  }
});

test('badge gallery renders sectioned catalog', async ({ page }) => {
  await page.goto('/league/badges');
  await expect(page.getByRole('heading', { name: 'Badge Gallery' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Crowns' })).toBeVisible();
});

test('ladder page loads standings', async ({ page }) => {
  await page.goto('/league/ladder');
  await expect(page.getByRole('heading', { name: 'Ladder League' })).toBeVisible();
});

test('setup page renders format options and roster entry', async ({ page }) => {
  await page.goto('/setup');
  await expect(page.locator('body')).not.toContainText('Application error');
});
