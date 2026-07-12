import { test, expect } from '@playwright/test';

// Real admin action not covered elsewhere: voiding a session (dedicated
// fixture, separate from the one route-smoke specs assert is "completed").

const VOID_SESSION_ID = 'e2e-void-fixture-session';

test('admin can void a session and the voided banner shows', async ({ page }) => {
  await page.goto(`/session/${VOID_SESSION_ID}/results`);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /Void Session/i }).click();
  await expect(page.getByText(/this session was voided/i)).toBeVisible({ timeout: 10000 });
});
