# AI-Based Onboarding — Design Spec

**Date:** 2026-07-10
**Status:** Approved, pending implementation plan

## Problem

New users hit a dead end today (immediate symptom already patched in commit `1f98a37`). Beyond that patch, there's no guided path for a brand-new signup to understand what the app does, create/join a club, set up their player profile, or learn the core loop. `/register` (player profile) and `/login` were both orphaned pages with nothing linking to them before this session's fixes.

Requirement: AI-guided onboarding, easy for a new admin (club creator) and a new player (joiner) to get set up, with an easy-to-follow feature explainer — without turning into a multi-screen slog.

## Goals / Non-goals

**Goals:**
- Every brand-new signup is guided through: pick admin-or-player path → create/join a club → set up player profile → short core-loop tour → land in the app.
- Feels conversational (chip/button-driven, one question per screen), not a form dump.
- Both entry paths always available: guided wizard (default) and full manual fallback (existing `/clubs/new`, `/clubs/join`, `/register` pages, untouched).
- Fires automatically, exactly once per user, regardless of which device/browser they next sign in from.

**Non-goals:**
- Not a live-LLM chatbot. "AI" here means the conversational UX pattern (chips, one-question-at-a-time, progressive reveal), not a model call. No new Anthropic API usage, no latency/cost/failure-mode surface added.
- Not a full feature walkthrough. League Mode's ~10 features (Flight System, Ladder League, King of the Court, Promotion/Relegation, streaks/badges, MVP, dues, Storylines, ELO matchmaking, voice score entry) are explicitly out of scope for onboarding — discovered organically during play, not front-loaded.
- Does not touch admin-specific configuration (club branding beyond name/logo, join-code sharing) — that stays in the existing `/clubs/[id]/settings` page, reachable anytime post-onboarding.

## Architecture

### Trigger
New `AuthGate` client component mounted in `app/layout.tsx` alongside the existing `ClubSwitcher`. On every render: if a user is signed in and has no `user_onboarding` row, redirect to `/onboarding` before anything else renders. Signed-out visitors are unaffected — today's per-page `SignInGate`s still handle that case. Already-onboarded users see no change at all.

### Onboarding route
`/onboarding` is a single page driven by an internal step index (not one URL per step). Simplest to build; avoids back-button/deep-link edge cases for what's meant to be a short, linear flow.

### Layout
Single-question-card style: one step fills the screen, a 4-dot progress indicator up top, "Skip" visible once the tour phase begins (never during the mandatory create/join step, since there's no app to use without a club).

## Data model

New table:

```sql
create table user_onboarding (
  user_id      uuid primary key references auth.users(id),
  onboarded_at timestamptz not null default now()
);

alter table user_onboarding enable row level security;

create policy "user_onboarding self insert" on user_onboarding
  for insert with check (auth.uid() = user_id);

create policy "user_onboarding self read" on user_onboarding
  for select using (auth.uid() = user_id);
```

Per-user, not per-club — a user only ever does the tour once, even if they later join a second club. `AuthGate` existence-checks this table; no row means "show onboarding."

**Migration backfill:** insert a `user_onboarding` row for every existing `club_members.user_id` at deploy time, so nobody who's already using the app sees the wizard retroactively.

## Flow — Admin path (starting a new club)

1. **Branch card** — "Are you starting a new club or joining one?" Two buttons. (Skipped entirely if `useCurrentClub().clubs.length > 0` on mount — see Edge Cases.)
2. **Club name + logo** — wraps the existing `/clubs/new` form fields inside wizard chrome; calls the same `createClub()`.
3. **Your player profile** — wraps the existing (currently orphaned) `/register` fields: name, nickname, optional photo. Same underlying `upsertOwnPlayer()`/`uploadPlayerPhoto()` calls.
4. **Core-loop tour** (3 cards, "Next" through each, Skip visible from here on):
   - "Start a session" — courts, players, format picker
   - "Score as you play" — live scoring, voice entry
   - "Check stats & league" — where `/league` lives
5. **Done card** — "You're all set!" → button to `/setup`. Writes the `user_onboarding` row here, or immediately on Skip if skipped earlier — whichever happens first.

## Flow — Player path (joining an existing club)

1. **Branch card** — same as admin; "Joining an existing club" continues below.
2. **Join step** — wraps existing `/clubs/join`: code entry (instant, via `joinClubByCode()`) or name search + request (via `requestToJoinClub()`, needs admin approval).
   - Code path → joined instantly, continue to step 3.
   - Request-to-join path → wizard shows "Request sent — we'll notify you once approved" and **ends here**. `user_onboarding` row is written immediately (they won't see the wizard again once approved; they just land in the app).
3. **Your player profile** — identical to admin path step 3.
4. **Core-loop tour** — identical to admin path step 4.
5. **Done card** — identical to admin path step 5.

Steps 3–5 are shared components between both paths; only step 2's content and the mid-flow approval bail-out differ.

## Edge cases & error handling

- **Existing users** — handled via migration backfill (see Data model). Nobody using the app today sees this wizard.
- **Already belongs to a club, never finished the tour** (closed tab mid-wizard) — on mount, if `useCurrentClub().clubs.length > 0`, skip straight past the branch/create/join steps to the profile step. Never re-asks "new club or join?" for someone already in one.
- **`user_onboarding` existence check fails** (network blip) — fail open, let them into the app rather than block on a broken check. Worst case: wizard reappears next login, not a lockout.
- **Closed tab mid-wizard, no club yet** — no step-level persistence. They restart from the branch card next login. Acceptable given the flow is short.
- **Approval-pending join request** — see Flow — Player path, step 2.

## Testing

- Typecheck clean, existing 133-test suite stays green.
- New unit coverage for the "already has a club → skip to profile" branching logic.
- Migration gets a live RLS round-trip check (insert/read as a real authenticated role via `set local role authenticated` + JWT claim impersonation) — same rigor as the multi-club RLS work, since this touches schema + auth, not just UI.
- Manual click-through of both admin and player paths in preview before shipping.

## Open items for later (explicitly deferred)

- Full feature walkthrough beyond the core loop (deferred per Goals/Non-goals).
- Admin-side "share join code" step inside onboarding (deferred — lives in Club Settings instead, per this session's decision).
- User indicated they may want changes to the admin flow (Section 3) after seeing it built — flagged, not yet specified.
