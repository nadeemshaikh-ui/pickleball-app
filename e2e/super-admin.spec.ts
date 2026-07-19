import { test, expect } from '@playwright/test';

// Requester account is granted super_admin by create-test-session.mjs —
// positive-case coverage for /admin (routes-smoke.spec.ts only covers the
// denied case, using the regular TEST_EMAIL admin who isn't a super admin).

test.use({ storageState: 'e2e/.auth/requester.json' });

test('a super admin sees the all-clubs list on /admin', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: /^All Clubs/ })).toBeVisible();
  await expect(page.getByText('E2E Test Club')).toBeVisible();
});
