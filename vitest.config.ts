import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

// lib/supabase.ts reads NEXT_PUBLIC_SUPABASE_URL/ANON_KEY from process.env
// at module load time. Next's dev/build commands load .env.local
// automatically; a bare `vitest run` does not, so any test file whose
// import chain reaches lib/supabase.ts fails with "supabaseUrl is
// required." This loads .env.local the same way Vite's own dev server
// does, so tests see the same env vars the app does.
export default defineConfig({
  test: {
    env: loadEnv('', process.cwd(), ''),
    // e2e/*.spec.ts are Playwright specs, not vitest — vitest's default
    // glob would otherwise pick them up and fail (different test API).
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
});
