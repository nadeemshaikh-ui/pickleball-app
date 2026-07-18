-- Team Championship, Phase 1 (schema only — see memory
-- project_pickleball_team_championship_plan for the full locked plan).
-- A new reusable session format: 2 fixed teams with captain-submitted
-- manual pairings (not algorithmically generated), tiered per-stage
-- scoring, and a live Rapid Fire rally-race finale. Every tournament-
-- specific number (rosters, round count, stage boundaries, points-per-win,
-- rapid-fire target/bonus) is config data on the session row, never
-- hardcoded — this format must work "again and again with fresh data"
-- per explicit user instruction, not just for the one tournament that
-- triggered building it.

alter table sessions add column stage_config jsonb;
alter table sessions add column rapid_fire_config jsonb;

alter table sessions drop constraint sessions_format_check;
alter table sessions add constraint sessions_format_check
  check (format = any (array['scramble', 'squad_rivalry', 'court_blocks', 'fixed_partners', 'king_of_court', 'team_championship']));

comment on column sessions.stage_config is
  'Team Championship only. Array of {stageLabel, roundStart, roundEnd, pointsPerWin}, admin-configured per event.';
comment on column sessions.rapid_fire_config is
  'Team Championship only. {targetPoints, rotateEveryNPoints, bonusPoints}, admin-configured per event. Null if the event has no Rapid Fire finale.';

-- Team rosters reuse the squads_v2 shape already built for N-squad Squad
-- Rivalry (see project_pickleball_n_squad_plan) — [{id, label, logoUrl,
-- players}] — rather than a parallel "teams" column. A Team Championship
-- is structurally a squads_v2-shaped 2-team roster with different
-- pairing/scoring rules layered on top, not a different data model.

-- Append-only audit trail for the Rapid Fire finale: every rally point
-- scored, who scored it, and who was on court at the time — needed both
-- for the live rally counter (current score = count of rows per team) and
-- for the pair-rotation-every-N-points logic to know who's up next.
create table rapid_fire_log (
  id                 uuid primary key default gen_random_uuid(),
  session_id         text not null references sessions(id) on delete cascade,
  event_order        int not null,
  scoring_team_id    text not null,
  on_court_players   jsonb not null,
  created_at         timestamptz not null default now(),
  unique (session_id, event_order)
);
create index rapid_fire_log_session_id_idx on rapid_fire_log (session_id);

alter table rapid_fire_log enable row level security;

-- Mirrors the existing "rounds club member access" policy exactly (same
-- club-scoping-through-parent-session pattern already used for every other
-- session-child table).
create policy "rapid_fire_log club member access" on rapid_fire_log
  for all using (
    exists (select 1 from sessions where sessions.id = rapid_fire_log.session_id and is_club_member(sessions.club_id))
  );
