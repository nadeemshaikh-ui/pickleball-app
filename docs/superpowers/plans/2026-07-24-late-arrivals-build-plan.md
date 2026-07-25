# Late Arrivals & Round Handoff — Build Plan

**Created:** 2026-07-24
**Status:** Approved for execution, not started
**Scope:** Normal league sessions only. **Team Championship / tournament mode is explicitly out of scope and must not be touched.**

---

## 1. The problem

League nights are scheduled in advance for a fixed roster. One or two people
arrive late and the plan is unusable:

1. The schedule generator **throws** rather than degrading — `requireMinPlayers`
   ([`lib/shuffle.ts:341`](../../../lib/shuffle.ts)) hard-errors below
   `courtCount * 4`; `generateFixedPartnersSchedule` ([`:657`](../../../lib/shuffle.ts))
   and `generateSquadRivalrySchedule` ([`:432`](../../../lib/shuffle.ts)) hard-error
   on an odd player count. A single missing person can produce no schedule at all.
2. There is no way to add someone to a session after it starts.
3. Once on court, nobody looks at their phone, so even a correct schedule doesn't
   reach the players.
4. Unequal games played breaks a total-points leaderboard.

## 2. Design principles (agreed after several revisions — do not re-litigate)

- **The host learns nothing new.** Their entire manual is: *tick who isn't here,
  press start, tick people in when they arrive.* No modes, no toggles, no roles,
  no new settings screens.
- **No fixed "anchor"/marshal roles.** Rejected: pinning a player to a court for
  the night means those players never share a court, and it adds a concept the
  host has to manage.
- **No audio alerts or push notifications.** Rejected as impractical in a noisy
  hall with phones in bags.
- **The handoff moment already exists.** When a game ends, the person entering
  the score is already holding a phone. Attach the "who's next" instruction to
  that screen instead of inventing a broadcast channel.
- **Played rounds are immutable.** Regeneration only ever touches rounds that
  have not started.
- **Derive, don't store.** Fairness counts, per-round scorer, and "who is new to
  this court" are all computable from the `rounds` table. Only one new column is
  needed in the whole plan.

---

## 3. Current-state facts (verified by reading the code)

| Fact | Source |
|---|---|
| Players are **names (strings)**, not IDs | `SessionRow.players: string[]` — `lib/db.ts:42` |
| Full schedule is generated once at setup and inserted as rows | `app/setup/page.tsx:810–899`, `insertRounds` |
| One `rounds` row **per court per round** | `RoundRow` — `lib/db.ts:70` |
| `RoundRow` holds `team_a`, `team_b`, `sitting_out`, `score_a`, `score_b` | `lib/db.ts:70–80` |
| Fairness state (`sitOutCounts`, `partnerCounts`, `lastSitOut`) lives **inside** the generator loop and is discarded | `lib/shuffle.ts:370–390` |
| RNG is a **stateful stream** seeded once per session | `seededRandom` — `lib/shuffle.ts:3` |
| `designated_scorers` exists but is a **permission list**, not a per-round assignment | `lib/db.ts:67` |
| `start_time` and `round_duration_minutes` already exist | `lib/db.ts:47,52` |
| `computeRoundTimeRange` already derives clock ranges per round | `lib/roundTiming.ts` |
| Formats in scope | `scramble`, `squad_rivalry` (2 and N), `fixed_partners`, `court_blocks`, `king_of_court` |
| Format out of scope | `team_championship` |

### Consequence for RNG

Regenerating mid-session from a different pool shifts every subsequent draw in
the stream, breaking reproducibility. **Re-seed per round**:
`seededRandom(\`${sessionId}:r${roundNumber}\`)`. Each round becomes independently
reproducible from (sessionId, roundNumber, pool, derived ledger). This is a
prerequisite for Item 3 and must land with it.

---

## 4. Schema change — exactly one

```sql
-- supabase/migrations/<timestamp>_session_absent_players.sql
alter table sessions
  add column absent_players text[] not null default '{}';
```

- `players` stays the **full roster** — roster history, dues, and every existing
  query that reads `session.players` are unaffected.
- `absent_players` is the subset not currently available.
- **Active roster = `players` minus `absent_players`.** Add a single helper
  `activePlayers(session)` in `lib/db.ts` and use it everywhere; do not inline
  the subtraction.

Nothing else in the plan requires a migration.

---

## 5. Build items

Items are independently shippable and listed in execution order.

---

### Item 1 — Never fail to produce a schedule

**Tier:** T1 (single file, pure logic, no DB/auth)
**Files:** `lib/shuffle.ts`, `lib/squads.ts`
**Reviewers:** `ecc:code-reviewer` only (per CLAUDE.md §0-B T1 gate)

**Behaviour change**

1. Add `resolveCourtCount(playerCount, requestedCourts): number`
   → `Math.min(requestedCourts, Math.floor(playerCount / 4))`, minimum 1.
   Every generator calls this instead of trusting the requested count.
2. `requireMinPlayers` no longer throws for "too few for N courts". It throws
   **only** below 4 players total (genuinely unplayable) with a clear message.
3. `generateFixedPartnersSchedule` — odd player count no longer throws. The
   player with the fewest games so far is benched for that generation pass and
   the remaining even count is paired.
4. `generateSquadRivalrySchedule` / `generateSquadRivalryScheduleN` — odd count
   no longer throws. The extra player joins the smallest squad and absorbs an
   extra sit-out slot in that squad's rotation.
5. Every generator returns the **effective court count actually used** alongside
   its rounds, so callers can persist and display it.

**Caller update:** `app/setup/page.tsx` must persist the effective court count and
show a one-line notice: *"Only 9 players — running 2 courts tonight."*

**Tests (`lib/shuffle.test.ts`)**
- 9 players / 3 courts requested → 2 courts, no throw
- 4 players / 3 courts → 1 court, no throw
- 3 players → throws with a readable message
- 11 players, fixed partners → no throw, one player benched, 5 teams formed
- 11 players, squad rivalry → no throw, squads sized 6/5
- Existing tests must still pass unchanged

**Done when:** no roster size between 4 and 24 can make any in-scope generator throw.

---

### Item 2 — Attendance: tick absent / tick present

**Tier:** T2 (new UI + DB write + touches setup and session pages)
**Files:** migration (§4), `lib/db.ts`, `app/setup/page.tsx`, session page(s)
**Reviewers:** `ecc:code-reviewer` + `ecc:typescript-reviewer` (async DB writes)

**Behaviour**

1. **At setup** — the roster list gets a per-player present/absent toggle,
   **defaulting to present**. Untick = added to `absent_players`. The schedule is
   generated from `activePlayers` only. The absent player still exists on the
   session and can be ticked in later.
2. **During the session** — an Attendance control on the session screen, showing
   the same list. Reachable in one tap from the main session view; do not bury it.
3. Ticking someone **present** mid-session → they are removed from
   `absent_players`, then Item 3's regeneration runs.
4. Ticking someone **absent** mid-session (early departure/injury) → added to
   `absent_players`, then Item 3's regeneration runs.
5. Confirmation is a single line with an undo: **"Priya added to upcoming rounds — Undo."**
   No modal, no mode switch, no separate "rebuild" button. Ticking *is* the trigger.

**Edge cases**
- Ticking someone present when the current round is in progress: the current
  round is **not** touched. They enter from the next unplayed round.
- Ticking absent someone who is playing in the in-progress round: leave that
  round alone (the game is happening); they are excluded from the next round
  onward. Do **not** attempt live mid-game substitution in this item.
- If a tick would leave fewer than 4 active players, block it with a clear
  message rather than generating an unplayable session.

**Tests**
- Unit: `activePlayers()` subtraction, including duplicate-name safety
- Integration: tick absent at setup → generated rounds never contain that name

---

### Item 3 — Regenerate upcoming rounds

**Tier:** T2, highest risk item in the plan
**Files:** `lib/shuffle.ts`, `lib/squads.ts`, new `lib/regenerate.ts`, `lib/db.ts`
**Reviewers:** `ecc:code-reviewer` + `ecc:typescript-reviewer` + `ecc:database-reviewer` (row deletes)

**Core rule — what counts as "unplayed"**

A round is **in progress** if any of its court rows has a non-null score while
others are null, or if it is the lowest-numbered round with all-null scores and
the session is `in_progress`.

> `regenerateFrom` = (highest round number with any non-null score) + 2
> — i.e. never touch the round currently on court.

Compute this from the `rounds` table; do not track it in state.

**Derive the ledger from history — do not thread state**

New `deriveLedger(playedRounds: RoundRow[])` returning:
- `gamesPlayed: Map<name, number>`
- `sitOutCounts: Map<name, number>`
- `partnerCounts: Map<pairKey, number>`
- `opponentCounts: Map<pairKey, number>`
- `lastSitOut: Set<name>`

Reuse the existing `pairKey` convention (sorted, `|`-joined) from `lib/shuffle.ts`.
Players who have joined late start with `gamesPlayed = 0`, which makes the
existing fewest-sits-first logic prioritise them automatically. **No catch-up
cap is needed** — the deficit self-resolves once they reach the median.

**Generator refactor**

Each in-scope generator gains two optional parameters:

```ts
startRound?: number          // default 1
initialLedger?: Ledger       // default empty
```

The loop body is unchanged. Only initialisation changes. **Re-seed per round**
inside the loop as specified in §3.

**Persistence**

New `deleteRoundsFrom(sessionId, fromRoundNumber)` in `lib/db.ts`, then
`insertRounds` for the replacements. Do the delete and insert in one transaction
or an RPC — a partial failure leaving a session with missing rounds is the worst
outcome in this plan.

**Per-format behaviour**

| Format | Regeneration rule |
|---|---|
| `scramble` | Straight regeneration from the derived ledger |
| `squad_rivalry` | Squads persist in `sessions.squads`. A new arrival is appended to the **smallest** squad and the column is updated. Existing members never move. |
| `fixed_partners` | Teams are **not stored** — derive them from the earliest existing round's `team_a`/`team_b` pairs. Teams whose members are all present are preserved. A player whose partner is absent is paired with another orphan, or benched if there is no orphan. When the real partner is ticked back in, restore the original pairing from the next round. |
| `court_blocks` | Regenerate from the next **block** boundary (`rounds_per_block`), not the next round — mid-block group changes break the format's premise. |
| `king_of_court` | Already generates one round at a time (setup inserts only round 1). A new arrival joins the waiting pool; no regeneration needed. Verify this holds and add a test. |
| `team_championship` | **Out of scope. Attendance controls must be hidden for this format.** |

**Tests (`lib/regenerate.test.ts`)**
- Played rounds are byte-identical before and after regeneration
- The in-progress round is never modified
- An added player appears in the next unplayed round
- An added player's games-played converges to within 1 of the median by the end
- A removed player appears in no round after the regeneration point
- Each format's invariant survives: squads stable, fixed partnerships preserved,
  block boundaries respected
- Same (sessionId, roundNumber, pool, ledger) → identical output (re-seeding works)

---

### Item 4 — Next match on the score screen

**Tier:** T2 (UI, no schema)
**Files:** session play/score-entry page (`app/session/[id]/play/page.tsx` —
confirm the exact score-submit component before editing)
**Reviewers:** `ecc:code-reviewer` + `ecc:react-reviewer`

**Behaviour**

After a score is submitted, the same screen shows the next assignment for **that
court**, in large, readable, shout-it-out type:

```
   COURT 1  ·  Nadeem scores

   Nadeem + Priya          ← Priya joins
        vs
   Sam + Ali               ← Sam joins

   (Ali stays on)
```

1. **Named scorer, derived not stored.** Deterministic rotation, no schema
   change, no host setup:
   `scorer = [teamA[0], teamA[1], teamB[0], teamB[1]][roundNumber % 4]`
   Show it on the round card so the person knows before the game ends.
   This is independent of `designated_scorers`, which stays a permission list —
   **do not conflate the two.** If `designated_scorers` is non-empty, pick the
   rotation entry from within that list instead.
2. **Highlight who is new to this court** — diff the court's four players against
   the same court in the previous round. The reader then only calls 1–2 names.
3. If other courts have not reported yet, show **"Waiting on Court 3"** instead
   of the next round. No sound, no alert, no notification.
4. Sitting-out players are named on the card.

**Tests**
- Unit: scorer rotation is stable and always returns a player on that court
- Unit: new-to-court diff, including the first round (everyone is new)
- Manual/preview verification, not a new Playwright spec (CLAUDE.md §0-B —
  cosmetic/UI work gets manual verification)

---

### Item 5 — Time awareness

**Tier:** T1
**Files:** `app/setup/page.tsx`, session screen, `lib/roundTiming.ts`
**Reviewers:** `ecc:code-reviewer`

1. **At setup:** an "end by" time input (local state only, no DB column). Next to
   the round-count field, show a live hint:
   *"8 rounds × 13 min from 8:10 PM → finishes 9:54 PM."*
   Reuse `computeRoundTimeRange`.
2. **During the session:** show the projected finish based on actual elapsed
   time. If it overruns the end-by time, offer a one-tap **"Remove last round"**
   (deletes that round's rows) and **"Add a round"**.
3. **No warm-up-window feature.** Starting at 8:10 instead of 8:00 is a social
   practice; the app's only job is to do the arithmetic honestly. Do not build a
   timer, a countdown, or a warm-up mode.

**Tests:** unit-test the projection maths, including sessions with no `start_time`.

---

### Item 6 — Leaderboard on average points per game

**Tier:** T2 (changes rankings — user-visible correctness)
**Reviewers:** `ecc:code-reviewer`

> **Requires a short discovery pass first.** The ranking code was not read while
> writing this plan. Locate the sort in `app/session/[id]/leaderboard/page.tsx`
> and `lib/leagueStats.*` before designing the change.

**Intended behaviour**

Rank by **shrunk average**, not total:

```
adjusted = (points + k * leagueAvgPerGame) / (games + k)     where k = 3
```

A player with very few games regresses toward the mean — they cannot top the
table on one lucky result, and are never excluded. Rejected alternative: a
minimum-games threshold, which creates a cliff and the exact argument it's meant
to prevent.

Add a club setting `rank_by: 'total' | 'average'`, defaulting to `'average'`.
Show the games-played count next to each player so the basis is visible.

---

### Item 7 — AI as an input/narration layer (not a decision-maker)

**Tier:** T2 (new UI + LLM call, no schema, touches attendance + score screen)
**Files:** new `lib/attendanceAssistant.ts`, session page(s), Item 4's score screen
**Reviewers:** `ecc:code-reviewer` + `ecc:typescript-reviewer` (async LLM call path)
**Depends on:** Items 2, 3, 4 (it is a front-end onto their outputs, not a
replacement for any of them)

**Hard rule — AI never regenerates a schedule and never writes to the DB
directly.** Every AI action resolves to the exact same function call the tap
UI already makes (`tick present`, `tick absent`), through the exact same
confirm+undo pattern from Item 2.5. If this rule is violated anywhere, the
item is built wrong — re-read §2's design principles before touching this.

**Three scoped capabilities, nothing else:**

1. **Natural-language attendance.** Host types or speaks "Sam's here, Priya
   left, new guy Rahul" → LLM resolves each name against the session roster
   → calls `tick present` / `tick absent` per name, one confirm+undo per
   change (never a silent batch write). This is the one place AI clearly
   beats the manual list: fuzzy/ambiguous name resolution (§8.4 already flags
   duplicate names — e.g. "Sam" vs "Sameer" — as a pre-existing weakness).
   If a name is ambiguous, the assistant must ask, not guess.
2. **Handoff card narration.** On Item 4's score screen, replace the fixed
   template with an LLM-generated version of the same data (who's new to the
   court, who stays, who's sitting out). Read-only — the assistant narrates
   numbers Item 3/4 already computed, it does not decide anything.
3. **Host Q&A.** "Why is Sam sitting out again?" / "How many games has X
   played?" — answered by querying `deriveLedger()` (Item 3) directly.
   Read-only, no writes, no side effects.

**Explicitly out of scope for this item:**
- Item 3's regeneration math, RNG seeding, per-format rules — stays pure and
  unit-tested, no LLM in that path, ever.
- Item 6's ranking formula — arithmetic, not language.
- Any AI-initiated write that skips the confirm+undo step.
- A dedicated "AI mode" toggle — per §2/§9, no new modes or settings screens.
  The assistant is an *additional input path* alongside tapping, always
  available, never a separate screen the host has to opt into.

**Tests**
- Unit: name resolution against a roster with duplicate/similar names —
  ambiguous cases must produce a clarifying question, not a guess
- Integration: every assistant-driven attendance change produces an identical
  DB write to the equivalent manual tap (same function, same payload shape)
- Manual/preview verification for narration copy quality — not a correctness
  test, since the underlying numbers are already covered by Item 3/4's tests

**Done when:** a host can resolve a chaotic arrival/departure entirely by
typing or speaking, with zero difference in the resulting DB state versus
doing it by hand, and zero new failure mode that manual ticking didn't
already have.

---

## 6. Execution order

| # | Item | Tier | Size | Blocking? |
|---|---|---|---|---|
| 1 | Never fail to produce a schedule | T1 | S | — |
| 5 | Time awareness | T1 | S | — |
| 2 | Attendance (tick absent/present) | T2 | M | needs §4 migration |
| 3 | Regenerate upcoming rounds | T2 | M–L | needs 1 + 2 |
| 4 | Next match on the score screen | T2 | M | independent |
| 6 | Leaderboard average | T2 | S | needs discovery pass |
| 7 | AI input/narration layer | T2 | M | needs 2 + 3 + 4 |

**Recommended batching:**

- **Batch A — Items 1 + 5.** Both T1, both pure logic, one review pass over the
  batch (CLAUDE.md §0-B batching rule). Ships the crash fix, which alone makes a
  short-handed night survivable.
- **Batch B — Item 2, then Item 3.** Reviewed individually; T2 changes are never
  batched. Item 3 is the highest-risk change in the plan.
- **Batch C — Item 4.** Independent; can run in parallel with B if desired.
- **Batch D — Item 6.** Discovery pass first, then build.
- **Batch E — Item 7.** Built last — it is a front-end onto Items 2/3/4's
  outputs and has nothing to attach to until they exist.

---

## 7. Verification

Per CLAUDE.md §0-B verification-depth rules:

- **Items 1, 4, 5** touch no table → typecheck + lint + unit tests + one preview
  check. No live-Supabase round trip, no new Playwright spec.
- **Items 2, 3, 6** write to the DB → full proof required: typecheck, lint, unit
  tests, **and** a live verification on a throwaway session (create → mark absent
  → start → tick present → confirm rounds changed correctly → confirm played
  rounds untouched → delete the session).
- Item 3 additionally needs a **regression check across all five in-scope
  formats**, not just scramble.

---

## 8. Known gaps / deliberate follow-ups

1. **Dues.** `createSessionDues` is called with the full roster at setup
   (`app/setup/page.tsx:906`). A player who never turns up is still charged.
   Not fixed here — decide separately whether dues should follow attendance.
2. **Mid-game substitution.** If someone is injured mid-round, the round is left
   alone. A live-round substitution tool is a separate, later item.
3. **Court count changing mid-session.** If enough people leave to drop a court,
   Item 1's `resolveCourtCount` handles generation, but the session's stored
   court labels/count may not update. Verify during Item 3 and file if broken.
4. **Duplicate player names.** Players are identified by name string throughout.
   Two "Sam"s would corrupt attendance and the ledger. Pre-existing weakness,
   not introduced here, but attendance ticking makes it more visible — worth a
   uniqueness check on the setup roster.
5. **Item 6 design is provisional** pending the discovery pass.

---

## 9. Out of scope — do not touch

- Team Championship / tournament mode, in any item
- Push notifications, sound alerts, shared-display or TV/board modes
- Fixed "anchor"/marshal roles
- Continuous/independent court play (courts still wait for each other between
  rounds — this is what lets one person's shout reach everyone)
- Any host-facing mode toggle or settings screen
