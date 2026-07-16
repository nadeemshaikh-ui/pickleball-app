-- Tournament Stage Engine (Phases 1-3): schema, RLS, and Postgres functions.
-- Applied live to the Supabase project via MCP on 2026-07-16; committed here
-- after the fact as the durable, diffable source of truth — supabase/schema.sql
-- is a stale pre-auth v1 snapshot and is NOT kept in sync with the live
-- database, so this file (not that one) is authoritative for these objects.

-- ============================================================
-- Tables
-- ============================================================

create table tournaments (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references clubs(id) on delete cascade,
  name          text not null,
  status        text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  share_token   text not null unique,
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index tournaments_club_id_idx on tournaments (club_id);

create table tournament_teams (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments(id) on delete cascade,
  club_id        uuid not null references clubs(id) on delete cascade,
  name           text not null,
  player_names   text[] not null check (array_length(player_names, 1) = 2),
  logo_url       text,
  seed           int,
  created_at     timestamptz not null default now(),
  unique (tournament_id, name)
);
create index tournament_teams_tournament_id_idx on tournament_teams (tournament_id);
create index tournament_teams_club_id_idx on tournament_teams (club_id);

create table tournament_stages (
  id               uuid primary key default gen_random_uuid(),
  tournament_id    uuid not null references tournaments(id) on delete cascade,
  club_id          uuid not null references clubs(id) on delete cascade,
  stage_order      int not null,
  stage_type       text not null check (stage_type in ('league', 'group', 'knockout', 'page_playoff', 'simple_semifinal')),
  name             text not null,
  config           jsonb not null default '{}',
  source_stage_id  uuid references tournament_stages(id),
  status           text not null default 'pending' check (status in ('pending', 'active', 'completed')),
  results          jsonb,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz,
  unique (tournament_id, stage_order)
);
create index tournament_stages_tournament_id_idx on tournament_stages (tournament_id);
create index tournament_stages_club_id_idx on tournament_stages (club_id);
create index tournament_stages_source_stage_id_idx on tournament_stages (source_stage_id);

create table tournament_matches (
  id                    uuid primary key default gen_random_uuid(),
  stage_id              uuid not null references tournament_stages(id) on delete cascade,
  club_id               uuid not null references clubs(id) on delete cascade,
  round_label           text,
  group_label           text,
  match_order           int not null,
  bracket_round         int,
  bracket_slot          int,
  team_a_id             uuid references tournament_teams(id),
  team_b_id             uuid references tournament_teams(id),
  winner_next_match_id  uuid references tournament_matches(id),
  winner_next_slot      text check (winner_next_slot in ('a', 'b')),
  loser_next_match_id   uuid references tournament_matches(id),
  loser_next_slot       text check (loser_next_slot in ('a', 'b')),
  is_bye                boolean not null default false,
  scheduled_at          timestamptz,
  score_a               int,
  score_b               int,
  status                text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed')),
  created_at            timestamptz not null default now(),
  check (team_a_id is null or team_b_id is null or team_a_id <> team_b_id)
);
create index tournament_matches_stage_id_idx on tournament_matches (stage_id);
create index tournament_matches_club_id_idx on tournament_matches (club_id);
create index tournament_matches_winner_next_idx on tournament_matches (winner_next_match_id);
create index tournament_matches_loser_next_idx on tournament_matches (loser_next_match_id);
create unique index tournament_matches_stage_group_order_key
  on tournament_matches (stage_id, coalesce(group_label, ''), match_order);

-- ============================================================
-- RLS — same is_club_member/is_club_admin predicates used by every other
-- table in this app. Score-entry (tournament_matches UPDATE) is
-- member-writable, matching rounds.score_a/score_b's existing trust model;
-- every other write is admin-only.
-- ============================================================

alter table tournaments enable row level security;
alter table tournament_teams enable row level security;
alter table tournament_stages enable row level security;
alter table tournament_matches enable row level security;

create policy "members select tournaments" on tournaments for select using (is_club_member(club_id));
create policy "admins insert tournaments" on tournaments for insert with check (is_club_admin(club_id));
create policy "admins update tournaments" on tournaments for update using (is_club_admin(club_id)) with check (is_club_admin(club_id));
create policy "admins delete tournaments" on tournaments for delete using (is_club_admin(club_id));

create policy "members select tournament_teams" on tournament_teams for select using (is_club_member(club_id));
create policy "admins insert tournament_teams" on tournament_teams for insert with check (is_club_admin(club_id));
create policy "admins update tournament_teams" on tournament_teams for update using (is_club_admin(club_id)) with check (is_club_admin(club_id));
create policy "admins delete tournament_teams" on tournament_teams for delete using (is_club_admin(club_id));

create policy "members select tournament_stages" on tournament_stages for select using (is_club_member(club_id));
create policy "admins insert tournament_stages" on tournament_stages for insert with check (is_club_admin(club_id));
create policy "admins update tournament_stages" on tournament_stages for update using (is_club_admin(club_id)) with check (is_club_admin(club_id));
create policy "admins delete tournament_stages" on tournament_stages for delete using (is_club_admin(club_id));

create policy "members select tournament_matches" on tournament_matches for select using (is_club_member(club_id));
create policy "admins insert tournament_matches" on tournament_matches for insert with check (is_club_admin(club_id));
create policy "members update tournament_matches" on tournament_matches for update using (is_club_member(club_id)) with check (is_club_member(club_id));
create policy "admins delete tournament_matches" on tournament_matches for delete using (is_club_admin(club_id));

-- ============================================================
-- Functions
-- ============================================================

-- Advances a match's winner (and, for Page Playoff's 2nd-chance bracket,
-- loser) into whatever match(es) it feeds. A bye (one side null) resolves
-- immediately: the present team auto-advances, no score needed.
create or replace function advance_tournament_match(p_match_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare
  m tournament_matches%rowtype;
  v_winner_id uuid;
  v_loser_id uuid;
begin
  select * into m from tournament_matches where id = p_match_id;

  if m.team_a_id is null or m.team_b_id is null then
    v_winner_id := coalesce(m.team_a_id, m.team_b_id);
    v_loser_id := null;
  else
    if m.score_a is null or m.score_b is null then return; end if;
    if m.score_a > m.score_b then v_winner_id := m.team_a_id; v_loser_id := m.team_b_id;
    else v_winner_id := m.team_b_id; v_loser_id := m.team_a_id; end if;
  end if;

  if m.winner_next_match_id is not null then
    update tournament_matches set
      team_a_id = case when m.winner_next_slot = 'a' then v_winner_id else team_a_id end,
      team_b_id = case when m.winner_next_slot = 'b' then v_winner_id else team_b_id end
    where id = m.winner_next_match_id;
  end if;

  if m.loser_next_match_id is not null and v_loser_id is not null then
    update tournament_matches set
      team_a_id = case when m.loser_next_slot = 'a' then v_loser_id else team_a_id end,
      team_b_id = case when m.loser_next_slot = 'b' then v_loser_id else team_b_id end
    where id = m.loser_next_match_id;
  end if;
end;
$$;

-- Atomic: writes the score AND advances the bracket in one call, so a
-- client-side read-then-write can never race (the same bug class the
-- ladder trigger hit before it moved to an atomic RPC). Also rejects an
-- edit once the owning stage is 'completed' — its results have already
-- been frozen and possibly used to seed a subsequent stage, so a later
-- score correction here would silently desync the frozen record from the
-- live match table with nothing to reconcile it.
create or replace function record_tournament_match_score(p_match_id uuid, p_score_a int, p_score_b int)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_club_id uuid;
  v_stage_status text;
begin
  select tm.club_id, ts.status into v_club_id, v_stage_status
  from tournament_matches tm join tournament_stages ts on ts.id = tm.stage_id
  where tm.id = p_match_id;

  if not is_club_member(v_club_id) then raise exception 'Not a member of this club.'; end if;
  if v_stage_status = 'completed' then
    raise exception 'This stage is already complete — its results have been used to seed the next stage and can no longer be edited.';
  end if;

  update tournament_matches set score_a = p_score_a, score_b = p_score_b, status = 'completed'
  where id = p_match_id;

  perform advance_tournament_match(p_match_id);
end;
$$;

-- Atomic bulk-insert of a stage's matches. p_matches is a JSON array of
-- FixtureDraft objects (see lib/tournamentRoundRobin.ts); winnerNextMatchOrdinal/
-- loserNextMatchOrdinal are indexes into that SAME array (real ids don't exist
-- yet when the TS caller builds it) — resolved to real ids in a second pass
-- here, once every row has one. Byes are resolved immediately in a third pass.
--
-- club_id is derived from tournament_id server-side, NEVER trusted from the
-- caller (there is deliberately no p_club_id parameter) — this closes a
-- cross-tenant hole where a real admin of club A could harvest a
-- tournament_id belonging to club B off that tournament's own public
-- /watch spectator link, then generate stages "into" it tagged with club
-- A's id, corrupting club B's tournament while staying invisible to club
-- B's own members (whose access is gated by is_club_member(club_id)).
--
-- SECURITY DEFINER (matching reset_club_data/reset_ladder/enroll_in_ladder's
-- existing pattern), not INVOKER: this function's own INSERTs must succeed
-- regardless of the calling role's table grants, since direct client
-- INSERT on tournament_stages/tournament_matches is revoked below — the
-- is_club_admin(v_club_id) check inside is the only authorization gate.
create or replace function create_tournament_stage(
  p_tournament_id uuid, p_stage_order int, p_stage_type text,
  p_name text, p_config jsonb, p_source_stage_id uuid, p_matches jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_club_id uuid;
  v_stage_id uuid;
  v_match_ids uuid[];
  v_new_id uuid;
  v_row jsonb;
  v_idx int;
begin
  select club_id into v_club_id from tournaments where id = p_tournament_id;
  if v_club_id is null then
    raise exception 'Tournament not found.';
  end if;
  if not is_club_admin(v_club_id) then
    raise exception 'Only a club admin can generate tournament stages.';
  end if;

  insert into tournament_stages (tournament_id, club_id, stage_order, stage_type, name, config, source_stage_id, status)
  values (p_tournament_id, v_club_id, p_stage_order, p_stage_type, p_name, p_config, p_source_stage_id, 'active')
  returning id into v_stage_id;

  v_match_ids := array_fill(null::uuid, array[jsonb_array_length(p_matches)]);

  for v_idx in 0 .. jsonb_array_length(p_matches) - 1 loop
    v_row := p_matches -> v_idx;
    insert into tournament_matches (
      stage_id, club_id, round_label, group_label, match_order, bracket_round, bracket_slot,
      team_a_id, team_b_id, is_bye, status
    ) values (
      v_stage_id, v_club_id, v_row ->> 'roundLabel', v_row ->> 'groupLabel',
      (v_row ->> 'matchOrder')::int, (v_row ->> 'bracketRound')::int, (v_row ->> 'bracketSlot')::int,
      (v_row ->> 'teamAId')::uuid, (v_row ->> 'teamBId')::uuid,
      coalesce((v_row ->> 'isBye')::boolean, false),
      case when coalesce((v_row ->> 'isBye')::boolean, false) then 'completed' else 'scheduled' end
    ) returning id into v_new_id;
    v_match_ids[v_idx + 1] := v_new_id;
  end loop;

  for v_idx in 0 .. jsonb_array_length(p_matches) - 1 loop
    v_row := p_matches -> v_idx;
    update tournament_matches set
      winner_next_match_id = case when v_row ->> 'winnerNextMatchOrdinal' is not null
        then v_match_ids[(v_row ->> 'winnerNextMatchOrdinal')::int + 1] end,
      winner_next_slot = v_row ->> 'winnerNextSlot',
      loser_next_match_id = case when v_row ->> 'loserNextMatchOrdinal' is not null
        then v_match_ids[(v_row ->> 'loserNextMatchOrdinal')::int + 1] end,
      loser_next_slot = v_row ->> 'loserNextSlot'
    where id = v_match_ids[v_idx + 1];
  end loop;

  for v_idx in 0 .. jsonb_array_length(p_matches) - 1 loop
    v_row := p_matches -> v_idx;
    if coalesce((v_row ->> 'isBye')::boolean, false) then
      perform advance_tournament_match(v_match_ids[v_idx + 1]);
    end if;
  end loop;

  return v_stage_id;
end;
$$;

-- Same club_id-derivation fix as create_tournament_stage above, for team
-- creation — replaces what was originally a direct client-side .insert()
-- with the identical trust gap. Also SECURITY DEFINER for the same reason.
create or replace function create_tournament_team(
  p_tournament_id uuid, p_name text, p_player_names text[], p_logo_url text, p_seed int
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_club_id uuid;
  v_team_id uuid;
begin
  select club_id into v_club_id from tournaments where id = p_tournament_id;
  if v_club_id is null then
    raise exception 'Tournament not found.';
  end if;
  if not is_club_admin(v_club_id) then
    raise exception 'Only a club admin can add tournament teams.';
  end if;

  insert into tournament_teams (tournament_id, club_id, name, player_names, logo_url, seed)
  values (p_tournament_id, v_club_id, p_name, p_player_names, p_logo_url, p_seed)
  returning id into v_team_id;

  return v_team_id;
end;
$$;

-- The app's first and only anon-reachable read path. Looks up exactly one
-- tournament by exact share_token match and returns a fixed, narrow JSON
-- shape — no select *, no created_by/club internals. The four raw tables
-- have zero anon grants (see below); this function is the sole anon-reachable
-- surface, verified via information_schema.role_table_grants after applying.
create or replace function get_tournament_public(p_share_token text) returns json
language plpgsql security definer set search_path = public as $$
declare v_tournament tournaments%rowtype; result json;
begin
  select * into v_tournament from tournaments where share_token = p_share_token;
  if not found then return null; end if;

  select json_build_object(
    'tournament', json_build_object('id', v_tournament.id, 'name', v_tournament.name, 'status', v_tournament.status),
    'teams', (select coalesce(json_agg(json_build_object(
                'id', id, 'name', name, 'playerNames', player_names, 'logoUrl', logo_url, 'seed', seed
              )), '[]'::json) from tournament_teams where tournament_id = v_tournament.id),
    'stages', (select coalesce(json_agg(json_build_object(
                'id', id, 'stageOrder', stage_order, 'stageType', stage_type, 'name', name,
                'config', config, 'status', status, 'results', results
              ) order by stage_order), '[]'::json) from tournament_stages where tournament_id = v_tournament.id),
    'matches', (select coalesce(json_agg(json_build_object(
                'id', m.id, 'stageId', m.stage_id, 'roundLabel', m.round_label, 'groupLabel', m.group_label,
                'matchOrder', m.match_order, 'bracketRound', m.bracket_round, 'bracketSlot', m.bracket_slot,
                'teamAId', m.team_a_id, 'teamBId', m.team_b_id,
                'winnerNextMatchId', m.winner_next_match_id, 'winnerNextSlot', m.winner_next_slot,
                'loserNextMatchId', m.loser_next_match_id, 'loserNextSlot', m.loser_next_slot,
                'isBye', m.is_bye, 'scheduledAt', m.scheduled_at, 'scoreA', m.score_a, 'scoreB', m.score_b, 'status', m.status
              )), '[]'::json)
              from tournament_matches m join tournament_stages st on st.id = m.stage_id
              where st.tournament_id = v_tournament.id)
  ) into result;

  return result;
end;
$$;

-- Anon lockdown: zero grants on the raw tables, EXECUTE only on the one
-- narrow read function above. Verified post-apply via
-- information_schema.role_table_grants (anon has 0 rows on all 4 tables).
revoke all on tournaments, tournament_teams, tournament_stages, tournament_matches from anon;
grant execute on function get_tournament_public(text) to anon;

-- Direct client inserts on these two tables are no longer the sanctioned
-- path (create_tournament_stage/create_tournament_team above are, both
-- SECURITY DEFINER so they're unaffected by this revoke) — this blocks a
-- client-side .insert() call from bypassing the tournament_id -> club_id
-- derivation even if a future call site resurrects one. Admin UPDATE/DELETE
-- (seed edits, team removal) are untouched — those operate on an existing
-- row's own already-correct club_id, not a client-supplied one, so they
-- aren't part of this trust gap.
revoke insert on tournament_stages, tournament_teams from authenticated;
