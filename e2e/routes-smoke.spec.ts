import { test, expect } from '@playwright/test';

// Broad route coverage — every remaining page not hit by golden-path.spec.ts,
// against the real live app with the automated test session. Loose
// assertions (no crash / no error boundary / expected heading present) since
// the goal here is breadth: catch a page that 500s or renders blank, not
// verify every pixel. Deep interaction flows (Setup wizard, scoring, badge
// unlocks) are a separate, more expensive follow-up once this baseline holds.

const TEST_SESSION_ID = 'e2e-fixture-session';

test('league home page loads', async ({ page }) => {
  await page.goto('/league');
  await expect(page.getByRole('heading', { name: 'League' })).toBeVisible();
});

test('league wrapped page loads without crashing', async ({ page }) => {
  await page.goto('/league/wrapped');
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('session history page loads', async ({ page }) => {
  await page.goto('/league/sessions');
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('clubs list page loads', async ({ page }) => {
  await page.goto('/clubs');
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('register/profile page loads', async ({ page }) => {
  await page.goto('/register');
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('session results page renders the seeded fixture session', async ({ page }) => {
  await page.goto(`/session/${TEST_SESSION_ID}/results`);
  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.getByText('E2E Tester').first()).toBeVisible();
});

test('session schedule page renders the seeded fixture session', async ({ page }) => {
  await page.goto(`/session/${TEST_SESSION_ID}/schedule`);
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('session leaderboard page renders', async ({ page }) => {
  await page.goto(`/session/${TEST_SESSION_ID}/leaderboard`);
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('session analytics page renders', async ({ page }) => {
  await page.goto(`/session/${TEST_SESSION_ID}/analytics`);
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('my dues page loads and shows a net total', async ({ page }) => {
  await page.goto('/league/dues');
  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.getByText('Total you owe')).toBeVisible();
});

test('admin page correctly denies a non-super-admin test user', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText('Not authorized.')).toBeVisible();
});
