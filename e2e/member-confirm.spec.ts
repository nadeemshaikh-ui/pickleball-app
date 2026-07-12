import { test, expect } from '@playwright/test';

// Member confirms they played a real session (session_confirmations —
// anti-fraud gate for self-created sessions). Runs as the admin identity
// since e2e-test@pickleball.test ("E2E Tester") is the participant seeded
// into this fixture, not the separate member account.

const CONFIRM_SESSION_ID = 'e2e-confirm-fixture-session';

test('player confirms they played a session', async ({ page }) => {
  await page.goto(`/session/${CONFIRM_SESSION_ID}/results`);
  const confirmButton = page.getByRole('button', { name: /Yes, I played this/i });
  await expect(confirmButton).toBeVisible();

  // Celebration overlay can appear/animate in asynchronously after load —
  // dismiss it right before clicking, not just once at page load.
  const celebration = page.getByLabel('Dismiss celebration');
  for (let i = 0; i < 5 && (await celebration.isVisible().catch(() => false)); i++) {
    await celebration.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }

  await confirmButton.click({ force: true });
  await expect(page.getByText(/1\/4 players confirmed/i)).toBeVisible({ timeout: 10000 });
});
