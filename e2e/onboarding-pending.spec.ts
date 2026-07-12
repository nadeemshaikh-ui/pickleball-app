import { test, expect } from '@playwright/test';

// Dedicated club-less account with a real pending club_join_requests row
// (seeded by create-test-session.mjs) that nothing else ever approves —
// exercises the fix for the "request to join" dead end: Home should show a
// persistent pending banner, not silently funnel them into Setup with
// nowhere to go.

test.use({ storageState: 'e2e/.auth/pending.json' });

test('a club-less user with a pending join request sees a pending banner on Home, not a Setup dead-end', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/is pending/i)).toBeVisible();

  await page.goto('/setup');
  await expect(page.getByText(/Join or create a club/i)).toBeVisible();
});
