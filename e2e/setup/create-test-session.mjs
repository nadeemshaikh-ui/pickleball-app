// Mints a real, working login session for Playwright to reuse — without
// ever touching Google OAuth (which blocks automation-controlled browsers,
// see e2e/README.md). Creates/reuses ONE dedicated test account + a
// throwaway test club, signs in via Supabase's own email+password auth
// (a parallel auth path this project's real users never use — Google OAuth
// stays the only sign-in method visible in the app UI), and writes the
// resulting session straight into Playwright's storageState format.
//
// Usage: node e2e/setup/create-test-session.mjs
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (never used by the app
// itself, only this script — see the comment above that line in .env.local).

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

// Minimal .env.local parse — no dotenv dependency needed for a one-off script.
for (const line of readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local — see the comment above that line for where to get it.');
  process.exit(1);
}

const TEST_EMAIL = 'e2e-test@pickleball.test';
const TEST_PASSWORD = 'E2E-test-password-' + SUPABASE_URL.split('.')[0].slice(-8); // deterministic, not secret-sensitive (test account only)
const TEST_CLUB_ID = '00000000-0000-0000-0000-0000000000e2';
const TEST_CLUB_NAME = 'E2E Test Club';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function ensureTestUser() {
  const { data: existing } = await admin.auth.admin.listUsers();
  const found = existing?.users?.find(u => u.email === TEST_EMAIL);
  if (found) return found;
  const { data, error } = await admin.auth.admin.createUser({ email: TEST_EMAIL, password: TEST_PASSWORD, email_confirm: true });
  if (error) throw error;
  return data.user;
}

async function ensureTestClub(userId) {
  const { data: existing } = await admin.from('clubs').select('id').eq('id', TEST_CLUB_ID).maybeSingle();
  if (!existing) {
    const { error } = await admin.from('clubs').insert({ id: TEST_CLUB_ID, name: TEST_CLUB_NAME, join_code: 'E2ETST', created_by: userId });
    if (error) throw error;
  }
  const { error: memberError } = await admin
    .from('club_members')
    .upsert({ club_id: TEST_CLUB_ID, user_id: userId, role: 'admin' }, { onConflict: 'club_id,user_id' });
  if (memberError) throw memberError;

  const { data: existingPlayer } = await admin.from('players').select('id').eq('club_id', TEST_CLUB_ID).eq('user_id', userId).maybeSingle();
  if (!existingPlayer) {
    const { error } = await admin.from('players').insert({ club_id: TEST_CLUB_ID, user_id: userId, name: 'E2E Tester', elo_rating: 1500, games_played: 0 });
    if (error) throw error;
  }
}

async function main() {
  const user = await ensureTestUser();
  await ensureTestClub(user.id);

  const anonClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (signInError) throw signInError;

  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const baseURL = process.env.E2E_BASE_URL ?? 'https://pickleball-app-two.vercel.app';

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: baseURL,
        localStorage: [
          { name: storageKey, value: JSON.stringify(signInData.session) },
          { name: 'currentClubId', value: TEST_CLUB_ID },
        ],
      },
    ],
  };

  mkdirSync(path.join(root, 'e2e', '.auth'), { recursive: true });
  writeFileSync(path.join(root, 'e2e', '.auth', 'user.json'), JSON.stringify(storageState, null, 2));
  console.log('e2e/.auth/user.json written — test account:', TEST_EMAIL, 'club:', TEST_CLUB_ID);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
