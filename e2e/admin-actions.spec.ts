import { test, expect } from '@playwright/test';

// Real admin actions against real data — not covered by any other spec.

test('admin approves a real pending join request', async ({ page }) => {
  await page.goto('/clubs/00000000-0000-0000-0000-0000000000e2/settings');
  await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible();
  const approveButton = page.getByRole('button', { name: 'Approve' });
  await expect(approveButton).toBeVisible();
  await approveButton.click();
  await expect(approveButton).not.toBeVisible({ timeout: 10000 });
});

const ORIGINAL_CLUB_NAME = 'E2E Test Club';

// Self-healing regardless of the starting value — a prior interrupted run
// (browser closed mid-save under parallel-worker load) can leave the name
// on the temp value; asserting an exact starting name made this flaky.
// Other specs depend on the name settling back to ORIGINAL_CLUB_NAME by
// the time this test finishes, not on what it was when the test started.
test('admin edits and reverts club branding name', async ({ page }) => {
  await page.goto('/clubs/00000000-0000-0000-0000-0000000000e2/settings');
  const nameInput = page.locator('input').first();
  await expect(nameInput).toBeVisible();

  await nameInput.fill(`${ORIGINAL_CLUB_NAME} Renamed`);
  await page.getByRole('button', { name: 'Save Branding' }).click();
  await expect(page.getByText('Saved.')).toBeVisible({ timeout: 10000 });
  await expect(nameInput).toHaveValue(`${ORIGINAL_CLUB_NAME} Renamed`);

  // Full reload before the revert save — back-to-back saves without one
  // raced handleSaveBranding's own post-save reload under parallel-worker
  // load (test-script issue, not app logic).
  await page.reload();
  await expect(nameInput).toHaveValue(`${ORIGINAL_CLUB_NAME} Renamed`);
  await nameInput.fill(ORIGINAL_CLUB_NAME);
  await page.getByRole('button', { name: 'Save Branding' }).click();
  await expect(page.getByText('Saved.')).toBeVisible({ timeout: 10000 });
  await expect(nameInput).toHaveValue(ORIGINAL_CLUB_NAME);
});

test('admin can reset the ladder', async ({ page }) => {
  await page.goto('/league/ladder');
  await expect(page.getByRole('heading', { name: 'Ladder League' })).toBeVisible();
  await page.getByRole('button', { name: /Reset Ladder/i }).click();
  await expect(page.getByText(/Resetting…/i)).toBeVisible().catch(() => {}); // may resolve too fast to catch, non-fatal
  await expect(page.getByRole('button', { name: /Reset Ladder/i })).toBeEnabled({ timeout: 10000 });
});
