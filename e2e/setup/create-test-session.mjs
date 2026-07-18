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

const TEST_SESSION_ID = 'e2e-fixture-session';

// One completed scramble session with a scored round — gives route-smoke
// specs a real session id to hit (/session/[id]/results etc.) without
// scripting the Setup wizard's multi-step UI, which has no stable
// selectors to script against yet.
async function ensureTestSession() {
  const { data: existing } = await admin.from('sessions').select('id').eq('id', TEST_SESSION_ID).maybeSingle();
  if (!existing) {
    const { error } = await admin.from('sessions').insert({
      id: TEST_SESSION_ID,
      club_id: TEST_CLUB_ID,
      format: 'scramble',
      players: ['E2E Tester', 'E2E Bot A', 'E2E Bot B', 'E2E Bot C'],
      round_count: 1,
      status: 'completed',
    });
    if (error) throw error;
  }
  const { data: existingRound } = await admin.from('rounds').select('id').eq('session_id', TEST_SESSION_ID).maybeSingle();
  if (!existingRound) {
    const { error } = await admin.from('rounds').insert({
      session_id: TEST_SESSION_ID,
      round_number: 1,
      court: 1,
      team_a: ['E2E Tester', 'E2E Bot A'],
      team_b: ['E2E Bot B', 'E2E Bot C'],
      sitting_out: [],
      score_a: 11,
      score_b: 7,
    });
    if (error) throw error;
  }
  return TEST_SESSION_ID;
}

const LADDER_SESSION_ID = 'e2e-ladder-fixture-session';
const LADDER_PLAYERS = ['E2E Ladder A', 'E2E Ladder B', 'E2E Ladder C', 'E2E Ladder D']; // rungs 1-4

// Deterministic ladder-upset fixture: rung 1+2 (better) vs rung 3+4 (worse),
// score left unset so the E2E spec fills it in via the real Play page —
// that's the step that actually exercises resolveLadderChallenge(), the
// code this session's real bug fix (dead ladder-movement code) lives in.
async function ensureLadderFixture() {
  // ladder_standings.player_name has a FK to players(name, club_id) — bots
  // need a real players row before they can be enrolled.
  for (const name of LADDER_PLAYERS) {
    const { data: existingBot } = await admin.from('players').select('id').eq('club_id', TEST_CLUB_ID).eq('name', name).maybeSingle();
    if (!existingBot) {
      const { error } = await admin.from('players').insert({ club_id: TEST_CLUB_ID, name, elo_rating: 1500, games_played: 0 });
      if (error) throw error;
    }
  }
  // Two-phase reset (same reasoning as the trigger fix this session found)
  // — a prior run may have already swapped these rungs, so reassigning the
  // original 1-4 order directly can collide with whoever currently holds
  // that rung.
  await Promise.all(LADDER_PLAYERS.map((name, i) => admin.from('ladder_standings').update({ rung: -(i + 1) }).eq('club_id', TEST_CLUB_ID).eq('player_name', name)));
  for (let i = 0; i < LADDER_PLAYERS.length; i++) {
    const { error } = await admin
      .from('ladder_standings')
      .upsert({ club_id: TEST_CLUB_ID, player_name: LADDER_PLAYERS[i], rung: i + 1, enrolled: true, wins: 0, losses: 0 }, { onConflict: 'club_id,player_name' });
    if (error) throw error;
  }

  const { data: existing } = await admin.from('sessions').select('id').eq('id', LADDER_SESSION_ID).maybeSingle();
  if (!existing) {
    const { error } = await admin.from('sessions').insert({
      id: LADDER_SESSION_ID,
      club_id: TEST_CLUB_ID,
      format: 'scramble',
      players: LADDER_PLAYERS,
      round_count: 1,
      status: 'in_progress',
      is_ladder: true,
    });
    if (error) throw error;
  }
  await admin.from('rounds').delete().eq('session_id', LADDER_SESSION_ID); // reset each run so the upset can be re-scored
  const { error: roundError } = await admin.from('rounds').insert({
    session_id: LADDER_SESSION_ID,
    round_number: 1,
    court: 1,
    team_a: [LADDER_PLAYERS[0], LADDER_PLAYERS[1]], // rung 1+2, currently better-ranked
    team_b: [LADDER_PLAYERS[2], LADDER_PLAYERS[3]], // rung 3+4, currently worse-ranked
    sitting_out: [],
    score_a: null,
    score_b: null,
  });
  if (roundError) throw roundError;
  return LADDER_SESSION_ID;
}

const MEMBER_EMAIL = 'e2e-member@pickleball.test';
const MEMBER_PASSWORD = 'E2E-member-password-' + SUPABASE_URL.split('.')[0].slice(-8);

async function ensureMemberUser() {
  const { data: existing } = await admin.auth.admin.listUsers();
  const found = existing?.users?.find(u => u.email === MEMBER_EMAIL);
  if (found) return found;
  const { data, error } = await admin.auth.admin.createUser({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD, email_confirm: true });
  if (error) throw error;
  return data.user;
}

// A non-admin member of the same test club, for permission-boundary specs
// (does a member see admin-only buttons/routes? should not).
async function ensureMemberInClub(userId) {
  const { error } = await admin
    .from('club_members')
    .upsert({ club_id: TEST_CLUB_ID, user_id: userId, role: 'member' }, { onConflict: 'club_id,user_id' });
  if (error) throw error;
  const { data: existingPlayer } = await admin.from('players').select('id').eq('club_id', TEST_CLUB_ID).eq('user_id', userId).maybeSingle();
  if (!existingPlayer) {
    const { error: playerError } = await admin.from('players').insert({ club_id: TEST_CLUB_ID, user_id: userId, name: 'E2E Member', elo_rating: 1500, games_played: 0 });
    if (playerError) throw playerError;
  }
}

const STREAK_SESSION_ID = 'e2e-streak-fixture-session';

// 5 straight wins for "E2E Tester" — real rounds, real matview refresh
// (via the authenticated admin session, matching the real "Refresh Stats
// Now" button) — gives the badge gallery a real hot_streak_5 to display.
async function ensureBadgeStreakFixture() {
  const { data: existing } = await admin.from('sessions').select('id').eq('id', STREAK_SESSION_ID).maybeSingle();
  if (!existing) {
    const { error } = await admin.from('sessions').insert({
      id: STREAK_SESSION_ID,
      club_id: TEST_CLUB_ID,
      format: 'scramble',
      players: ['E2E Tester', 'E2E Bot A', 'E2E Bot B', 'E2E Bot C'],
      round_count: 5,
      status: 'completed',
    });
    if (error) throw error;
  }
  await admin.from('rounds').delete().eq('session_id', STREAK_SESSION_ID);
  const rows = Array.from({ length: 5 }, (_, i) => ({
    session_id: STREAK_SESSION_ID,
    round_number: i + 1,
    court: 1,
    team_a: ['E2E Tester', 'E2E Bot A'],
    team_b: ['E2E Bot B', 'E2E Bot C'],
    sitting_out: [],
    score_a: 11,
    score_b: 5,
  }));
  const { error } = await admin.from('rounds').insert(rows);
  if (error) throw error;
}

const RESET_TEST_CLUB_ID = '00000000-0000-0000-0000-0000000000e3';
const RESET_SESSION_ID = 'e2e-reset-fixture-session';

// Isolated from TEST_CLUB_ID on purpose — the reset-button spec deletes
// everything in whichever club it targets, and must not wipe the fixtures
// every other spec in this suite depends on.
async function ensureResetTestClub(userId) {
  const { data: existing } = await admin.from('clubs').select('id').eq('id', RESET_TEST_CLUB_ID).maybeSingle();
  if (!existing) {
    const { error } = await admin.from('clubs').insert({ id: RESET_TEST_CLUB_ID, name: 'E2E Reset Test Club', join_code: 'E2ERST', created_by: userId });
    if (error) throw error;
  }
  await admin.from('club_members').upsert({ club_id: RESET_TEST_CLUB_ID, user_id: userId, role: 'admin' }, { onConflict: 'club_id,user_id' });

  const { data: existingSession } = await admin.from('sessions').select('id').eq('id', RESET_SESSION_ID).maybeSingle();
  if (!existingSession) {
    const { error } = await admin.from('sessions').insert({
      id: RESET_SESSION_ID,
      club_id: RESET_TEST_CLUB_ID,
      format: 'scramble',
      players: ['E2E Reset A', 'E2E Reset B', 'E2E Reset C', 'E2E Reset D'],
      round_count: 1,
      status: 'completed',
    });
    if (error) throw error;
  }
}

const MULTI_CLUB_ID = '00000000-0000-0000-0000-0000000000e4';
const MULTI_SESSION_ID = 'e2e-multiclub-fixture-session';

// A second real club the admin also belongs to, each with a session
// containing a uniquely-named player — directly tests the area
// listMyClubs() had its privilege bug in: does switching clubs actually
// scope visible data, or can one club's session leak into another's view.
async function ensureMultiClubFixture(userId) {
  const { data: existing } = await admin.from('clubs').select('id').eq('id', MULTI_CLUB_ID).maybeSingle();
  if (!existing) {
    const { error } = await admin.from('clubs').insert({ id: MULTI_CLUB_ID, name: 'E2E Second Club', join_code: 'E2EMC2', created_by: userId });
    if (error) throw error;
  }
  await admin.from('club_members').upsert({ club_id: MULTI_CLUB_ID, user_id: userId, role: 'admin' }, { onConflict: 'club_id,user_id' });

  const { data: existingSession } = await admin.from('sessions').select('id').eq('id', MULTI_SESSION_ID).maybeSingle();
  if (!existingSession) {
    const { error } = await admin.from('sessions').insert({
      id: MULTI_SESSION_ID,
      club_id: MULTI_CLUB_ID,
      format: 'scramble',
      players: ['E2E SecondClub Alpha', 'E2E SecondClub Beta', 'E2E SecondClub Gamma', 'E2E SecondClub Delta'],
      round_count: 1,
      status: 'completed',
    });
    if (error) throw error;
  }
  const { data: existingRound } = await admin.from('rounds').select('id').eq('session_id', MULTI_SESSION_ID).maybeSingle();
  if (!existingRound) {
    const { error } = await admin.from('rounds').insert({
      session_id: MULTI_SESSION_ID,
      round_number: 1,
      court: 1,
      team_a: ['E2E SecondClub Alpha', 'E2E SecondClub Beta'],
      team_b: ['E2E SecondClub Gamma', 'E2E SecondClub Delta'],
      sitting_out: [],
      score_a: 11,
      score_b: 6,
    });
    if (error) throw error;
  }
}

const VOID_SESSION_ID = 'e2e-void-fixture-session';

// Dedicated session for the void-session admin-action spec — separate from
// TEST_SESSION_ID (which route-smoke specs assert is a normal completed
// session) so voiding it doesn't change what those specs expect to see.
async function ensureVoidFixture() {
  const { data: existing } = await admin.from('sessions').select('id, status').eq('id', VOID_SESSION_ID).maybeSingle();
  if (existing?.status === 'voided') {
    await admin.from('sessions').update({ status: 'completed' }).eq('id', VOID_SESSION_ID); // reset for re-run
  } else if (!existing) {
    const { error } = await admin.from('sessions').insert({
      id: VOID_SESSION_ID,
      club_id: TEST_CLUB_ID,
      format: 'scramble',
      players: ['E2E Tester', 'E2E Bot A', 'E2E Bot B', 'E2E Bot C'],
      round_count: 1,
      status: 'completed',
    });
    if (error) throw error;
    await admin.from('rounds').insert({
      session_id: VOID_SESSION_ID,
      round_number: 1,
      court: 1,
      team_a: ['E2E Tester', 'E2E Bot A'],
      team_b: ['E2E Bot B', 'E2E Bot C'],
      sitting_out: [],
      score_a: 11,
      score_b: 9,
    });
  }
}

const REQUESTER_EMAIL = 'e2e-requester@pickleball.test';
const REQUESTER_PASSWORD = 'E2E-requester-password-' + SUPABASE_URL.split('.')[0].slice(-8);

// A third real user with a pending join request against TEST_CLUB_ID —
// exercises the admin's Approve/Reject flow with real data, not a mock.
async function ensureJoinRequestFixture() {
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  let requester = existingUsers?.users?.find(u => u.email === REQUESTER_EMAIL);
  if (!requester) {
    const { data, error } = await admin.auth.admin.createUser({ email: REQUESTER_EMAIL, password: REQUESTER_PASSWORD, email_confirm: true });
    if (error) throw error;
    requester = data.user;
  }
  // Already a member (e.g. a prior run approved this request) — nothing to
  // re-seed, the approve-flow spec only needs to run once meaningfully.
  const { data: alreadyMember } = await admin.from('club_members').select('user_id').eq('club_id', TEST_CLUB_ID).eq('user_id', requester.id).maybeSingle();
  if (alreadyMember) {
    await admin.from('club_members').delete().eq('club_id', TEST_CLUB_ID).eq('user_id', requester.id); // reset for re-run
  }
  await admin.from('club_join_requests').delete().eq('club_id', TEST_CLUB_ID).eq('user_id', requester.id);
  const { error } = await admin.from('club_join_requests').insert({ club_id: TEST_CLUB_ID, user_id: requester.id, status: 'pending', name: 'E2E Requester' });
  if (error) throw error;
  return requester;
}

const CONFIRM_SESSION_ID = 'e2e-confirm-fixture-session';

// Dedicated session with E2E Tester as a participant, confirmations reset
// each run — exercises the member's "Yes, I played this" confirm flow.
async function ensureConfirmFixture() {
  const { data: existing } = await admin.from('sessions').select('id').eq('id', CONFIRM_SESSION_ID).maybeSingle();
  if (!existing) {
    const { error } = await admin.from('sessions').insert({
      id: CONFIRM_SESSION_ID,
      club_id: TEST_CLUB_ID,
      format: 'scramble',
      players: ['E2E Tester', 'E2E Bot A', 'E2E Bot B', 'E2E Bot C'],
      round_count: 1,
      status: 'completed',
    });
    if (error) throw error;
    await admin.from('rounds').insert({
      session_id: CONFIRM_SESSION_ID,
      round_number: 1,
      court: 1,
      team_a: ['E2E Tester', 'E2E Bot A'],
      team_b: ['E2E Bot B', 'E2E Bot C'],
      sitting_out: [],
      score_a: 11,
      score_b: 8,
    });
  }
  await admin.from('session_confirmations').delete().eq('session_id', CONFIRM_SESSION_ID); // reset for re-run
}

const PENDING_EMAIL = 'e2e-pending@pickleball.test';
const PENDING_PASSWORD = 'E2E-pending-password-' + SUPABASE_URL.split('.')[0].slice(-8);

// A dedicated account that stays club-less forever — REQUESTER_EMAIL can't
// be reused here because admin-actions.spec.ts legitimately approves that
// account into real membership, which would make the "pending banner on a
// club-less user" scenario unobservable regardless of run order.
async function ensurePendingOnlyUser() {
  const { data: existing } = await admin.auth.admin.listUsers();
  let pendingUser = existing?.users?.find(u => u.email === PENDING_EMAIL);
  if (!pendingUser) {
    const { data, error } = await admin.auth.admin.createUser({ email: PENDING_EMAIL, password: PENDING_PASSWORD, email_confirm: true });
    if (error) throw error;
    pendingUser = data.user;
  }
  await admin.from('club_join_requests').delete().eq('club_id', RESET_TEST_CLUB_ID).eq('user_id', pendingUser.id);
  const { error } = await admin.from('club_join_requests').insert({ club_id: RESET_TEST_CLUB_ID, user_id: pendingUser.id, status: 'pending', name: 'E2E Pending' });
  if (error) throw error;
  return pendingUser;
}

const TIE_SESSION_ID = 'e2e-tie-fixture-session';

// Dedicated unscored round for the tie-rejection spec — separate from the
// ladder fixture's unscored round, which the concurrent-scoring spec needs
// undisturbed (both specs run in parallel by default).
async function ensureTieFixture() {
  const { data: existing } = await admin.from('sessions').select('id').eq('id', TIE_SESSION_ID).maybeSingle();
  if (!existing) {
    const { error } = await admin.from('sessions').insert({
      id: TIE_SESSION_ID,
      club_id: TEST_CLUB_ID,
      format: 'scramble',
      players: ['E2E Tie A', 'E2E Tie B', 'E2E Tie C', 'E2E Tie D'],
      round_count: 1,
      status: 'in_progress',
    });
    if (error) throw error;
  }
  await admin.from('rounds').delete().eq('session_id', TIE_SESSION_ID); // reset for re-run
  const { error: roundError } = await admin.from('rounds').insert({
    session_id: TIE_SESSION_ID,
    round_number: 1,
    court: 1,
    team_a: ['E2E Tie A', 'E2E Tie B'],
    team_b: ['E2E Tie C', 'E2E Tie D'],
    sitting_out: [],
    score_a: null,
    score_b: null,
  });
  if (roundError) throw roundError;
}

const CONCURRENT_SESSION_ID = 'e2e-concurrent-fixture-session';

// Dedicated unscored round for the concurrent-scoring spec — separate from
// both the ladder-upset fixture (already written to by ladder-upset.spec.ts)
// and the tie fixture above, so all three unscored-round specs can run in
// parallel without racing each other's writes.
async function ensureConcurrentFixture() {
  const { data: existing } = await admin.from('sessions').select('id').eq('id', CONCURRENT_SESSION_ID).maybeSingle();
  if (!existing) {
    const { error } = await admin.from('sessions').insert({
      id: CONCURRENT_SESSION_ID,
      club_id: TEST_CLUB_ID,
      format: 'scramble',
      players: ['E2E Concurrent A', 'E2E Concurrent B', 'E2E Concurrent C', 'E2E Concurrent D'],
      round_count: 1,
      status: 'in_progress',
    });
    if (error) throw error;
  }
  await admin.from('rounds').delete().eq('session_id', CONCURRENT_SESSION_ID); // reset for re-run
  const { error: roundError } = await admin.from('rounds').insert({
    session_id: CONCURRENT_SESSION_ID,
    round_number: 1,
    court: 1,
    team_a: ['E2E Concurrent A', 'E2E Concurrent B'],
    team_b: ['E2E Concurrent C', 'E2E Concurrent D'],
    sitting_out: [],
    score_a: null,
    score_b: null,
  });
  if (roundError) throw roundError;
}

const NO_DZ_CLUB_ID = '00000000-0000-0000-0000-0000000000e6';

// Tiny throwaway club where TEST_EMAIL is admin but explicitly lacks
// danger_zone_access — negative-case fixture for the Danger Zone toggle
// (the positive/granted case is already covered by RESET_TEST_CLUB_ID,
// whose admin got danger_zone_access=true from the backfill migration).
async function ensureNoDangerZoneClub(userId) {
  const { data: existing } = await admin.from('clubs').select('id').eq('id', NO_DZ_CLUB_ID).maybeSingle();
  if (!existing) {
    const { error } = await admin.from('clubs').insert({ id: NO_DZ_CLUB_ID, name: 'E2E No-DZ Club', join_code: 'E2ENDZ', created_by: userId });
    if (error) throw error;
  }
  await admin.from('club_members').upsert(
    { club_id: NO_DZ_CLUB_ID, user_id: userId, role: 'admin', danger_zone_access: false },
    { onConflict: 'club_id,user_id' }
  );
}

// Grants super_admin to the requester account (not MEMBER_EMAIL, to avoid
// touching the permission-boundary fixture used by member-permissions.spec.ts)
// — positive-case fixture for /admin.
async function ensureSuperAdminGrant(userId) {
  await admin.from('super_admins').upsert({ user_id: userId }, { onConflict: 'user_id' });
}

// One unpaid due for "E2E Tester" on the existing completed fixture session
// — gives the My Dues page a real nonzero balance to render, instead of
// only ever testing the empty state.
async function ensureDuesFixture() {
  const { data: existing } = await admin
    .from('session_dues')
    .select('id')
    .eq('session_id', TEST_SESSION_ID)
    .eq('player_name', 'E2E Tester')
    .maybeSingle();
  if (!existing) {
    const { error } = await admin
      .from('session_dues')
      .insert({ session_id: TEST_SESSION_ID, player_name: 'E2E Tester', amount_owed: 150, paid: false });
    if (error) throw error;
  } else {
    await admin.from('session_dues').update({ paid: false, amount_owed: 150 }).eq('id', existing.id); // reset for re-run
  }
}

function buildStorageState(session, clubId, baseURL, storageKey) {
  return {
    cookies: [],
    origins: [{ origin: baseURL, localStorage: [{ name: storageKey, value: JSON.stringify(session) }, { name: 'currentClubId', value: clubId }] }],
  };
}

async function main() {
  const user = await ensureTestUser();
  await ensureTestClub(user.id);
  await ensureTestSession();
  await ensureLadderFixture();
  await ensureBadgeStreakFixture();
  await ensureResetTestClub(user.id);
  await ensureMultiClubFixture(user.id);
  await ensureVoidFixture();
  const requester = await ensureJoinRequestFixture();
  const pendingUser = await ensurePendingOnlyUser();
  await ensureConfirmFixture();
  await ensureNoDangerZoneClub(user.id);
  await ensureDuesFixture();
  await ensureTieFixture();
  await ensureConcurrentFixture();
  await ensureSuperAdminGrant(requester.id);

  const member = await ensureMemberUser();
  await ensureMemberInClub(member.id);

  const anonClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: adminSignIn, error: adminSignInError } = await anonClient.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (adminSignInError) throw adminSignInError;

  // Real admin-triggered stats refresh — same RPC the "Refresh Stats Now"
  // button calls — so the badge streak fixture's matview data is queryable.
  const authedClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${adminSignIn.session.access_token}` } },
  });
  await authedClient.rpc('refresh_league_stats');

  const memberAnonClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: memberSignIn, error: memberSignInError } = await memberAnonClient.auth.signInWithPassword({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD });
  if (memberSignInError) throw memberSignInError;

  // Requester has no club yet (pending join request) — no currentClubId to seed.
  const requesterAnonClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: requesterSignIn, error: requesterSignInError } = await requesterAnonClient.auth.signInWithPassword({ email: REQUESTER_EMAIL, password: REQUESTER_PASSWORD });
  if (requesterSignInError) throw requesterSignInError;

  const pendingAnonClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: pendingSignIn, error: pendingSignInError } = await pendingAnonClient.auth.signInWithPassword({ email: PENDING_EMAIL, password: PENDING_PASSWORD });
  if (pendingSignInError) throw pendingSignInError;

  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const baseURL = process.env.E2E_BASE_URL ?? 'https://pickleball-app-two.vercel.app';

  mkdirSync(path.join(root, 'e2e', '.auth'), { recursive: true });
  writeFileSync(path.join(root, 'e2e', '.auth', 'user.json'), JSON.stringify(buildStorageState(adminSignIn.session, TEST_CLUB_ID, baseURL, storageKey), null, 2));
  writeFileSync(path.join(root, 'e2e', '.auth', 'member.json'), JSON.stringify(buildStorageState(memberSignIn.session, TEST_CLUB_ID, baseURL, storageKey), null, 2));
  writeFileSync(path.join(root, 'e2e', '.auth', 'requester.json'), JSON.stringify(buildStorageState(requesterSignIn.session, '', baseURL, storageKey), null, 2));
  writeFileSync(path.join(root, 'e2e', '.auth', 'pending.json'), JSON.stringify(buildStorageState(pendingSignIn.session, '', baseURL, storageKey), null, 2));
  console.log('e2e/.auth/user.json + member.json + requester.json + pending.json written —', TEST_EMAIL, '(admin) /', MEMBER_EMAIL, '(member) /', REQUESTER_EMAIL, '(super admin) /', PENDING_EMAIL, '(club-less pending), club:', TEST_CLUB_ID);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
