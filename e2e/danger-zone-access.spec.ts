import { test, expect } from '@playwright/test';

// TEST_EMAIL is admin of NO_DZ_CLUB_ID but explicitly lacks
// danger_zone_access (seeded false, distinct from every other club where
// this admin has it) — negative-case coverage for the toggle built this
// session. The granted/positive case is already covered by
// club-reset.spec.ts against RESET_TEST_CLUB_ID.

const NO_DZ_CLUB_ID = '00000000-0000-0000-0000-0000000000e6';

test('an admin without Danger Zone access cannot see the reset button', async ({ page }) => {
  await page.goto(`/clubs/${NO_DZ_CLUB_ID}/settings`);
  await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible();
  await expect(page.getByText(/don't have Danger Zone access/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Reset All Club Data/i })).not.toBeVisible();
});
