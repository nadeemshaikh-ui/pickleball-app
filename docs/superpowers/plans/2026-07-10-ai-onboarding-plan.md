# AI-Based Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the auto-triggered, chip-driven onboarding wizard specified in `docs/superpowers/specs/2026-07-10-ai-onboarding-design.md` — new signups pick admin (create club) or player (join club), set up their player profile, see a 3-card core-loop tour, and land in `/setup`.

**Architecture:** A new `user_onboarding` table + `AuthGate` client component (mounted in `app/layout.tsx`) redirects any signed-in user with no completed-onboarding row to a new `/onboarding` page. That page is a single-file step orchestrator rendering one of six small step components in `components/onboarding/`, each wrapping an existing data function (`createClub`, `joinClubByCode`, `requestToJoinClub`, `upsertOwnPlayer`) that's already used elsewhere in the app — no new backend logic beyond the onboarding-completion tracking itself.

**Tech Stack:** Next.js App Router (client components), Supabase (Postgres + RLS), Vitest for the one pure-logic unit test in this plan (no component-testing framework is installed in this repo — see Task 11 for how UI tasks are verified instead).

---

## Reference: existing functions this plan reuses (do not redefine)

- `createClub(name: string, logoFile: File | null): Promise<ClubRow>` — `lib/clubs.ts:63`
- `joinClubByCode(code: string): Promise<ClubRow>` — `lib/clubs.ts:85`
- `searchClubsByName(query: string): Promise<ClubRow[]>` — `lib/clubs.ts:100`
- `requestToJoinClub(clubId: string): Promise<void>` — `lib/clubs.ts:107`
- `upsertOwnPlayer(options: { clubId, userId, name, nickname, photoUrl, bio }): Promise<void>` — `lib/players.ts:65`
- `getOwnPlayer(clubId: string, userId: string): Promise<PlayerRow | null>` — `lib/players.ts:50`
- `uploadPlayerPhoto(file: File): Promise<string>` — `lib/db.ts:124`
- `getCurrentUser(): Promise<User | null>` — `lib/auth.ts`
- `useCurrentClub()` — `lib/useCurrentClub.ts` — returns `{ clubs, currentClubId, setCurrentClubId, user, loading, refresh }`

CSS classes already defined in `app/globals.css` and used throughout: `.page`, `.card`, `.btn-primary`, `.btn-secondary`, `.text-link-btn`.

---

### Task 1: Database — `user_onboarding` table + RLS + backfill

**Files:** none (schema change applied directly via the Supabase MCP, matching how `clubs`/`club_members` were created earlier — this repo has no tracked migrations directory).

- [ ] **Step 1: Apply the migration**

Call `mcp__supabase__apply_migration` with `project_id: "ltbnjtgzpwxulbczmzdr"`, `name: "create_user_onboarding"`, and this SQL:

```sql
create table user_onboarding (
  user_id uuid primary key references auth.users(id),
  onboarded_at timestamptz not null default now()
);

alter table user_onboarding enable row level security;

create policy "user_onboarding self insert" on user_onboarding
  for insert with check (auth.uid() = user_id);

create policy "user_onboarding self read" on user_onboarding
  for select using (auth.uid() = user_id);

insert into user_onboarding (user_id)
select distinct user_id from club_members
on conflict (user_id) do nothing;
```

- [ ] **Step 2: Verify the backfill**

Call `mcp__supabase__execute_sql` with `project_id: "ltbnjtgzpwxulbczmzdr"`:

```sql
select count(*) from user_onboarding;
```

Expected: matches the current `club_members` distinct-user count (1, for the sole real user as of this plan's writing) — confirms the backfill ran and nobody currently using the app will see the wizard.

- [ ] **Step 3: Live RLS round-trip check**

Call `mcp__supabase__execute_sql` with `project_id: "ltbnjtgzpwxulbczmzdr"`:

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select * from user_onboarding where user_id = '00000000-0000-0000-0000-000000000001';
insert into user_onboarding (user_id) values ('00000000-0000-0000-0000-000000000001');
select * from user_onboarding where user_id = '00000000-0000-0000-0000-000000000001';
delete from user_onboarding where user_id = '00000000-0000-0000-0000-000000000001';
reset role;
```

Expected: first `select` returns zero rows, `insert` succeeds, second `select` returns the one row, cleanup `delete` succeeds — confirms the self-insert/self-read policies work for an authenticated role scoped to their own `user_id`, and the fake UUID never touches real data.

---

### Task 2: `lib/onboarding.ts` — data access + step logic (TDD)

**Files:**
- Create: `lib/onboarding.ts`
- Test: `lib/onboarding.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/onboarding.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getInitialStep } from './onboarding';

describe('getInitialStep', () => {
  it('starts at the branch step for a user with no club', () => {
    expect(getInitialStep(false)).toBe('branch');
  });

  it('skips straight to the profile step for a user who already has a club', () => {
    expect(getInitialStep(true)).toBe('profile');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run lib/onboarding.test.ts`
Expected: FAIL — `Cannot find module './onboarding'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/onboarding.ts`:

```ts
import { supabase } from './supabase';

// Fail open on error (network blip, etc.) — never block a user out of the
// app because a completion check couldn't run. Worst case they see the
// wizard again next login, which is harmless.
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_onboarding')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return true;
  return Boolean(data);
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  const { error } = await supabase.from('user_onboarding').insert({ user_id: userId });
  if (error && error.code !== '23505') throw error; // duplicate insert is a no-op, not an error
}

export type OnboardingStep = 'branch' | 'create-club' | 'join-club' | 'profile' | 'tour' | 'done';

// Pure — decides which step a signed-in user with no completed-onboarding
// row should land on first. Someone who already belongs to a club (they
// closed the tab mid-wizard last time, or existed before this feature
// shipped and somehow has no user_onboarding row) skips straight to the
// profile step instead of being asked "new club or join?" again.
export function getInitialStep(hasClub: boolean): OnboardingStep {
  return hasClub ? 'profile' : 'branch';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run lib/onboarding.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/onboarding.ts lib/onboarding.test.ts
git commit -m "Add user_onboarding data access + step logic"
```

---

### Task 3: `AuthGate` — auto-trigger on first login

**Files:**
- Create: `components/AuthGate.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Write the component**

Create `components/AuthGate.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { hasCompletedOnboarding } from '@/lib/onboarding';

// Side-effect-only: renders nothing, just redirects a signed-in user who
// hasn't finished onboarding yet to /onboarding. This component lives in
// the root layout, which persists across client-side navigation in the
// App Router, so its check runs once per full page load (including the
// full-page redirect Supabase's Google OAuth flow does on sign-in) — the
// onboarding flow itself navigates away when it's done, so there's no
// need to re-check mid-session.
export default function AuthGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (checked || pathname?.startsWith('/onboarding')) return;
    async function check() {
      const user = await getCurrentUser();
      if (!user) {
        setChecked(true);
        return;
      }
      const done = await hasCompletedOnboarding(user.id);
      setChecked(true);
      if (!done) router.replace('/onboarding');
    }
    check();
  }, [checked, pathname, router]);

  return null;
}
```

- [ ] **Step 2: Wire it into the root layout**

In `app/layout.tsx`, add the import and mount it above `ClubSwitcher`:

```tsx
import DecorativeBackground from "@/components/DecorativeBackground";
import AuthGate from "@/components/AuthGate";
import ClubSwitcher from "@/components/ClubSwitcher";
```

```tsx
      <body>
        <DecorativeBackground />
        <AuthGate />
        <ClubSwitcher />
        {children}
      </body>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/AuthGate.tsx app/layout.tsx
git commit -m "Add AuthGate to redirect new signups into onboarding"
```

---

### Task 4: `BranchStep` component

**Files:** Create: `components/onboarding/BranchStep.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

export default function BranchStep({ onPick }: { onPick: (choice: 'create' | 'join') => void }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Are you starting a new club or joining one?</h2>
      <button className="btn-primary" onClick={() => onPick('create')}>
        🆕 Starting a new club
      </button>
      <button className="btn-secondary" onClick={() => onPick('join')}>
        🔗 Joining an existing club
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (component isn't imported anywhere yet, but must still be valid TSX).

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/BranchStep.tsx
git commit -m "Add onboarding BranchStep component"
```

---

### Task 5: `CreateClubStep` component

**Files:** Create: `components/onboarding/CreateClubStep.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useState } from 'react';
import { createClub } from '@/lib/clubs';

export default function CreateClubStep({ onDone }: { onDone: (clubId: string) => void }) {
  const [name, setName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Give your club a name.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const club = await createClub(name.trim(), logoFile);
      onDone(club.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create club.');
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Name your club</h2>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Sunday Smashers"
        aria-label="Club name"
        style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
      />
      <div>
        <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
          Logo (optional — can add later)
        </label>
        <input type="file" accept="image/*" aria-label="Club logo" onChange={e => setLogoFile(e.target.files?.[0] ?? null)} />
      </div>
      {error && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
      <button className="btn-primary" onClick={handleCreate} disabled={submitting}>
        {submitting ? 'Creating…' : 'Create Club'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/CreateClubStep.tsx
git commit -m "Add onboarding CreateClubStep component"
```

---

### Task 6: `JoinClubStep` component

**Files:** Create: `components/onboarding/JoinClubStep.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useState } from 'react';
import { joinClubByCode, searchClubsByName, requestToJoinClub, type ClubRow } from '@/lib/clubs';

interface JoinClubStepProps {
  onJoined: (clubId: string) => void;
  onRequestSent: () => void;
}

export default function JoinClubStep({ onJoined, onRequestSent }: JoinClubStepProps) {
  const [code, setCode] = useState('');
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClubRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [requestedClubName, setRequestedClubName] = useState<string | null>(null);

  async function handleJoinByCode() {
    if (!code.trim()) return;
    setCodeSubmitting(true);
    setCodeError(null);
    try {
      const club = await joinClubByCode(code);
      onJoined(club.id);
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : 'Failed to join.');
      setCodeSubmitting(false);
    }
  }

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await searchClubsByName(value));
    } finally {
      setSearching(false);
    }
  }

  async function handleRequest(club: ClubRow) {
    await requestToJoinClub(club.id);
    setRequestedClubName(club.name);
  }

  if (requestedClubName) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2>Request sent to {requestedClubName}</h2>
        <p style={{ color: 'var(--muted)' }}>We&apos;ll let you in once the admin approves you.</p>
        <button className="btn-primary" onClick={onRequestSent}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Have a join code?</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. ABC123"
          aria-label="Join code"
          style={{ flex: 1, minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8, textTransform: 'uppercase' }}
        />
        <button className="btn-primary" onClick={handleJoinByCode} disabled={codeSubmitting || !code.trim()} style={{ minHeight: 44, padding: '0 16px' }}>
          {codeSubmitting ? 'Joining…' : 'Join'}
        </button>
      </div>
      {codeError && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{codeError}</p>}

      <h2>Or find a club by name</h2>
      <input
        value={query}
        onChange={e => handleSearch(e.target.value)}
        placeholder="Search club name…"
        aria-label="Search clubs"
        style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
      />
      {searching && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Searching…</p>}
      {results.map(c => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, fontWeight: 700 }}>{c.name}</span>
          <button className="btn-secondary" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={() => handleRequest(c)}>
            Request to Join
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/JoinClubStep.tsx
git commit -m "Add onboarding JoinClubStep component"
```

---

### Task 7: `ProfileStep` component

**Files:** Create: `components/onboarding/ProfileStep.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getOwnPlayer, upsertOwnPlayer } from '@/lib/players';
import { uploadPlayerPhoto } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export default function ProfileStep({ clubId, onDone }: { clubId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const existing = await getOwnPlayer(clubId, user.id);
      if (existing) {
        setName(existing.name);
        setNickname(existing.nickname ?? '');
        setPhotoUrl(existing.photo_url);
      } else {
        setName(user.user_metadata?.full_name ?? '');
      }
      setLoading(false);
    }
    load();
  }, [clubId]);

  async function handlePhotoSelect(file: File | null) {
    if (!file) return;
    try {
      setPhotoUrl(await uploadPlayerPhoto(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Photo upload failed.');
    }
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in.');
      await upsertOwnPlayer({ clubId, userId: user.id, name: trimmed, nickname: nickname.trim() || null, photoUrl, bio: null });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed — that name might already be taken.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Set up your player profile</h2>
      {photoUrl && <img src={photoUrl} alt="" width={80} height={80} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
      <div>
        <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Photo (optional)</label>
        <input type="file" accept="image/*" onChange={e => handlePhotoSelect(e.target.files?.[0] ?? null)} />
      </div>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Full name"
        aria-label="Name"
        style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
      />
      <input
        value={nickname}
        onChange={e => setNickname(e.target.value)}
        placeholder="Nickname (optional)"
        aria-label="Nickname"
        style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
      />
      {error && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}
      <button className="btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Continue'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/ProfileStep.tsx
git commit -m "Add onboarding ProfileStep component"
```

---

### Task 8: `TourStep` component

**Files:** Create: `components/onboarding/TourStep.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useState } from 'react';

const CARDS = [
  {
    icon: '🏟️',
    title: 'Start a session',
    body: 'Pick your courts, add players, choose a format — Scramble, Fixed Partners, Court Blocks, or King of the Court.',
  },
  {
    icon: '📱',
    title: 'Score as you play',
    body: 'Tap in scores live, or use voice entry — just say the score out loud between points.',
  },
  {
    icon: '📊',
    title: 'Check stats & league',
    body: 'Every game feeds your lifetime stats, streaks, and League standings — find it all under 🏆 League.',
  },
];

export default function TourStep({ onSkip, onDone }: { onSkip: () => void; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const card = CARDS[index];
  const isLast = index === CARDS.length - 1;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 40 }}>{card.icon}</div>
      <h2>{card.title}</h2>
      <p style={{ color: 'var(--muted)' }}>{card.body}</p>
      <button className="btn-primary" onClick={() => (isLast ? onDone() : setIndex(i => i + 1))}>
        {isLast ? "Let's go!" : 'Next'}
      </button>
      <button className="text-link-btn" onClick={onSkip}>
        Skip
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/TourStep.tsx
git commit -m "Add onboarding TourStep component"
```

---

### Task 9: `DoneStep` component

**Files:** Create: `components/onboarding/DoneStep.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

export default function DoneStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>🎉</div>
      <h2>You&apos;re all set!</h2>
      <button className="btn-primary" onClick={onFinish}>
        Start a Session
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/DoneStep.tsx
git commit -m "Add onboarding DoneStep component"
```

---

### Task 10: `/onboarding` orchestrator page

**Files:** Create: `app/onboarding/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { useCurrentClub } from '@/lib/useCurrentClub';
import { markOnboardingComplete, getInitialStep, type OnboardingStep } from '@/lib/onboarding';
import BranchStep from '@/components/onboarding/BranchStep';
import CreateClubStep from '@/components/onboarding/CreateClubStep';
import JoinClubStep from '@/components/onboarding/JoinClubStep';
import ProfileStep from '@/components/onboarding/ProfileStep';
import TourStep from '@/components/onboarding/TourStep';
import DoneStep from '@/components/onboarding/DoneStep';

const PROGRESS_STEPS: OnboardingStep[] = ['branch', 'profile', 'tour', 'done'];

// create-club and join-club are sub-steps of the branch decision — they
// light up the same progress dot as 'branch' rather than getting their own.
function progressStepFor(step: OnboardingStep): OnboardingStep {
  return step === 'create-club' || step === 'join-club' ? 'branch' : step;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { clubs, currentClubId, setCurrentClubId, loading: clubLoading } = useCurrentClub();
  const [step, setStep] = useState<OnboardingStep | null>(null);
  const [activeClubId, setActiveClubId] = useState<string | null>(null);

  // Decide the starting step once club membership has loaded. Someone who
  // already belongs to a club (closed the tab mid-wizard last time) skips
  // straight to the profile step instead of re-asking "new club or join?".
  useEffect(() => {
    if (clubLoading || step !== null) return;
    setStep(getInitialStep(clubs.length > 0));
    if (clubs.length > 0 && currentClubId) setActiveClubId(currentClubId);
  }, [clubLoading, clubs, currentClubId, step]);

  async function finish() {
    const user = await getCurrentUser();
    if (user) await markOnboardingComplete(user.id);
    router.push('/setup');
  }

  if (step === null) {
    return (
      <main className="page">
        <p>Loading…</p>
      </main>
    );
  }

  const currentDotIndex = PROGRESS_STEPS.indexOf(progressStepFor(step));

  return (
    <main className="page">
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {PROGRESS_STEPS.map((s, i) => (
          <div
            key={s}
            style={{
              width: 24,
              height: 6,
              borderRadius: 3,
              background: i <= currentDotIndex ? 'var(--primary)' : 'var(--border)',
            }}
          />
        ))}
      </div>

      {step === 'branch' && <BranchStep onPick={choice => setStep(choice === 'create' ? 'create-club' : 'join-club')} />}

      {step === 'create-club' && (
        <CreateClubStep
          onDone={clubId => {
            setCurrentClubId(clubId);
            setActiveClubId(clubId);
            setStep('profile');
          }}
        />
      )}

      {step === 'join-club' && (
        <JoinClubStep
          onJoined={clubId => {
            setCurrentClubId(clubId);
            setActiveClubId(clubId);
            setStep('profile');
          }}
          onRequestSent={finish}
        />
      )}

      {step === 'profile' && activeClubId && <ProfileStep clubId={activeClubId} onDone={() => setStep('tour')} />}

      {step === 'tour' && <TourStep onSkip={finish} onDone={() => setStep('done')} />}

      {step === 'done' && <DoneStep onFinish={finish} />}
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Full test suite**

Run: `npm test -- --run`
Expected: PASS, all tests including the 2 new `lib/onboarding.test.ts` tests.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: succeeds, `/onboarding` appears in the route list.

- [ ] **Step 5: Commit**

```bash
git add app/onboarding/page.tsx
git commit -m "Add onboarding wizard orchestrator page"
```

---

### Task 11: End-to-end verification

**Files:** none (verification only; fix-forward in the relevant file from Tasks 1–10 if something's broken, then re-run this task).

No component-testing framework is installed in this repo (only pure-function `lib/*.test.ts` files exist today — see the codebase survey that informed this plan). This task is the deliberate substitute: a scripted manual click-through covering every path in the spec, using this session's `preview_*` tooling.

- [ ] **Step 1: Start preview and reset test state**

Start the dev server (`preview_start`). In Supabase, temporarily delete the `user_onboarding` row for your own test user (or use a second real Google account if available) so `AuthGate` triggers.

- [ ] **Step 2: Admin path — create club**

Sign in fresh. Confirm redirect to `/onboarding`, branch card shown. Click "Starting a new club" → fill name, skip logo → Create Club. Confirm redirect to profile step, name pre-filled from Google account.

- [ ] **Step 3: Admin path — profile + tour**

Fill/confirm name, save. Confirm tour step 1 of 3 shown. Click through all 3 "Next" taps. Confirm Done card shown, click "Start a Session" — confirm landed on `/setup` with no redirect loop back to `/onboarding`.

- [ ] **Step 4: Re-login does not re-trigger**

Sign out, sign back in as the same user. Confirm `/onboarding` does NOT show again — lands directly wherever navigation takes you.

- [ ] **Step 5: Player path — join by code**

Reset `user_onboarding` for the test user again (or use a second account). Sign in, pick "Joining an existing club", enter a valid join code. Confirm redirect to profile step, then tour, then Done, then `/setup`.

- [ ] **Step 6: Player path — request to join + Skip**

Reset onboarding state again. Pick "Joining an existing club", search by name instead, click "Request to Join". Confirm the "Request sent" card appears with a Done button; click it and confirm landing on `/setup` (not stuck, not looped back into onboarding).

- [ ] **Step 7: Skip button on tour**

Reset onboarding state, go through create-club + profile again, and on the tour step click "Skip" instead of stepping through. Confirm it goes straight to `/setup`.

- [ ] **Step 8: Already-has-a-club resume case**

Manually delete just the test user's `user_onboarding` row again while they still belong to a club (don't touch `club_members`). Reload any page. Confirm `AuthGate` redirects to `/onboarding`, and the wizard opens directly on the profile step — not the branch card.

- [ ] **Step 9: Existing user is unaffected**

Confirm the app's original real user (the one with a `user_onboarding` row from the Task 1 backfill) sees no onboarding wizard at all on normal login.

- [ ] **Step 10: Deploy**

```bash
npx vercel --prod
```

Confirm the deployed URL builds clean and `/onboarding` is reachable.

- [ ] **Step 11: Final commit (only if Task 11 uncovered fixes)**

If any step above required a code fix, stage exactly those files and commit with a message describing the bug found and fixed. If no fixes were needed, this step is a no-op — nothing to commit.

---

## Self-review notes (from the plan author, not a task to execute)

- **Spec coverage:** every section of `2026-07-10-ai-onboarding-design.md` maps to a task — trigger/architecture → Task 3, data model → Task 1, admin flow → Tasks 4/5/7/8/9/10, player flow → Tasks 4/6/7/8/9/10, edge cases → Task 11 steps 4/8/9, testing → Tasks 2 and 11.
- **Type consistency checked:** `OnboardingStep` type from `lib/onboarding.ts` is imported (not redefined) in `app/onboarding/page.tsx`; `onDone`/`onJoined`/`onRequestSent`/`onSkip`/`onPick`/`onFinish` prop names match exactly between each step component's definition (Tasks 4–9) and its usage in the orchestrator (Task 10).
- **Known scope cut:** Task 11's manual click-through is the verification method because this repo has no component-testing framework installed (`@testing-library/react` etc. are not in `package.json`). Adding one is out of scope for this plan — flag to the user separately if that's wanted going forward.
