# Pickleball Session App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a basic cloud-backed web app (Next.js + Supabase) that lets one scorekeeper enter 10 players, auto-generate a fair fixed round schedule (Scramble or Squad Rivalry format) across 2 courts, record final scores per round, and view end-of-session leaderboard/analytics — all on an iPhone, no login required.

**Architecture:** Next.js App Router, client components calling Supabase directly (anon key, open RLS — no auth per spec). Core fairness logic lives in one pure, fully unit-tested TypeScript module (`lib/shuffle.ts`) with zero DB/UI dependencies, so it can be tested in isolation before anything is wired to a screen. Two Supabase tables (`sessions`, `rounds`) hold all state; every screen reads/writes through a single `lib/db.ts` helper module.

**Tech Stack:** Next.js 14 (App Router, TypeScript), Supabase (Postgres + supabase-js client), Vitest for unit tests, deployed on Vercel.

**Spec:** `docs/superpowers/specs/2026-07-09-pickleball-session-app-design.md`

---

## Phase 1: Project Scaffold & Supabase Schema

### Task 1.1: Scaffold Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Scaffold via create-next-app**

Run:
```bash
cd "C:/Users/Nadeem/Documents/pickleball-app"
npx create-next-app@latest . --typescript --app --no-tailwind --eslint --src-dir=false --import-alias "@/*" --use-npm
```
When prompted, accept defaults for anything not covered by flags.

- [ ] **Step 2: Install Supabase client and Vitest**

Run:
```bash
npm install @supabase/supabase-js
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 3: Add test script to package.json**

Modify `package.json` scripts block to include:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run"
}
```

- [ ] **Step 4: Verify dev server boots**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000`, default Next.js page loads with no errors. Stop the server after confirming (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js project with Supabase client and Vitest"
```

### Task 1.2: Supabase project + schema

**Files:**
- Create: `supabase/schema.sql`
- Create: `.env.local` (not committed)
- Create: `.env.local.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create Supabase project**

If not already done: go to supabase.com, create a new project named `pickleball-app`. Copy the Project URL and anon public key from Settings → API.

- [ ] **Step 2: Write schema SQL**

Create `supabase/schema.sql`:
```sql
create table sessions (
  id text primary key,
  created_at timestamptz not null default now(),
  format text not null check (format in ('scramble', 'squad_rivalry')),
  players jsonb not null,
  squads jsonb,
  round_count int not null,
  status text not null default 'setup' check (status in ('setup', 'in_progress', 'completed'))
);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references sessions(id) on delete cascade,
  round_number int not null,
  court int not null check (court in (1, 2)),
  team_a jsonb not null,
  team_b jsonb not null,
  sitting_out jsonb not null,
  score_a int,
  score_b int,
  unique (session_id, round_number, court)
);

-- No auth in v1: open policies scoped to anon key usage only.
alter table sessions enable row level security;
alter table rounds enable row level security;

create policy "anon full access sessions" on sessions
  for all using (true) with check (true);

create policy "anon full access rounds" on rounds
  for all using (true) with check (true);
```

- [ ] **Step 2: Run schema against the Supabase project**

In the Supabase dashboard SQL editor, paste and run the contents of `supabase/schema.sql`. Verify both tables appear under Table Editor with no errors.

- [ ] **Step 3: Set up env files**

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<your-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Modify `.gitignore` to confirm it includes (create-next-app already adds this, verify it's present):
```
.env*.local
```

- [ ] **Step 4: Commit (schema + example env only, never the real key)**

```bash
git add supabase/schema.sql .env.local.example .gitignore
git commit -m "Add Supabase schema for sessions and rounds tables"
```

---

## Phase 2: Balanced-Shuffle Algorithm (core logic, fully TDD)

This is the highest-risk piece of logic in the app — isolate and test it thoroughly before touching any UI or database code.

### Task 2.1: Types and seeded RNG helper

**Files:**
- Create: `lib/shuffle.ts`
- Test: `lib/shuffle.test.ts`

- [ ] **Step 1: Write failing test for seeded RNG determinism**

Create `lib/shuffle.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { seededRandom } from './shuffle';

describe('seededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = seededRandom('session-123');
    const b = seededRandom('session-123');
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('produces a different sequence for a different seed', () => {
    const a = seededRandom('session-123');
    const b = seededRandom('session-456');
    expect(a()).not.toEqual(b());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/shuffle.test.ts`
Expected: FAIL — `seededRandom` is not exported from `./shuffle` (module doesn't exist yet).

- [ ] **Step 3: Implement seeded RNG**

Create `lib/shuffle.ts`:
```typescript
// Deterministic PRNG (mulberry32) seeded by a string hash, so a given
// session id always produces the same "random-looking" schedule.
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return function mulberry32() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/shuffle.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/shuffle.ts lib/shuffle.test.ts
git commit -m "Add deterministic seeded RNG for schedule generation"
```

### Task 2.2: Scramble schedule generation

**Files:**
- Modify: `lib/shuffle.ts`
- Modify: `lib/shuffle.test.ts`

- [ ] **Step 1: Write failing tests for scramble schedule shape**

Append to `lib/shuffle.test.ts`:
```typescript
import { generateScrambleSchedule } from './shuffle';

describe('generateScrambleSchedule', () => {
  const players = ['P1','P2','P3','P4','P5','P6','P7','P8','P9','P10'];

  it('generates the requested number of rounds', () => {
    const rounds = generateScrambleSchedule(players, 12, 'seed-a');
    expect(rounds).toHaveLength(12);
  });

  it('each round has exactly 8 unique playing players and 2 sitting out, no overlap', () => {
    const rounds = generateScrambleSchedule(players, 12, 'seed-a');
    for (const round of rounds) {
      const playing = [...round.court1.teamA, ...round.court1.teamB, ...round.court2.teamA, ...round.court2.teamB];
      expect(new Set(playing).size).toBe(8);
      expect(round.sittingOut).toHaveLength(2);
      const overlap = playing.filter(p => round.sittingOut.includes(p));
      expect(overlap).toHaveLength(0);
    }
  });

  it('balances sit-outs within 1 of each other across all rounds', () => {
    const rounds = generateScrambleSchedule(players, 12, 'seed-a');
    const sitCounts: Record<string, number> = Object.fromEntries(players.map(p => [p, 0]));
    for (const round of rounds) {
      for (const p of round.sittingOut) sitCounts[p]++;
    }
    const counts = Object.values(sitCounts);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('is deterministic for the same seed', () => {
    const a = generateScrambleSchedule(players, 12, 'seed-a');
    const b = generateScrambleSchedule(players, 12, 'seed-a');
    expect(a).toEqual(b);
  });

  it('throws if given fewer than 10 players', () => {
    expect(() => generateScrambleSchedule(['P1','P2'], 4, 'seed-a')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/shuffle.test.ts`
Expected: FAIL — `generateScrambleSchedule` is not exported.

- [ ] **Step 3: Implement scramble schedule generation**

Append to `lib/shuffle.ts`:
```typescript
export interface CourtMatch {
  teamA: [string, string];
  teamB: [string, string];
}

export interface ScrambleRound {
  roundNumber: number;
  court1: CourtMatch;
  court2: CourtMatch;
  sittingOut: [string, string];
}

function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Greedily pairs 8 players into 4 teams of 2 (2 courts), minimizing repeat
// partnerships based on the running partnerCounts map.
function pairIntoTeams(
  eightPlayers: string[],
  partnerCounts: Map<string, number>,
  rand: () => number
): [CourtMatch, CourtMatch] {
  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const pool = shuffleArray(eightPlayers, rand);
  const teams: [string, string][] = [];
  const used = new Set<string>();

  for (const p of pool) {
    if (used.has(p)) continue;
    let bestPartner: string | null = null;
    let bestCount = Infinity;
    for (const q of pool) {
      if (q === p || used.has(q)) continue;
      const count = partnerCounts.get(pairKey(p, q)) ?? 0;
      if (count < bestCount) {
        bestCount = count;
        bestPartner = q;
      }
    }
    if (bestPartner) {
      teams.push([p, bestPartner]);
      used.add(p);
      used.add(bestPartner);
      const key = pairKey(p, bestPartner);
      partnerCounts.set(key, (partnerCounts.get(key) ?? 0) + 1);
    }
  }

  return [
    { teamA: teams[0], teamB: teams[1] },
    { teamA: teams[2], teamB: teams[3] },
  ];
}

export function generateScrambleSchedule(
  players: string[],
  roundCount: number,
  seed: string
): ScrambleRound[] {
  if (players.length !== 10) {
    throw new Error(`generateScrambleSchedule requires exactly 10 players, got ${players.length}`);
  }
  const rand = seededRandom(seed);
  const sitOutCounts = new Map<string, number>(players.map(p => [p, 0]));
  const partnerCounts = new Map<string, number>();
  const rounds: ScrambleRound[] = [];

  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber++) {
    // Precompute tiebreakers once per round rather than calling rand() inside
    // the sort comparator, whose call-count isn't guaranteed by the JS spec.
    const tieBreakers = new Map(players.map(p => [p, rand()]));
    const sortedBySitOut = [...players].sort((a, b) => {
      const diff = sitOutCounts.get(a)! - sitOutCounts.get(b)!;
      return diff !== 0 ? diff : tieBreakers.get(a)! - tieBreakers.get(b)!;
    });
    const sittingOut = sortedBySitOut.slice(0, 2) as [string, string];
    for (const p of sittingOut) sitOutCounts.set(p, sitOutCounts.get(p)! + 1);

    const playing = players.filter(p => !sittingOut.includes(p));
    const [court1, court2] = pairIntoTeams(playing, partnerCounts, rand);

    rounds.push({ roundNumber, court1, court2, sittingOut });
  }

  return rounds;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/shuffle.test.ts`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Commit**

```bash
git add lib/shuffle.ts lib/shuffle.test.ts
git commit -m "Implement balanced scramble schedule generation"
```

### Task 2.3: Squad Rivalry schedule generation

**Files:**
- Modify: `lib/shuffle.ts`
- Modify: `lib/shuffle.test.ts`

- [ ] **Step 1: Write failing tests for squad rivalry**

Append to `lib/shuffle.test.ts`:
```typescript
import { generateSquadRivalrySchedule } from './shuffle';

describe('generateSquadRivalrySchedule', () => {
  const players = ['P1','P2','P3','P4','P5','P6','P7','P8','P9','P10'];

  it('splits players into two squads of 5', () => {
    const { squads } = generateSquadRivalrySchedule(players, 12, 'seed-b');
    expect(squads.gold).toHaveLength(5);
    expect(squads.black).toHaveLength(5);
    const all = [...squads.gold, ...squads.black];
    expect(new Set(all).size).toBe(10);
  });

  it('every court match is gold vs black, never same-squad', () => {
    const { squads, rounds } = generateSquadRivalrySchedule(players, 12, 'seed-b');
    const goldSet = new Set(squads.gold);
    for (const round of rounds) {
      for (const court of [round.court1, round.court2]) {
        const teamAIsGold = court.teamA.every(p => goldSet.has(p));
        const teamBIsGold = court.teamB.every(p => goldSet.has(p));
        expect(teamAIsGold).not.toBe(teamBIsGold); // one team all-gold, other all-black
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const a = generateSquadRivalrySchedule(players, 12, 'seed-b');
    const b = generateSquadRivalrySchedule(players, 12, 'seed-b');
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/shuffle.test.ts`
Expected: FAIL — `generateSquadRivalrySchedule` is not exported.

- [ ] **Step 3: Implement squad rivalry schedule generation**

Append to `lib/shuffle.ts`:
```typescript
export interface Squads {
  gold: string[];
  black: string[];
}

export interface SquadRivalrySchedule {
  squads: Squads;
  rounds: ScrambleRound[];
}

export function generateSquadRivalrySchedule(
  players: string[],
  roundCount: number,
  seed: string
): SquadRivalrySchedule {
  if (players.length !== 10) {
    throw new Error(`generateSquadRivalrySchedule requires exactly 10 players, got ${players.length}`);
  }
  const rand = seededRandom(seed);
  const shuffled = shuffleArray(players, rand);
  const squads: Squads = { gold: shuffled.slice(0, 5), black: shuffled.slice(5, 10) };

  const goldSitCounts = new Map(squads.gold.map(p => [p, 0]));
  const blackSitCounts = new Map(squads.black.map(p => [p, 0]));
  const partnerCounts = new Map<string, number>();
  const pairKey = (a: string, b: string) => [a, b].sort().join('|');

  function pickSquadSitOut(squad: string[], sitCounts: Map<string, number>): string {
    const tieBreakers = new Map(squad.map(p => [p, rand()]));
    const sorted = [...squad].sort((a, b) => {
      const diff = sitCounts.get(a)! - sitCounts.get(b)!;
      return diff !== 0 ? diff : tieBreakers.get(a)! - tieBreakers.get(b)!;
    });
    const chosen = sorted[0];
    sitCounts.set(chosen, sitCounts.get(chosen)! + 1);
    return chosen;
  }

  // Pairs 4 players from one squad into 2 partner-teams, minimizing repeats.
  function pairSquadIntoTwoTeams(fourPlayers: string[]): [[string, string], [string, string]] {
    const pool = shuffleArray(fourPlayers, rand);
    const used = new Set<string>();
    const teams: [string, string][] = [];
    for (const p of pool) {
      if (used.has(p)) continue;
      let bestPartner: string | null = null;
      let bestCount = Infinity;
      for (const q of pool) {
        if (q === p || used.has(q)) continue;
        const count = partnerCounts.get(pairKey(p, q)) ?? 0;
        if (count < bestCount) {
          bestCount = count;
          bestPartner = q;
        }
      }
      if (bestPartner) {
        teams.push([p, bestPartner]);
        used.add(p);
        used.add(bestPartner);
        const key = pairKey(p, bestPartner);
        partnerCounts.set(key, (partnerCounts.get(key) ?? 0) + 1);
      }
    }
    return [teams[0], teams[1]];
  }

  const rounds: ScrambleRound[] = [];
  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber++) {
    const goldSitOut = pickSquadSitOut(squads.gold, goldSitCounts);
    const blackSitOut = pickSquadSitOut(squads.black, blackSitCounts);
    const goldPlaying = squads.gold.filter(p => p !== goldSitOut);
    const blackPlaying = squads.black.filter(p => p !== blackSitOut);

    const [goldTeam1, goldTeam2] = pairSquadIntoTwoTeams(goldPlaying);
    const [blackTeam1, blackTeam2] = pairSquadIntoTwoTeams(blackPlaying);

    rounds.push({
      roundNumber,
      court1: { teamA: goldTeam1, teamB: blackTeam1 },
      court2: { teamA: goldTeam2, teamB: blackTeam2 },
      sittingOut: [goldSitOut, blackSitOut],
    });
  }

  return { squads, rounds };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/shuffle.test.ts`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Commit**

```bash
git add lib/shuffle.ts lib/shuffle.test.ts
git commit -m "Implement squad rivalry schedule generation"
```

---

## Phase 3: Data Layer (Supabase helpers)

Per this project's convention (see CLAUDE.md verification-depth-by-tier guidance in the sibling life-os project), pure logic gets full TDD; thin DB-glue code gets type-check + one manual smoke test against the real Supabase project rather than a mocked unit-test suite — mocking supabase-js round-trips buys little for a hobby app of this size.

### Task 3.1: Supabase client + session/round helpers

**Files:**
- Create: `lib/supabase.ts`
- Create: `lib/db.ts`

- [ ] **Step 1: Create Supabase client singleton**

Create `lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 2: Write db helper functions**

Create `lib/db.ts`:
```typescript
import { supabase } from './supabase';
import type { ScrambleRound, Squads } from './shuffle';

export type Format = 'scramble' | 'squad_rivalry';

export interface SessionRow {
  id: string;
  created_at: string;
  format: Format;
  players: string[];
  squads: Squads | null;
  round_count: number;
  status: 'setup' | 'in_progress' | 'completed';
}

export interface RoundRow {
  id: string;
  session_id: string;
  round_number: number;
  court: 1 | 2;
  team_a: [string, string];
  team_b: [string, string];
  sitting_out: string[];
  score_a: number | null;
  score_b: number | null;
}

function randomSessionId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function createSession(
  players: string[],
  format: Format,
  roundCount: number,
  squads: Squads | null
): Promise<string> {
  const id = randomSessionId();
  const { error } = await supabase.from('sessions').insert({
    id,
    format,
    players,
    squads,
    round_count: roundCount,
    status: 'in_progress',
  });
  if (error) throw error;
  return id;
}

export async function insertRounds(sessionId: string, rounds: ScrambleRound[]): Promise<void> {
  const rows = rounds.flatMap(r => [
    {
      session_id: sessionId,
      round_number: r.roundNumber,
      court: 1,
      team_a: r.court1.teamA,
      team_b: r.court1.teamB,
      sitting_out: r.sittingOut,
      score_a: null,
      score_b: null,
    },
    {
      session_id: sessionId,
      round_number: r.roundNumber,
      court: 2,
      team_a: r.court2.teamA,
      team_b: r.court2.teamB,
      sitting_out: r.sittingOut,
      score_a: null,
      score_b: null,
    },
  ]);
  const { error } = await supabase.from('rounds').insert(rows);
  if (error) throw error;
}

export async function getSession(sessionId: string): Promise<SessionRow> {
  const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
  if (error) throw error;
  return data as SessionRow;
}

export async function getRounds(sessionId: string): Promise<RoundRow[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('session_id', sessionId)
    .order('round_number', { ascending: true })
    .order('court', { ascending: true });
  if (error) throw error;
  return data as RoundRow[];
}

export async function updateRoundScore(
  roundId: string,
  scoreA: number,
  scoreB: number
): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update({ score_a: scoreA, score_b: scoreB })
    .eq('id', roundId);
  if (error) throw error;
}

export async function markSessionCompleted(sessionId: string): Promise<void> {
  const { error } = await supabase.from('sessions').update({ status: 'completed' }).eq('id', sessionId);
  if (error) throw error;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke test against real Supabase**

Run: `npm run dev`, then in the browser console at `http://localhost:3000` (or a scratch `.mjs` script run via `node`), call `createSession(['a','b','c','d','e','f','g','h','i','j'], 'scramble', 3, null)` and confirm a new row appears in the Supabase Table Editor under `sessions`. Delete the test row afterward.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase.ts lib/db.ts
git commit -m "Add Supabase client and session/round data helpers"
```

---

## Phase 4: Setup Screen

### Task 4.1: Home screen with "New Session" entry point

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Write home screen**

Modify `app/page.tsx`:
```tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: 24, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <h1>Pickleball Session</h1>
      <p>Set up tonight&apos;s players, format, and rounds.</p>
      <Link
        href="/setup"
        style={{
          display: 'inline-block',
          marginTop: 24,
          padding: '16px 32px',
          background: '#1a5f3f',
          color: 'white',
          borderRadius: 8,
          textDecoration: 'none',
          fontSize: 18,
        }}
      >
        New Session
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: Manual verify**

Run: `npm run dev`, open `http://localhost:3000`, confirm "New Session" button renders and links to `/setup` (404 is fine until Task 4.2 lands).

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "Add home screen with New Session entry point"
```

### Task 4.2: Setup form (players, format, round count)

**Files:**
- Create: `app/setup/page.tsx`

- [ ] **Step 1: Write setup form component**

Create `app/setup/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateScrambleSchedule, generateSquadRivalrySchedule } from '@/lib/shuffle';
import { createSession, insertRounds } from '@/lib/db';

export default function SetupPage() {
  const router = useRouter();
  const [names, setNames] = useState<string[]>(Array(10).fill(''));
  const [format, setFormat] = useState<'scramble' | 'squad_rivalry'>('scramble');
  const [roundCount, setRoundCount] = useState(12);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateName(index: number, value: string) {
    const copy = [...names];
    copy[index] = value;
    setNames(copy);
  }

  async function handleGenerate() {
    setError(null);
    const trimmed = names.map(n => n.trim());
    if (trimmed.some(n => n.length === 0)) {
      setError('All 10 player names are required.');
      return;
    }
    if (new Set(trimmed).size !== 10) {
      setError('Player names must be unique.');
      return;
    }
    setSubmitting(true);
    try {
      const seed = `${Date.now()}`;
      if (format === 'scramble') {
        const rounds = generateScrambleSchedule(trimmed, roundCount, seed);
        const sessionId = await createSession(trimmed, 'scramble', roundCount, null);
        await insertRounds(sessionId, rounds);
        router.push(`/session/${sessionId}/schedule`);
      } else {
        const { squads, rounds } = generateSquadRivalrySchedule(trimmed, roundCount, seed);
        const sessionId = await createSession(trimmed, 'squad_rivalry', roundCount, squads);
        await insertRounds(sessionId, rounds);
        router.push(`/session/${sessionId}/schedule`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create session.');
      setSubmitting(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <h1>Session Setup</h1>

      <h2>Players (10)</h2>
      {names.map((name, i) => (
        <input
          key={i}
          value={name}
          onChange={e => updateName(i, e.target.value)}
          placeholder={`Player ${i + 1}`}
          style={{ display: 'block', width: '100%', padding: 12, marginBottom: 8, fontSize: 16 }}
        />
      ))}

      <h2>Format</h2>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <input
          type="radio"
          checked={format === 'scramble'}
          onChange={() => setFormat('scramble')}
        />{' '}
        Scramble — random partners every round
      </label>
      <label style={{ display: 'block', marginBottom: 16 }}>
        <input
          type="radio"
          checked={format === 'squad_rivalry'}
          onChange={() => setFormat('squad_rivalry')}
        />{' '}
        Squad Rivalry — 2 fixed squads all night, partners rotate within squad
      </label>

      <h2>Rounds</h2>
      <input
        type="number"
        value={roundCount}
        onChange={e => setRoundCount(Number(e.target.value))}
        min={1}
        style={{ padding: 12, fontSize: 16, marginBottom: 16, width: 100 }}
      />

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={submitting}
        style={{ padding: '16px 32px', fontSize: 18, background: '#1a5f3f', color: 'white', border: 'none', borderRadius: 8 }}
      >
        {submitting ? 'Generating…' : 'Generate Schedule'}
      </button>
    </main>
  );
}
```

- [ ] **Step 2: Manual verify**

Run: `npm run dev`, open `http://localhost:3000/setup`, fill 10 unique names, pick Scramble, click Generate Schedule. Confirm no console errors and it navigates to `/session/<id>/schedule` (404 expected until Phase 5 lands — confirm the URL contains a generated id). Check Supabase Table Editor: one new `sessions` row and `round_count * 2` new `rounds` rows.

- [ ] **Step 3: Commit**

```bash
git add app/setup/page.tsx
git commit -m "Add session setup form for players, format, and round count"
```

---

## Phase 5: Schedule / Share View

### Task 5.1: Schedule display + WhatsApp text export

**Files:**
- Create: `app/session/[id]/schedule/page.tsx`
- Create: `lib/scheduleText.ts`
- Test: `lib/scheduleText.test.ts`

- [ ] **Step 1: Write failing test for text export formatting**

Create `lib/scheduleText.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { formatScheduleAsText } from './scheduleText';
import type { RoundRow } from './db';

describe('formatScheduleAsText', () => {
  it('formats rounds grouped by round number with both courts and sit-outs', () => {
    const rounds: RoundRow[] = [
      { id: '1', session_id: 's', round_number: 1, court: 1, team_a: ['A', 'B'], team_b: ['C', 'D'], sitting_out: ['I', 'J'], score_a: null, score_b: null },
      { id: '2', session_id: 's', round_number: 1, court: 2, team_a: ['E', 'F'], team_b: ['G', 'H'], sitting_out: ['I', 'J'], score_a: null, score_b: null },
    ];
    const text = formatScheduleAsText(rounds);
    expect(text).toContain('Round 1');
    expect(text).toContain('Court 1: A & B vs C & D');
    expect(text).toContain('Court 2: E & F vs G & H');
    expect(text).toContain('Sitting: I, J');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scheduleText.test.ts`
Expected: FAIL — module `./scheduleText` doesn't exist.

- [ ] **Step 3: Implement formatScheduleAsText**

Create `lib/scheduleText.ts`:
```typescript
import type { RoundRow } from './db';

export function formatScheduleAsText(rounds: RoundRow[]): string {
  const byRound = new Map<number, RoundRow[]>();
  for (const r of rounds) {
    const list = byRound.get(r.round_number) ?? [];
    list.push(r);
    byRound.set(r.round_number, list);
  }

  const lines: string[] = [];
  const sortedRoundNumbers = [...byRound.keys()].sort((a, b) => a - b);
  for (const roundNumber of sortedRoundNumbers) {
    const courts = byRound.get(roundNumber)!.sort((a, b) => a.court - b.court);
    lines.push(`Round ${roundNumber}`);
    for (const c of courts) {
      lines.push(`Court ${c.court}: ${c.team_a.join(' & ')} vs ${c.team_b.join(' & ')}`);
    }
    lines.push(`Sitting: ${courts[0].sitting_out.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/scheduleText.test.ts`
Expected: PASS

- [ ] **Step 5: Build the schedule page**

Create `app/session/[id]/schedule/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getRounds, type RoundRow } from '@/lib/db';
import { formatScheduleAsText } from '@/lib/scheduleText';

export default function SchedulePage({ params }: { params: { id: string } }) {
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getRounds(params.id).then(setRounds);
  }, [params.id]);

  const byRound = new Map<number, RoundRow[]>();
  for (const r of rounds) {
    const list = byRound.get(r.round_number) ?? [];
    list.push(r);
    byRound.set(r.round_number, list);
  }
  const sortedRoundNumbers = [...byRound.keys()].sort((a, b) => a - b);

  async function handleCopy() {
    await navigator.clipboard.writeText(formatScheduleAsText(rounds));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <h1>Schedule</h1>
      <button
        onClick={handleCopy}
        style={{ padding: '12px 24px', fontSize: 16, marginBottom: 16, background: '#1a5f3f', color: 'white', border: 'none', borderRadius: 8 }}
      >
        {copied ? 'Copied!' : 'Copy as WhatsApp text'}
      </button>
      {sortedRoundNumbers.map(roundNumber => {
        const courts = byRound.get(roundNumber)!.sort((a, b) => a.court - b.court);
        return (
          <div key={roundNumber} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #ddd' }}>
            <strong>Round {roundNumber}</strong>
            {courts.map(c => (
              <div key={c.court}>Court {c.court}: {c.team_a.join(' & ')} vs {c.team_b.join(' & ')}</div>
            ))}
            <div>Sitting: {courts[0].sitting_out.join(', ')}</div>
          </div>
        );
      })}
      <Link href={`/session/${params.id}/play`}>Start Scoring →</Link>
    </main>
  );
}
```

- [ ] **Step 6: Manual verify**

Run: `npm run dev`, navigate to a session's `/schedule` URL from Task 4.2's test run, confirm all rounds render, "Copy as WhatsApp text" populates clipboard correctly (paste into a text editor to confirm format matches spec).

- [ ] **Step 7: Commit**

```bash
git add lib/scheduleText.ts lib/scheduleText.test.ts app/session/[id]/schedule/page.tsx
git commit -m "Add schedule display and WhatsApp text export"
```

---

## Phase 6: Live Scoring

### Task 6.1: Score entry + edit past rounds

**Files:**
- Create: `app/session/[id]/play/page.tsx`

- [ ] **Step 1: Write live scoring page**

Create `app/session/[id]/play/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, getRounds, updateRoundScore, markSessionCompleted, type RoundRow, type SessionRow } from '@/lib/db';

export default function PlayPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [activeRoundNumber, setActiveRoundNumber] = useState(1);
  const [scoreInputs, setScoreInputs] = useState<Record<number, [string, string]>>({});

  async function reload() {
    const [s, r] = await Promise.all([getSession(params.id), getRounds(params.id)]);
    setSession(s);
    setRounds(r);
    const firstIncomplete = [...new Set(r.map(x => x.round_number))]
      .sort((a, b) => a - b)
      .find(rn => r.filter(x => x.round_number === rn).some(x => x.score_a === null));
    setActiveRoundNumber(firstIncomplete ?? 1);
  }

  useEffect(() => {
    reload();
  }, [params.id]);

  const roundNumbers = [...new Set(rounds.map(r => r.round_number))].sort((a, b) => a - b);

  async function handleSaveRound(roundNumber: number) {
    const courts = rounds.filter(r => r.round_number === roundNumber);
    for (const court of courts) {
      const input = scoreInputs[court.court];
      if (!input || input[0] === '' || input[1] === '') continue;
      await updateRoundScore(court.id, Number(input[0]), Number(input[1]));
    }
    // Re-derive the next active round from actual data rather than blindly
    // incrementing — otherwise editing a past round (via "jump to a round")
    // after the session was already fully scored would incorrectly force
    // navigation forward instead of respecting the real completion state.
    const updatedRounds = await getRounds(params.id);
    setRounds(updatedRounds);
    const stillIncomplete = [...new Set(updatedRounds.map(x => x.round_number))]
      .sort((a, b) => a - b)
      .find(rn => updatedRounds.filter(x => x.round_number === rn).some(x => x.score_a === null));
    if (stillIncomplete === undefined) {
      await markSessionCompleted(params.id);
      router.push(`/session/${params.id}/results`);
    } else {
      setActiveRoundNumber(stillIncomplete);
    }
  }

  const activeCourts = rounds.filter(r => r.round_number === activeRoundNumber).sort((a, b) => a.court - b.court);

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <h1>Round {activeRoundNumber} of {session?.round_count ?? '…'}</h1>

      {activeCourts.map(court => (
        <div key={court.id} style={{ marginBottom: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <div>Court {court.court}: {court.team_a.join(' & ')} vs {court.team_b.join(' & ')}</div>
          <input
            type="number"
            placeholder={`${court.team_a.join(' & ')} score`}
            defaultValue={court.score_a ?? ''}
            onChange={e =>
              setScoreInputs(prev => ({ ...prev, [court.court]: [e.target.value, prev[court.court]?.[1] ?? ''] }))
            }
            style={{ padding: 8, marginRight: 8, width: 80 }}
          />
          <input
            type="number"
            placeholder={`${court.team_b.join(' & ')} score`}
            defaultValue={court.score_b ?? ''}
            onChange={e =>
              setScoreInputs(prev => ({ ...prev, [court.court]: [prev[court.court]?.[0] ?? '', e.target.value] }))
            }
            style={{ padding: 8, width: 80 }}
          />
        </div>
      ))}

      <button
        onClick={() => handleSaveRound(activeRoundNumber)}
        style={{ padding: '16px 32px', fontSize: 18, background: '#1a5f3f', color: 'white', border: 'none', borderRadius: 8 }}
      >
        Save & Next Round
      </button>

      <h2 style={{ marginTop: 32 }}>Jump to a round to edit</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {roundNumbers.map(rn => (
          <button
            key={rn}
            onClick={() => setActiveRoundNumber(rn)}
            style={{ padding: 8, background: rn === activeRoundNumber ? '#1a5f3f' : '#eee', color: rn === activeRoundNumber ? 'white' : 'black', border: 'none', borderRadius: 4 }}
          >
            {rn}
          </button>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Manual verify**

Run: `npm run dev`, navigate through `/session/<id>/play`, enter scores for round 1, click Save & Next Round, confirm it advances to round 2 and Supabase `rounds` table shows the saved scores. Click a lower round number button to jump back, change a score, save, confirm the update persists (edit-past-round capability).

- [ ] **Step 3: Commit**

```bash
git add "app/session/[id]/play/page.tsx"
git commit -m "Add live scoring screen with edit-past-round support"
```

---

## Phase 7: Results & Analytics

### Task 7.1: Leaderboard computation (pure function, TDD)

**Files:**
- Create: `lib/analytics.ts`
- Test: `lib/analytics.test.ts`

- [ ] **Step 1: Write failing tests for leaderboard computation**

Create `lib/analytics.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { computeLeaderboard } from './analytics';
import type { RoundRow } from './db';

describe('computeLeaderboard', () => {
  const rounds: RoundRow[] = [
    { id: '1', session_id: 's', round_number: 1, court: 1, team_a: ['A', 'B'], team_b: ['C', 'D'], sitting_out: [], score_a: 15, score_b: 10 },
    { id: '2', session_id: 's', round_number: 2, court: 1, team_a: ['A', 'C'], team_b: ['B', 'D'], sitting_out: [], score_a: 12, score_b: 15 },
  ];

  it('counts wins, losses, and points for each player across rounds', () => {
    const board = computeLeaderboard(rounds);
    const a = board.find(p => p.name === 'A')!;
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(1);
    expect(a.pointsFor).toBe(27);
    expect(a.pointsAgainst).toBe(25);
  });

  it('ignores rounds with null scores (not yet played)', () => {
    const withPending: RoundRow[] = [
      ...rounds,
      { id: '3', session_id: 's', round_number: 3, court: 1, team_a: ['A', 'B'], team_b: ['C', 'D'], sitting_out: [], score_a: null, score_b: null },
    ];
    const board = computeLeaderboard(withPending);
    const a = board.find(p => p.name === 'A')!;
    expect(a.wins + a.losses).toBe(2);
  });

  it('sorts by wins descending, tiebreak by point differential descending', () => {
    const board = computeLeaderboard(rounds);
    for (let i = 1; i < board.length; i++) {
      const prev = board[i - 1];
      const curr = board[i];
      const prevDiff = prev.pointsFor - prev.pointsAgainst;
      const currDiff = curr.pointsFor - curr.pointsAgainst;
      expect(prev.wins > curr.wins || (prev.wins === curr.wins && prevDiff >= currDiff)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/analytics.test.ts`
Expected: FAIL — module `./analytics` doesn't exist.

- [ ] **Step 3: Implement computeLeaderboard**

Create `lib/analytics.ts`:
```typescript
import type { RoundRow } from './db';

export interface PlayerStats {
  name: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  gamesPlayed: number;
  winPct: number;
}

export function computeLeaderboard(rounds: RoundRow[]): PlayerStats[] {
  const stats = new Map<string, PlayerStats>();

  function getOrCreate(name: string): PlayerStats {
    if (!stats.has(name)) {
      stats.set(name, { name, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, gamesPlayed: 0, winPct: 0 });
    }
    return stats.get(name)!;
  }

  for (const round of rounds) {
    if (round.score_a === null || round.score_b === null) continue;
    const aWon = round.score_a > round.score_b;

    for (const name of round.team_a) {
      const s = getOrCreate(name);
      s.gamesPlayed++;
      s.pointsFor += round.score_a;
      s.pointsAgainst += round.score_b;
      if (aWon) s.wins++;
      else s.losses++;
    }
    for (const name of round.team_b) {
      const s = getOrCreate(name);
      s.gamesPlayed++;
      s.pointsFor += round.score_b;
      s.pointsAgainst += round.score_a;
      if (!aWon) s.wins++;
      else s.losses++;
    }
  }

  const list = [...stats.values()];
  for (const s of list) {
    s.winPct = s.gamesPlayed > 0 ? s.wins / s.gamesPlayed : 0;
  }

  list.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const diffA = a.pointsFor - a.pointsAgainst;
    const diffB = b.pointsFor - b.pointsAgainst;
    return diffB - diffA;
  });

  return list;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/analytics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/analytics.ts lib/analytics.test.ts
git commit -m "Add leaderboard computation with win/loss/points tracking"
```

### Task 7.2: Squad total score computation (Squad Rivalry only)

**Files:**
- Modify: `lib/analytics.ts`
- Modify: `lib/analytics.test.ts`

- [ ] **Step 1: Write failing test for squad totals**

Append to `lib/analytics.test.ts`:
```typescript
import { computeSquadTotals } from './analytics';

describe('computeSquadTotals', () => {
  it('sums points for each squad across all rounds', () => {
    const rounds: RoundRow[] = [
      { id: '1', session_id: 's', round_number: 1, court: 1, team_a: ['G1', 'G2'], team_b: ['B1', 'B2'], sitting_out: [], score_a: 15, score_b: 10 },
      { id: '2', session_id: 's', round_number: 1, court: 2, team_a: ['G3', 'G4'], team_b: ['B3', 'B4'], sitting_out: [], score_a: 10, score_b: 15 },
    ];
    const squads = { gold: ['G1', 'G2', 'G3', 'G4', 'G5'], black: ['B1', 'B2', 'B3', 'B4', 'B5'] };
    const totals = computeSquadTotals(rounds, squads);
    expect(totals.gold).toBe(25);
    expect(totals.black).toBe(25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/analytics.test.ts`
Expected: FAIL — `computeSquadTotals` is not exported.

- [ ] **Step 3: Implement computeSquadTotals**

Append to `lib/analytics.ts`:
```typescript
import type { Squads } from './shuffle';

export function computeSquadTotals(rounds: RoundRow[], squads: Squads): { gold: number; black: number } {
  const goldSet = new Set(squads.gold);
  let gold = 0;
  let black = 0;

  for (const round of rounds) {
    if (round.score_a === null || round.score_b === null) continue;
    const teamAIsGold = round.team_a.every(p => goldSet.has(p));
    if (teamAIsGold) {
      gold += round.score_a;
      black += round.score_b;
    } else {
      black += round.score_a;
      gold += round.score_b;
    }
  }

  return { gold, black };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/analytics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/analytics.ts lib/analytics.test.ts
git commit -m "Add squad total score computation for Squad Rivalry sessions"
```

### Task 7.3: Results page (podium, leaderboard table, charts)

**Files:**
- Create: `app/session/[id]/results/page.tsx`

- [ ] **Step 1: Write results page**

Create `app/session/[id]/results/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { getSession, getRounds, type RoundRow, type SessionRow } from '@/lib/db';
import { computeLeaderboard, computeSquadTotals, type PlayerStats } from '@/lib/analytics';

export default function ResultsPage({ params }: { params: { id: string } }) {
  const [session, setSession] = useState<SessionRow | null>(null);
  const [leaderboard, setLeaderboard] = useState<PlayerStats[]>([]);
  const [squadTotals, setSquadTotals] = useState<{ gold: number; black: number } | null>(null);

  useEffect(() => {
    async function load() {
      const [s, rounds] = await Promise.all([getSession(params.id), getRounds(params.id)]);
      setSession(s);
      setLeaderboard(computeLeaderboard(rounds));
      if (s.format === 'squad_rivalry' && s.squads) {
        setSquadTotals(computeSquadTotals(rounds, s.squads));
      }
    }
    load();
  }, [params.id]);

  const top3 = leaderboard.slice(0, 3);
  const maxPoints = Math.max(1, ...leaderboard.map(p => Math.max(p.pointsFor, p.pointsAgainst)));

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <h1>Results</h1>

      {squadTotals && (
        <div style={{ marginBottom: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
          <strong>Squad Totals</strong>
          <div>Gold: {squadTotals.gold}</div>
          <div>Black: {squadTotals.black}</div>
        </div>
      )}

      <h2>Podium</h2>
      <ol>
        {top3.map(p => (
          <li key={p.name}>{p.name} — {p.wins}W {p.losses}L ({(p.winPct * 100).toFixed(0)}%)</li>
        ))}
      </ol>

      <h2>Full Leaderboard</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Player</th>
            <th>W</th>
            <th>L</th>
            <th>Pts For</th>
            <th>Pts Against</th>
            <th>Diff</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map(p => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td style={{ textAlign: 'center' }}>{p.wins}</td>
              <td style={{ textAlign: 'center' }}>{p.losses}</td>
              <td style={{ textAlign: 'center' }}>{p.pointsFor}</td>
              <td style={{ textAlign: 'center' }}>{p.pointsAgainst}</td>
              <td style={{ textAlign: 'center' }}>{p.pointsFor - p.pointsAgainst}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 24 }}>Wins per Player</h2>
      {leaderboard.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ width: 80, fontSize: 12 }}>{p.name}</div>
          <div style={{ background: '#1a5f3f', height: 16, width: `${(p.wins / Math.max(1, session?.round_count ?? 1)) * 200}px` }} />
          <div style={{ marginLeft: 8, fontSize: 12 }}>{p.wins}</div>
        </div>
      ))}
    </main>
  );
}
```

- [ ] **Step 2: Manual verify**

Run: `npm run dev`, complete all rounds of a test session via `/play`, confirm redirect to `/results`, verify podium/leaderboard/chart numbers match manually-computed expectations from the test scores entered.

- [ ] **Step 3: Commit**

```bash
git add "app/session/[id]/results/page.tsx"
git commit -m "Add results page with podium, leaderboard, and wins chart"
```

---

## Phase 8: Deploy

### Task 8.1: Deploy to Vercel

**Files:** none (deployment config only)

- [ ] **Step 1: Push repo to GitHub**

Run:
```bash
gh repo create pickleball-app --private --source=. --remote=origin
git push -u origin main
```

- [ ] **Step 2: Import project in Vercel**

In the Vercel dashboard, import the `pickleball-app` GitHub repo. Set environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same values as `.env.local`) in Vercel's project settings.

- [ ] **Step 3: Verify production deploy**

After Vercel finishes the build, open the production URL on the iPhone, run through Setup → Schedule → one round of scoring → Results end to end, confirm no console errors (Safari remote debugging or just visual check) and data persists in Supabase.

- [ ] **Step 4: Commit any deployment-related config if Vercel generates one**

```bash
git add -A
git commit -m "Add Vercel deployment config" --allow-empty
```

---

## Self-Review Notes

- **Spec coverage:** Home/New Session (Task 4.1), Setup with format+round count (4.2), balanced-shuffle for both formats (2.2, 2.3), schedule/share view with WhatsApp export (5.1), live scoring with edit-past-round (6.1), results/analytics/podium/squad totals (7.1-7.3), Supabase persistence with no-auth open policies (1.2, 3.1), deploy (8.1). All spec sections have a corresponding task.
- **Placeholder scan:** no TBD/TODO markers; every step has complete runnable code.
- **Type consistency:** `RoundRow`, `SessionRow`, `ScrambleRound`, `Squads`, `PlayerStats` are defined once (in `lib/db.ts` and `lib/shuffle.ts`) and reused with identical shapes across `lib/analytics.ts` and all page components — no renamed duplicates.
