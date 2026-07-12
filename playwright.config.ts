import { defineConfig, devices } from '@playwright/test';

// Auth is captured once via `npm run e2e:login` (real Google OAuth, done by a
// human) and reused from e2e/.auth/user.json for every run after — no OAuth
// flow repeated per test, no CI secrets needed for login itself.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://pickleball-app-two.vercel.app',
    trace: 'on-first-retry',
    storageState: 'e2e/.auth/user.json',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
