import { test, expect } from '@playwright/test';

// Exact reproduction of the real reported bug (with a screenshot): League
// format selected, Stage Name field left blank, Generate Stage clicked.
// Root cause was the button being *disabled* for a blank name - a disabled
// button's onClick never fires, so the "name this stage" error (which
// existed) never had a chance to show. Not fixable by improving the error
// message; the button had to stop being disabled for this case.
test('Generate Stage with a blank name shows a real error, not silence', async ({ page }) => {
  await page.goto('/tournaments');
  await page.getByRole('button', { name: 'Create Tournament' }).click();
  await page.getByPlaceholder('Tournament name').fill('E2E Blank Name Test');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForURL(/\/tournaments\/[^/?]+$/, { timeout: 15000 });

  await page.getByRole('button', { name: /Auto-Pair All/ }).click();
  await expect(page.getByText(/Mystery Pair 1/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Generate Next Stage')).toBeVisible({ timeout: 10000 });

  // Leave Stage Name blank, League is the default format, click Generate.
  const generateButton = page.getByRole('button', { name: 'Generate Stage' });
  await expect(generateButton).toBeEnabled();
  await generateButton.click();

  await expect(page.getByText(/Name this stage before generating/).first()).toBeVisible({ timeout: 5000 });
});
