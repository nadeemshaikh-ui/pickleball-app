import { test, expect } from '@playwright/test';

// Real admin action not covered elsewhere: voiding a session (dedicated
// fixture, separate from the one route-smoke specs assert is "completed").

const VOID_SESSION_ID = 'e2e-void-fixture-session';

test('admin can void a session and the voided banner shows', async ({ page }) => {
  await page.goto(`/session/${VOID_SESSION_ID}/results`);
  await page.getByRole('button', { name: /Void Session/i }).click();
  // Void Session now opens an in-app ConfirmModal instead of a native dialog
  // — its Confirm button shares the trigger's accessible name, so scope to
  // the last match (the modal is appended after the trigger in the DOM).
  await page.getByRole('button', { name: 'Void Session', exact: true }).last().click();
  await expect(page.getByText(/this session was voided/i)).toBeVisible({ timeout: 10000 });
});
