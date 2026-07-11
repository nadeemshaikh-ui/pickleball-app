# League Gamification — Phase 0: Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the database tables, view, and data-access functions that Phases 1-7 of the league gamification feature depend on, without touching any existing table's data or any Life-OS table.

**Architecture:** Five additive Supabase migrations (one nullable column, three new RLS-scoped tables, one new materialized view + wrapper view + refresh-function update) applied to the shared project `ltbnjtgzpwxulbczmzdr`, followed by three new client-side data-access files mirroring the existing `lib/leagueStats.ts` fetch-function pattern (club-scoped queries against `supabase`).

**Tech Stack:** Supabase Postgres (RLS, materialized views), TypeScript, `@supabase/supabase-js` client already configured in `lib/supabase.ts`.

**Safety boundary:** every migration in this plan is additive only (`ALTER TABLE ... ADD COLUMN`, `CREATE TABLE`, `CREATE MATERIALIZED VIEW`). None drop, rename, or modify existing columns/tables. None touch any table outside the `league_*`/`players`/`club_members` namespace already used by this app — the shared project also hosts unrelated Life-OS tables (`expenses`, `bills`, `family_members`, etc.) which this plan never references.

---

### Task 1: `equipped_badge_id` column on `players`

**Files:**
- Migration: applied via `mcp__supabase__apply_migration` (project `ltbnjtgzpwxulbczmzdr`)

- [ ] **Step 1: Apply the migration**

```sql
alter table players add column equipped_badge_id text;
```

Call `apply_migration` with `name: "add_equipped_badge_id_to_players"` and the SQL above.

- [ ] **Step 2: Verify**

Run via `execute_sql`:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'players' and column_name = 'equipped_badge_id';
```
Expected: one row, `data_type = text`, `is_nullable = YES`.

- [ ] **Step 3: Commit**

No source file changed yet (schema-only). Skip commit — this task has no repo diff. Proceed to Task 2.

---

### Task 2: `league_streak_records` table (all-time win/loss streak crown)

**Files:**
- Migration: applied via `apply_migration`

- [ ] **Step 1: Apply the migration**

```sql
create table league_streak_records (
  club_id uuid not null references clubs(id) on delete cascade,
  streak_type text not null check (streak_type in ('win', 'loss')),
  record_length int not null,
  holder_name text not null,
  achieved_at timestamptz not null default now(),
  primary key (club_id, streak_type)
);

alter table league_streak_records enable row level security;

create policy "club members can read streak records"
  on league_streak_records for select
  using (is_club_member(club_id));

create policy "club members can upsert streak records"
  on league_streak_records for insert
  with check (is_club_member(club_id));

create policy "club members can update streak records"
  on league_streak_records for update
  using (is_club_member(club_id))
  with check (is_club_member(club_id));
```

Call `apply_migration` with `name: "create_league_streak_records"`.

- [ ] **Step 2: Verify**

```sql
select table_name from information_schema.tables where table_name = 'league_streak_records';
select policyname from pg_policies where tablename = 'league_streak_records';
```
Expected: the table exists; 3 policies listed.

---

### Task 3: `league_badge_events` table (unlock-detection log)

**Files:**
- Migration: applied via `apply_migration`

- [ ] **Step 1: Apply the migration**

```sql
create table league_badge_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  player_name text not null,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  unique (club_id, player_name, badge_id)
);

alter table league_badge_events enable row level security;

create policy "club members can read badge events"
  on league_badge_events for select
  using (is_club_member(club_id));

create policy "club members can insert badge events"
  on league_badge_events for insert
  with check (is_club_member(club_id));
```

Call `apply_migration` with `name: "create_league_badge_events"`. No update/delete policy — this table is insert-only by design (a badge, once earned, stays earned).

- [ ] **Step 2: Verify**

```sql
select table_name from information_schema.tables where table_name = 'league_badge_events';
select policyname from pg_policies where tablename = 'league_badge_events';
```
Expected: table exists; 2 policies listed (select, insert).

---

### Task 4: `league_challenges` table (duel system)

**Files:**
- Migration: applied via `apply_migration`

- [ ] **Step 1: Apply the migration**

```sql
create table league_challenges (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  challenger_name text not null,
  opponent_name text not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  result text check (result in ('challenger_won', 'opponent_won')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table league_challenges enable row level security;

create policy "club members can read challenges"
  on league_challenges for select
  using (is_club_member(club_id));

create policy "club members can create challenges"
  on league_challenges for insert
  with check (is_club_member(club_id));

create policy "club members can resolve challenges"
  on league_challenges for update
  using (is_club_member(club_id))
  with check (is_club_member(club_id));
```

Call `apply_migration` with `name: "create_league_challenges"`.

- [ ] **Step 2: Verify**

```sql
select table_name from information_schema.tables where table_name = 'league_challenges';
select policyname from pg_policies where tablename = 'league_challenges';
```
Expected: table exists; 3 policies listed.

---

### Task 5: `league_player_year_stats` — yearly Wrapped view

Mirrors the existing `league_player_month_stats_mv` / `league_player_month_stats` pair exactly (same `per_player_round` shape), swapping `date_trunc('month', ...)` for `date_trunc('year', ...)`, and adds it to the existing admin-only refresh function.

**Files:**
- Migration: applied via `apply_migration`

- [ ] **Step 1: Apply the migration**

```sql
create materialized view league_player_year_stats_mv as
with per_player_round as (
  select
    s.club_id,
    r.id as round_id,
    s.created_at as session_created_at,
    jsonb_array_elements_text(r.team_a) as name,
    r.score_a as own_score,
    r.score_b as opp_score
  from rounds r
  join sessions s on s.id = r.session_id
  where r.score_a is not null and r.score_b is not null
  union all
  select
    s.club_id,
    r.id,
    s.created_at,
    jsonb_array_elements_text(r.team_b) as name,
    r.score_b,
    r.score_a
  from rounds r
  join sessions s on s.id = r.session_id
  where r.score_a is not null and r.score_b is not null
)
select
  club_id,
  name,
  count(*)::integer as games_played,
  count(*) filter (where own_score > opp_score)::integer as wins,
  count(*) filter (where own_score < opp_score)::integer as losses
from per_player_round
where date_trunc('year', session_created_at at time zone 'Asia/Kolkata') =
      date_trunc('year', now() at time zone 'Asia/Kolkata')
group by club_id, name;

create unique index league_player_year_stats_mv_idx
  on league_player_year_stats_mv using btree (club_id, name);

create view league_player_year_stats as
  select club_id, name, games_played, wins, losses
  from league_player_year_stats_mv
  where is_club_member(club_id);

create or replace function refresh_league_stats()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from club_members where user_id = auth.uid() and role = 'admin') then
    raise exception 'Only admins can refresh league stats.';
  end if;
  refresh materialized view concurrently league_player_stats_mv;
  refresh materialized view concurrently league_player_month_stats_mv;
  refresh materialized view concurrently league_player_year_stats_mv;
  refresh materialized view concurrently league_duo_stats_mv;
  refresh materialized view concurrently league_mvp_stats_mv;
  refresh materialized view concurrently league_rivalry_stats_mv;
  refresh materialized view concurrently league_streak_stats_mv;
end;
$function$;
```

Call `apply_migration` with `name: "create_league_player_year_stats"`.

- [ ] **Step 2: Verify**

```sql
select matviewname from pg_matviews where matviewname = 'league_player_year_stats_mv';
select table_name from information_schema.views where table_name = 'league_player_year_stats';
select pg_get_functiondef('public.refresh_league_stats'::regproc);
```
Expected: matview and view both exist; the function definition includes the new `refresh materialized view concurrently league_player_year_stats_mv;` line.

---

### Task 6: TypeScript data-access — streak records

**Files:**
- Create: `lib/streakRecords.ts`

- [ ] **Step 1: Write the file**

```typescript
import { supabase } from './supabase';

export interface StreakRecord {
  streakType: 'win' | 'loss';
  recordLength: number;
  holderName: string;
  achievedAt: string;
}

export async function fetchStreakRecords(clubId: string): Promise<StreakRecord[]> {
  const { data, error } = await supabase.from('league_streak_records').select('*').eq('club_id', clubId);
  if (error) throw error;
  return data.map((r: { streak_type: 'win' | 'loss'; record_length: number; holder_name: string; achieved_at: string }) => ({
    streakType: r.streak_type,
    recordLength: r.record_length,
    holderName: r.holder_name,
    achievedAt: r.achieved_at,
  }));
}

// Called after a match result is recorded. Compares the player's current
// streak (from league_streak_stats) against the club's stored record and
// upserts a new record — and a new crown holder — if it was just broken.
// Returns the new record if one was set, null if the existing record held.
export async function maybeSetStreakRecord(
  clubId: string,
  streakType: 'win' | 'loss',
  playerName: string,
  currentStreakLength: number
): Promise<StreakRecord | null> {
  const { data: existing, error: fetchError } = await supabase
    .from('league_streak_records')
    .select('record_length')
    .eq('club_id', clubId)
    .eq('streak_type', streakType)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (existing && existing.record_length >= currentStreakLength) return null;

  const { error: upsertError } = await supabase.from('league_streak_records').upsert(
    {
      club_id: clubId,
      streak_type: streakType,
      record_length: currentStreakLength,
      holder_name: playerName,
      achieved_at: new Date().toISOString(),
    },
    { onConflict: 'club_id,streak_type' }
  );
  if (upsertError) throw upsertError;

  return { streakType, recordLength: currentStreakLength, holderName: playerName, achievedAt: new Date().toISOString() };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx --prefix "C:\Users\Nadeem\Documents\pickleball-app" tsc --noEmit -p "C:\Users\Nadeem\Documents\pickleball-app\tsconfig.json"`
Expected: no errors mentioning `streakRecords.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/streakRecords.ts
git commit -m "Add streak-record data access for league gamification"
```

---

### Task 7: TypeScript data-access — badge events

**Files:**
- Create: `lib/badgeEvents.ts`

- [ ] **Step 1: Write the file**

```typescript
import { supabase } from './supabase';

export interface BadgeEvent {
  badgeId: string;
  earnedAt: string;
}

export async function fetchBadgeEvents(clubId: string, playerName: string): Promise<BadgeEvent[]> {
  const { data, error } = await supabase
    .from('league_badge_events')
    .select('badge_id, earned_at')
    .eq('club_id', clubId)
    .eq('player_name', playerName);
  if (error) throw error;
  return data.map((r: { badge_id: string; earned_at: string }) => ({ badgeId: r.badge_id, earnedAt: r.earned_at }));
}

// Compares currently-computed badge ids against previously-logged events and
// inserts rows for any that are new. Returns the newly-earned badge ids —
// the caller uses this list to trigger the unlock celebration.
export async function recordNewlyEarnedBadges(clubId: string, playerName: string, currentBadgeIds: string[]): Promise<string[]> {
  const known = await fetchBadgeEvents(clubId, playerName);
  const knownIds = new Set(known.map(k => k.badgeId));
  const newlyEarned = currentBadgeIds.filter(id => !knownIds.has(id));
  if (newlyEarned.length === 0) return [];

  const { error } = await supabase.from('league_badge_events').insert(
    newlyEarned.map(badgeId => ({ club_id: clubId, player_name: playerName, badge_id: badgeId }))
  );
  if (error) throw error;

  return newlyEarned;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx --prefix "C:\Users\Nadeem\Documents\pickleball-app" tsc --noEmit -p "C:\Users\Nadeem\Documents\pickleball-app\tsconfig.json"`
Expected: no errors mentioning `badgeEvents.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/badgeEvents.ts
git commit -m "Add badge-unlock event tracking for league gamification"
```

---

### Task 8: TypeScript data-access — challenges

**Files:**
- Create: `lib/challenges.ts`

- [ ] **Step 1: Write the file**

```typescript
import { supabase } from './supabase';

export interface Challenge {
  id: string;
  challengerName: string;
  opponentName: string;
  status: 'pending' | 'completed';
  result: 'challenger_won' | 'opponent_won' | null;
  createdAt: string;
}

export async function fetchPendingChallenges(clubId: string, playerName: string): Promise<Challenge[]> {
  const { data, error } = await supabase
    .from('league_challenges')
    .select('*')
    .eq('club_id', clubId)
    .eq('status', 'pending')
    .or(`challenger_name.eq.${playerName},opponent_name.eq.${playerName}`);
  if (error) throw error;
  return data.map(mapChallenge);
}

export async function createChallenge(clubId: string, challengerName: string, opponentName: string): Promise<void> {
  const { error } = await supabase
    .from('league_challenges')
    .insert({ club_id: clubId, challenger_name: challengerName, opponent_name: opponentName });
  if (error) throw error;
}

// Called when challenger and opponent are found on opposite teams in a
// newly-recorded round. Resolves the oldest pending challenge between them.
export async function resolveChallenge(challengeId: string, result: 'challenger_won' | 'opponent_won'): Promise<void> {
  const { error } = await supabase
    .from('league_challenges')
    .update({ status: 'completed', result, resolved_at: new Date().toISOString() })
    .eq('id', challengeId);
  if (error) throw error;
}

function mapChallenge(r: {
  id: string;
  challenger_name: string;
  opponent_name: string;
  status: 'pending' | 'completed';
  result: 'challenger_won' | 'opponent_won' | null;
  created_at: string;
}): Challenge {
  return {
    id: r.id,
    challengerName: r.challenger_name,
    opponentName: r.opponent_name,
    status: r.status,
    result: r.result,
    createdAt: r.created_at,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx --prefix "C:\Users\Nadeem\Documents\pickleball-app" tsc --noEmit -p "C:\Users\Nadeem\Documents\pickleball-app\tsconfig.json"`
Expected: no errors mentioning `challenges.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/challenges.ts
git commit -m "Add duel/challenge data access for league gamification"
```

---

### Task 9: TypeScript data-access — yearly leaderboard

**Files:**
- Modify: `lib/leagueStats.ts` (add one function, following the exact shape of `fetchLifetimeLeaderboard` at line 53)

- [ ] **Step 1: Add the function**

Insert after `fetchPlayerOfTheMonthBoard` (after line 78 in the current file):

```typescript
export async function fetchYearlyLeaderboard(clubId: string): Promise<RankedPlayer[]> {
  const { data, error } = await supabase.from('league_player_year_stats').select('*').eq('club_id', clubId);
  if (error) throw error;
  return rankPlayers(data);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx --prefix "C:\Users\Nadeem\Documents\pickleball-app" tsc --noEmit -p "C:\Users\Nadeem\Documents\pickleball-app\tsconfig.json"`
Expected: no errors.

- [ ] **Step 3: Verify against live data**

Run via `execute_sql` (read-only sanity check that the view returns rows shaped as expected):
```sql
select * from league_player_year_stats limit 5;
```
Expected: either zero rows (if no matches this calendar year yet) or rows with `club_id, name, games_played, wins, losses` columns — no error.

- [ ] **Step 4: Commit**

```bash
git add lib/leagueStats.ts
git commit -m "Add yearly leaderboard fetch for Pickleball Wrapped"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers §6 (equipped titles) at the data layer. Task 2 covers §2 (streak crown). Task 3 covers §7 (unlock celebration). Task 4 covers §5 (duels). Tasks 5+9 cover §8 (yearly Wrapped) — monthly already exists (`league_player_month_stats`, unchanged). UI for all of these is explicitly out of scope for Phase 0 per the phase-wise plan already agreed with the user — Phases 1-7 build on top of this.
- **No placeholders:** every SQL/TS block above is complete and runnable, not sketched.
- **Type consistency:** `StreakRecord.streakType`, `BadgeEvent.badgeId`, `Challenge.status`/`result` match the DB check constraints exactly; `rankPlayers`/`RankedPlayer` in Task 9 reuses the existing type from `lib/leagueStats.ts` rather than redefining it.
