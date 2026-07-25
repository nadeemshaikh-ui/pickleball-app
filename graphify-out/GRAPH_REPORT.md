# Graph Report - .  (2026-07-15)

## Corpus Check
- 174 files · ~84,075 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 660 nodes · 1669 edges · 50 communities (41 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.69)
- Token cost: 636,236 input · 0 output

## Community Hubs (Navigation)
- Page Route Inventory
- Session Setup Wizard
- Club Admin Pages
- Head-to-Head & League Gamification Design
- Analytics & Recap Sharing
- League Hub & Crowns
- App Shell & Fonts
- Package Dependencies
- League Stats & Badge Medallions
- Auth & Play Pages
- E2E Test Fixtures
- TypeScript Config
- Ladder Enrollment & Badge Holders
- Season Wrapped & Flight Changes
- Badges Gallery & Crowns Page
- Avatar System
- Session Dues Splitting
- Voice Score Entry
- Player of the Month
- Ladder Challenge Logic
- Elo Rating Engine
- Preset Squad Logos
- Agent Instructions (AGENTS.md/CLAUDE.md)
- ESLint Config
- Next.js Config
- Boilerplate Icon (file.svg)
- Boilerplate Icon (globe.svg)
- Boilerplate Icon (vercel.svg)
- Boilerplate Icon (window.svg)
- Default README

## God Nodes (most connected - your core abstractions)
1. `useCurrentClub()` - 46 edges
2. `getCurrentUser()` - 22 edges
3. `supabase` - 21 edges
4. `main()` - 20 edges
5. `RoundRow` - 17 edges
6. `compilerOptions` - 16 edges
7. `formatLabel()` - 15 edges
8. `generateScrambleSchedule()` - 15 edges
9. `handleGenerate()` - 14 edges
10. `shareElementAsImage()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `insertRounds()` --shares_data_with--> `rounds table (Supabase)`  [EXTRACTED]
  lib/db.ts → docs/superpowers/specs/2026-07-09-pickleball-session-app-design.md
- `hasCompletedOnboarding()` --shares_data_with--> `user_onboarding table (Supabase)`  [EXTRACTED]
  lib/onboarding.ts → docs/superpowers/specs/2026-07-10-ai-onboarding-design.md
- `LeaguePage()` --calls--> `useCurrentClub()`  [EXTRACTED]
  app/league/page.tsx → lib/useCurrentClub.ts
- `PlayerOfTheMonthPage()` --calls--> `useCurrentClub()`  [EXTRACTED]
  app/league/potm/page.tsx → lib/useCurrentClub.ts
- `fetchBadgeEvents()` --shares_data_with--> `league_badge_events table`  [EXTRACTED]
  lib/badgeEvents.ts → docs/superpowers/plans/2026-07-11-league-gamification-phase0-foundation.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Onboarding Wizard Flow (AuthGate → steps → completion)** — components_authgate, app_onboarding_page, user_onboarding_table, components_onboarding_branchstep, components_onboarding_profilestep, components_onboarding_tourstep, components_onboarding_donestep [INFERRED 0.85]
- **Pickleball Session Core Loop (setup → schedule → play → results)** — app_setup_page, lib_shuffle_generatescrambleschedule, lib_db_createsession, app_session_id_schedule_page, app_session_id_play_page, app_session_id_results_page [INFERRED 0.85]
- **League Gamification Phase 0 Data Foundation** — league_streak_records_table, league_badge_events_table, league_challenges_table, league_player_year_stats_mv, players_equipped_badge_id_column [INFERRED 0.80]

## Communities (50 total, 9 thin omitted)

### Community 0 - "Page Route Inventory"
Cohesion: 0.06
Nodes (54): SessionHistoryPage(), ResultsPage(), FLIGHT_RANK, SchedulePage(), StorylinePage(), ActivityIcon(), base(), BoltIcon() (+46 more)

### Community 1 - "Session Setup Wizard"
Cohesion: 0.05
Nodes (62): Format, handleAddRegisteredPlayer(), handleGenerate(), handlePhotoSelect(), handlePlayerCountConfirm(), handleRepeatLastSession(), handleUseSavedRoster(), normalizeNameCasing() (+54 more)

### Community 2 - "Club Admin Pages"
Cohesion: 0.06
Nodes (52): SuperAdminPage(), ClubSettingsPage(), JoinClubPage(), NewClubPage(), ClubsPage(), MyDuesPage(), HomePage(), ClubSwitcher() (+44 more)

### Community 3 - "Head-to-Head & League Gamification Design"
Cohesion: 0.08
Nodes (37): HeadToHeadPageInner(), Period, WrappedData, League Gamification Phase 0 — Data Foundation Plan, League Gamification Design Spec, league_badge_events table, league_challenges table, Duel / Challenge system (+29 more)

### Community 4 - "Analytics & Recap Sharing"
Cohesion: 0.13
Nodes (29): AnalyticsPage(), scoreLine(), RecapImageTemplate(), computeSquadTotals(), PlayerStats, formatAnalyticsAsText(), scoreLine(), RoundRow (+21 more)

### Community 5 - "League Hub & Crowns"
Cohesion: 0.11
Nodes (29): LeaguePage(), CrownEntry, currentMonthKey(), dedupeByName(), fetchBestDuos(), fetchClosestRivalries(), fetchCrownBoards(), fetchLifetimeLeaderboard() (+21 more)

### Community 6 - "App Shell & Fonts"
Cohesion: 0.09
Nodes (21): Onboarding Layout Options Brainstorm, Brainstorm Waiting Placeholder, bebas, metadata, oswald, dotIndexFor(), OnboardingPage(), AuthGate() (+13 more)

### Community 7 - "Package Dependencies"
Cohesion: 0.06
Nodes (31): dependencies, @anthropic-ai/sdk, html2canvas, lucide-react, next, react, react-dom, @supabase/supabase-js (+23 more)

### Community 8 - "League Stats & Badge Medallions"
Cohesion: 0.12
Nodes (18): LeagueStatsPage(), SortKey, BadgeMedallion(), DEFAULT_GRADIENT, ICONS, TIER_GRADIENTS, CelebrationProps, COLORS (+10 more)

### Community 9 - "Auth & Play Pages"
Cohesion: 0.13
Nodes (18): LadderPage(), LoginPage(), RegisterPage(), PlayPage(), GoogleSignInButton(), getCurrentUser(), isCurrentUserAdmin(), signInWithGoogle() (+10 more)

### Community 10 - "E2E Test Fixtures"
Cohesion: 0.14
Nodes (24): admin, buildStorageState(), __dirname, ensureBadgeStreakFixture(), ensureConcurrentFixture(), ensureConfirmFixture(), ensureDuesFixture(), ensureJoinRequestFixture() (+16 more)

### Community 11 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 12 - "Ladder Enrollment & Badge Holders"
Cohesion: 0.21
Nodes (13): league_streak_records table, recordBadgeHolderChange(), buildBadgeInput(), enrollInLadder(), fetchLadderStandings(), LadderStandingRow, resetLadder(), syncLadderChampion() (+5 more)

### Community 13 - "Season Wrapped & Flight Changes"
Cohesion: 0.25
Nodes (9): WrappedPage(), detectFlightChange(), FlightChange, FLIGHT_BANDS, FlightBand, flightForRating(), flightRank(), detectUpset() (+1 more)

### Community 14 - "Badges Gallery & Crowns Page"
Cohesion: 0.28
Nodes (10): BadgesGalleryPage(), CONTESTABLE_BADGE_IDS, SECTIONS, CrownsPage(), formatHeldDuration(), BadgeHolder, fetchBadgeHoldCounts(), fetchCurrentBadgeHolders() (+2 more)

### Community 15 - "Avatar System"
Cohesion: 0.33
Nodes (7): Avatar(), avatarColor(), initials(), PALETTE, cache, getPlayerPhoto(), preloadPlayerPhotos()

### Community 16 - "Session Dues Splitting"
Cohesion: 0.33
Nodes (6): createSessionDues(), DueRow, fetchSessionDues(), markDuePaid(), MyDueRow, computeDuesSplit()

### Community 17 - "Voice Score Entry"
Cohesion: 0.36
Nodes (3): captureSpokenScore(), MinimalSpeechRecognition, parseSpokenScore()

### Community 18 - "Player of the Month"
Cohesion: 0.29
Nodes (6): PERIOD_FETCHER, PERIOD_LABEL, PlayerOfTheMonthPage(), league_player_year_stats_mv / league_player_year_stats view, fetchYearlyLeaderboard(), refresh_league_stats() function

### Community 19 - "Ladder Challenge Logic"
Cohesion: 0.57
Nodes (5): applyLadderMovement(), isValidLadderChallenge(), LadderPlayer, LadderRungChange, sideRung()

### Community 20 - "Elo Rating Engine"
Cohesion: 0.90
Nodes (3): eloDelta(), expectedScore(), marginMultiplier()

## Ambiguous Edges - Review These
- `players.equipped_badge_id column` → `Equippable titles`  [AMBIGUOUS]
  docs/superpowers/specs/2026-07-11-league-gamification-design.md · relation: implements

## Knowledge Gaps
- **116 isolated node(s):** `bebas`, `oswald`, `metadata`, `CONTESTABLE_BADGE_IDS`, `SECTIONS` (+111 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `players.equipped_badge_id column` and `Equippable titles`?**
  _Edge tagged AMBIGUOUS (relation: implements) - confidence is low._
- **Why does `useCurrentClub()` connect `Club Admin Pages` to `Page Route Inventory`, `Session Setup Wizard`, `Head-to-Head & League Gamification Design`, `League Hub & Crowns`, `App Shell & Fonts`, `League Stats & Badge Medallions`, `Auth & Play Pages`, `Ladder Enrollment & Badge Holders`, `Season Wrapped & Flight Changes`, `Badges Gallery & Crowns Page`, `Player of the Month`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `getCurrentUser()` connect `Auth & Play Pages` to `Page Route Inventory`, `Session Setup Wizard`, `Club Admin Pages`, `Head-to-Head & League Gamification Design`, `League Hub & Crowns`, `App Shell & Fonts`, `League Stats & Badge Medallions`, `Ladder Enrollment & Badge Holders`, `Badges Gallery & Crowns Page`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `supabase` connect `Head-to-Head & League Gamification Design` to `Page Route Inventory`, `Session Setup Wizard`, `Club Admin Pages`, `League Hub & Crowns`, `App Shell & Fonts`, `Auth & Play Pages`, `Ladder Enrollment & Badge Holders`, `Badges Gallery & Crowns Page`, `Avatar System`, `Session Dues Splitting`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `bebas`, `oswald`, `metadata` to the rest of the system?**
  _116 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Page Route Inventory` be split into smaller, more focused modules?**
  _Cohesion score 0.06374829001367989 - nodes in this community are weakly interconnected._
- **Should `Session Setup Wizard` be split into smaller, more focused modules?**
  _Cohesion score 0.052393857271906055 - nodes in this community are weakly interconnected._