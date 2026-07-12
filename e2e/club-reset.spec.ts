import { test, expect } from '@playwright/test';

// Tests the Danger Zone reset button built this session (lib/clubs.ts
// resetClubData + reset_club_data RPC) against an isolated throwaway club
// (e2e-reset-fixture-session in RESET_TEST_CLUB_ID) — never the shared
// TEST_CLUB_ID fixtures every other spec depends on.

const RESET_CLUB_ID = '00000000-0000-0000-0000-0000000000e3';

test('reset button clears the isolated test club\'s session data', async ({ page }) => {
  await page.goto(`/clubs/${RESET_CLUB_ID}/settings`);
  await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible();

  // Reset now opens an in-app ConfirmModal with a type-to-confirm text
  // field instead of a native window.prompt.
  await page.getByRole('button', { name: /Reset All Club Data/i }).click();
  await page.getByLabel('Confirmation text').fill('E2E Reset Test Club');
  await page.getByRole('button', { name: 'Reset Club Data' }).click();

  await expect(page.getByText(/Club data reset/i)).toBeVisible({ timeout: 10000 });
  // DB-level confirmation that data actually deleted (not just a success
  // message) happens separately via Supabase — the signed-in test admin's
  // currentClubId points at the main test club, not this one, so a UI
  // re-check here would silently pass either way.
});
