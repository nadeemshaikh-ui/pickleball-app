# Pickleball Session App — Design Spec

**Date:** 2026-07-09
**Status:** Approved by user, pending implementation plan

## Context

Group of 10 plays pickleball on 2 courts, ~8-10pm (actual start ~8:10pm), games
~10 min each, rally-point scoring to 15, win-by-2 to 17, golden point (sudden
death) at 17-17. One person (the user) runs the session as scorekeeper on an
iPhone. Need a basic cloud-backed web app to: enter players, auto-generate a
fair, fixed schedule of rounds across 2 courts, record final scores per round,
and produce end-of-session leaderboard/analytics.

## Goals

- Fixed, fully pre-computed schedule generated upfront (shareable before play
  starts — avoids on-court confusion).
- Two selectable game formats, one format per whole session.
- Manual final-score entry per round (no live point-by-point tracking).
- End-of-session analytics: top 3, per-player and per-team stats.
- Cloud persistence via Supabase so state survives closing the browser/phone.
- No login, no cross-session history — each session is a throwaway cloud
  record accessed via a short unguessable-ish URL.

## Non-goals (v1)

- User accounts / auth / multi-scorekeeper editing.
- Live point-by-point score tracking or automatic deuce/golden-point detection.
- Cross-session history, saved rosters, all-time stats.
- Offline queueing (network drop mid-session is a known accepted risk — retry
  toast only).

## Formats

Both formats are fully static/pre-computable — no dependency on game outcomes
— so the entire round schedule can be generated in one shot at setup time.

### 1. Scramble
Every round, all 10 players are reshuffled into 2 courts x 2 teams (4 playing
per court, 2 sitting out per round across the group). A balanced-fairness
algorithm run once at schedule-generation time minimizes repeat partnerships
and uneven sit-out counts across all rounds. (v1 scope: partner-repeat and
sit-out balance only, not opponent-repeat — kept light per explicit "basic
app" instruction; opponent-variety tracking can be added later if repeat
match-ups become noticeable in practice.)

### 2. Squad Rivalry
At schedule generation, the 10 players are split into 2 fixed squads of 5
(default names "Gold" and "Black", editable). Every round, each court hosts a
2-a-side match: 2 Gold players vs 2 Black players. Partners *within* a squad
rotate round to round via the same balanced-fairness algorithm (minimizing
repeat in-squad partnerships and uneven sit-outs). Because each squad has 5
players and only 4 play per round, exactly 1 player per squad sits out most
rounds (2 sitting total per round, matching the 8-playing/2-sitting shape).
Final analytics adds a squad-total-score view alongside individual stats.

## Data model (Supabase)

**`sessions`**
| column | type | notes |
|---|---|---|
| id | text (short slug, PK) | e.g. `x7k2p`, used in URL |
| created_at | timestamptz | default now() |
| format | text | `scramble` \| `squad_rivalry` |
| players | jsonb | array of player name strings |
| squads | jsonb \| null | `{ gold: string[], black: string[] }`, null for scramble |
| round_count | int | e.g. 12 |
| status | text | `setup` \| `in_progress` \| `completed` |

**`rounds`**
| column | type | notes |
|---|---|---|
| id | uuid (PK) | |
| session_id | text (FK -> sessions.id) | |
| round_number | int | 1-indexed |
| court | int | 1 or 2 |
| team_a | jsonb | 2 player names |
| team_b | jsonb | 2 player names |
| sitting_out | jsonb | player names sitting this round (session-wide, stored once per round or duplicated per court row — see plan) |
| score_a | int \| null | null until entered |
| score_b | int \| null | null until entered |

Winner per round = higher of score_a/score_b once both are non-null. No
legality validation on the score pair (basic v1).

## Screens / flow

1. **Home** — "New Session" (only entry point, no history list since
   sessions are throwaway).
2. **Setup** — enter 10 names, pick format (Scramble / Squad Rivalry), set
   round count (default 12, editable), Generate Schedule button.
3. **Schedule / Share view** — full generated schedule, all rounds, both
   courts, sit-outs. "Copy as WhatsApp text" button producing a plain-text
   dump formatted as:
   ```
   Round 1
   Court 1: A & B vs C & D
   Court 2: E & F vs G & H
   Sitting: I, J
   ```
   for every round. This is what gets shared with the group before play
   starts.
4. **Live scoring** — current round's 2 court matchups, score entry fields
   per court, "Save & Next Round" button. Can navigate back to any completed
   round to edit its score (recomputes analytics live).
5. **Results / Analytics** (auto-shown after last round, also reachable any
   time mid-session for a running leaderboard):
   - Podium: top 3 by wins, tiebreak by point differential.
   - Full leaderboard table: games played, wins, losses, win%, points for,
     points against, point diff.
   - Squad Rivalry sessions only: squad total score comparison.
   - Basic charts: wins-per-player bar chart, points-for-vs-against.

## Balanced-shuffle algorithm (shared by both formats)

Greedy pairing pass across all rounds at generation time:
- Track running counts: partner-pair frequency, opponent-pair frequency,
  sit-out frequency per player.
- For each round, choose the sit-out set first (players with lowest sit-out
  count so far get priority to play), then greedily assign remaining players
  to team pairs minimizing repeat-partner and repeat-opponent counts.
- Squad Rivalry constrains team pairs to same-squad-only and cross-court
  match-ups to opposite-squad-only; otherwise identical logic.
- Deterministic per session (seeded by session id) so regenerating with the
  same inputs is reproducible, but visually "random" to players.

## Stack

- Next.js (App Router) + Supabase, deployed on Vercel — mirrors the
  user's existing life-os project stack, no new tooling to learn.
- No auth. Session URL is the access control (accepted trade-off, not an
  oversight — flagged explicitly to the user).
- Mobile-first single-column layout, large tap targets (used courtside on a
  phone, one-handed).

## Open risks (accepted, not blocking)

- No offline handling: a dropped connection mid-round means a score-save
  retry toast, not a queued write. Acceptable for a casual weekly game;
  revisit if this becomes a recurring problem.
- No score-legality validation: a scorekeeper typo (e.g. "20-12") is
  accepted as-is. Basic v1 trade-off per explicit "basic app" instruction.
