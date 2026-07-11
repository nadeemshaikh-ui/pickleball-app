# League Gamification — Design Spec

**Date:** 2026-07-11
**Status:** Approved for implementation planning
**Scope:** `app/league/*`, `lib/leagueStats.ts`, `lib/badges.ts`, `lib/flights.ts`, new Supabase tables

## Goal

Turn the league from a passive stats table into a system that gets people to show up and play more, using proven mechanics from Duolingo (streaks/badges), Strava (Local Legend, recency-based competition), Zwift (tiered matchmaking), and Chess.com/Xbox (tiered + secret achievements) — adapted to a weekly/biweekly club sport instead of a daily-habit app.

## Decisions made (superseding earlier drafts in conversation)

- **No attendance/loss-aversion streak.** Rejected — punishes match volume, doesn't fit a twice-a-week sport.
- **Win/loss streaks kept, reframed as a club-wide contestable record ("crown"),** not a personal quota.
- **Lifetime leaderboard + Monthly leaderboard**, both surfaced (monthly already computed via `league_player_month_stats`, currently thrown away after picking one POTM winner — just needs full exposure).
- **No Hindi/vernacular badge names** — fun English, pickleball-specific puns preferred over generic gamer-speak.
- **Badge art:** deferred — user will select the visual approach (AI-generated via connected Runway/Higgsfield MCP, licensed icon pack, or commissioned) and update badge assets in a later pass. Build the data model, tier logic, and a placeholder medallion-frame component now; swap in final art without touching logic.

## 1. Tier ladder (games-played badge family)

| Games | Title |
|---|---|
| 10 | Kitchen Regular |
| 25 | Dink Master |
| 50 | Rally Beast |
| 100 | Pickle Royalty |

Standalone rare milestones (not part of the tier family): 200 = Paddle Legend, 500 = Ironwood.

## 2. Streak crown

Track, per club: `longest_win_streak_ever` (all-time record + holder), `longest_active_win_streak` (current hottest player — may differ from record holder), and the same pair for losing streaks.

- Record holder auto-wears a crown as their equipped title (overrides manual equip while held).
- Crossing the all-time record fires the top celebration tier ("NEW CLUB RECORD" banner), distinct from a normal badge unlock. Previous holder gets a soft "dethroned" notice, framed as history not failure.
- Win-streak crown title: **The Streak King** / **Throne**. Losing-streak crown: **Wooden Spoon** (real sports slang for last place, affectionate not insulting) — swappable label, no logic dependency on the name.

## 3. Format-specific badges

- **Throne Defender** — win 3 King-of-the-Court sessions in a row.
- **Format Loyalist** — 10+ sessions in one format.
- **The Real King** — most all-time #1-court finishes in KOTC sessions.
- **Format Explorer** — played all 5 formats at least once.

## 4. Badge catalog v2

Full list carried over from conversation (partnership, rivalry, ladder, social, season, milestone, secret categories — ~40 badges total). Tiers apply to: games played, MVP count, and season participation. See `lib/badges.ts` for the current 7-badge baseline being replaced/extended.

## 5. Duel / Challenge system

1. "Challenge to Rematch" button on the rivalry expand-row in `app/league/stats/page.tsx` (data already available via `fetchRivalriesForPlayer`).
2. New `challenges` table: `id, club_id, challenger, opponent, status (pending/completed), created_at`.
3. No push notifications — reuse the existing `shareElementAsImage` → WhatsApp pattern to announce a challenge.
4. Auto-resolves the next time challenger and opponent are recorded on opposite teams in a session; a win for the challenger also unlocks **Revenge Arc**.

## 6. Equippable titles

- New `equipped_title` column on the player/profile row (club-scoped).
- Player picks any earned badge to display as a nameplate tag on leaderboards and session rosters.
- Default when unset: auto-equip highest-tier earned badge — never a blank title.
- Streak crown overrides manual equip while actively held (see §2).

## 7. Unlock celebration

- New `badge_events` table: `id, club_id, player_name, badge_id, earned_at`.
- On load / after a match result is recorded, diff current computed badge set against `badge_events` — anything new triggers a modal/confetti + share prompt.
- Streak-record breaks use the bigger celebration treatment from §2, not the standard one.

## 8. Pickleball Wrapped — monthly + yearly

- **Trigger:** on-demand button + a nudge banner on month/year rollover. No cron dependency.
- **Data:** monthly reuses `league_player_month_stats` (already exists, currently underused). Yearly needs one new equivalent view, `league_player_year_stats`.
- **Slide sequence** (captured via the existing `shareElementAsImage` pipeline, same as ladder/stats sharing today):
  1. Cover — "Your October on the Court" + total matches
  2. Win/loss + win% vs. club average
  3. Favorite partner (chemistry) + combined record
  4. Nemesis — closest rivalry this period
  5. Biggest win — score, opponent, margin
  6. Badges earned this period
  7. Peak flight reached
  8. One quirky stat (latest-night match / most matches in a day / most-played court)
  9. Closing card — final rank + share prompt
- **Yearly** adds a flight-journey graph and total badges collected for the year.

## Data model additions (Phase 0, all new — no existing table changes besides the profile column)

| Table/column | Purpose |
|---|---|
| `streaks` | current + all-time win/loss streak records, per player per club |
| `challenges` | duel system state |
| `badge_events` | unlock-detection for celebration/share moment |
| `league_player_year_stats` (view) | yearly Wrapped |
| `equipped_title` (column on player/profile) | nameplate display |

RLS follows the existing pattern noted in `lib/leagueStats.ts` — matviews can't carry RLS directly, so club-scoped wrapper views/tables need explicit `club_id` filtering at every query site, same as `league_*` views today.

## Out of scope for this spec

- Final badge artwork/icons (separate follow-up once user picks an art approach)
- Push notifications (WhatsApp share substitutes throughout)
- Momentum/heat-meter mechanic (considered, not chosen)
