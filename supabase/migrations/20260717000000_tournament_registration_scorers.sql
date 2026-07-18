-- Batch A: tournament registration (self-serve + organizer-entered guest
-- entries, same form either way) and per-court scorer access codes (no
-- account needed — a code-holder can submit scores for that court only).
-- Both are new anon-reachable write paths, following the exact pattern
-- already established by get_tournament_public/create_tournament_stage in
-- 20260716000000_tournament_engine.sql: SECURITY DEFINER RPC derives
-- club_id/tournament_id server-side, raw tables stay locked down, no direct
-- client insert.

alter table tournaments add column registration_open boolean not null default true;

-- court_label added now (ahead of the full court-scheduling engine, Phase
-- 3/Batch C) so scorer codes can be properly court-scoped from day one —
-- until Batch C actually populates it, every match's court_label is null
-- and a code just needs to be valid for the tournament; once populated,
-- the code must match the specific court a match is assigned to.
alter table tournament_matches add column court_label text;

create table tournament_registrations (
  id                     uuid primary key default gen_random_uuid(),
  tournament_id          uuid not null references tournaments(id) on delete cascade,
  club_id                uuid not null references clubs(id) on delete cascade,
  registrant_name        text not null,
  partner_name           text,
  registered_by_user_id  uuid references auth.users(id),
  status                 text not null default 'registered' check (status in ('registered', 'waitlisted', 'withdrawn')),
  created_at             timestamptz not null default now()
);
create index tournament_registrations_tournament_id_idx on tournament_registrations (tournament_id);

create table tournament_court_scorer_codes (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments(id) on delete cascade,
  club_id        uuid not null references clubs(id) on delete cascade,
  court_label    text not null,
  code           text not null,
  created_by     uuid not null references auth.users(id),
  created_at     timestamptz not null default now(),
  unique (tournament_id, court_label)
);

-- ============================================================
-- RLS — admin-only for direct table access on both new tables. All writes
-- (including the anon ones) go through the SECURITY DEFINER RPCs below,
-- which do their own authorization (share_token or code match) instead of
-- relying on is_club_member/is_club_admin — a registrant or scorer has
-- neither club membership nor, usually, an account at all.
-- ============================================================

alter table tournament_registrations enable row level security;
alter table tournament_court_scorer_codes enable row level security;

create policy "admins select tournament_registrations" on tournament_registrations for select using (is_club_admin(club_id));
create policy "admins delete tournament_registrations" on tournament_registrations for delete using (is_club_admin(club_id));

create policy "admins manage tournament_court_scorer_codes" on tournament_court_scorer_codes
  for all using (is_club_admin(club_id)) with check (is_club_admin(club_id));

revoke all on tournament_registrations, tournament_court_scorer_codes from anon;

-- ============================================================
-- Functions
-- ============================================================

-- Anon-reachable. Self-registration and organizer-entered guest entries are
-- the SAME action — the only difference is who's operating the form (the
-- player themselves via the public share link, or the organizer typing a
-- name on their behalf at the registration desk). No separate guest path.
create or replace function register_for_tournament(p_share_token text, p_registrant_name text, p_partner_name text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tournament tournaments%rowtype;
begin
  select * into v_tournament from tournaments where share_token = p_share_token;
  if not found then
    raise exception 'Tournament not found.';
  end if;
  if not v_tournament.registration_open then
    raise exception 'Registration is closed for this tournament.';
  end if;
  if p_registrant_name is null or btrim(p_registrant_name) = '' then
    raise exception 'Name is required.';
  end if;

  insert into tournament_registrations (tournament_id, club_id, registrant_name, partner_name, registered_by_user_id)
  values (v_tournament.id, v_tournament.club_id, btrim(p_registrant_name), nullif(btrim(coalesce(p_partner_name, '')), ''), auth.uid());
end;
$$;

grant execute on function register_for_tournament(text, text, text) to anon;

create or replace function withdraw_tournament_registration(p_registration_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_club_id uuid;
begin
  select club_id into v_club_id from tournament_registrations where id = p_registration_id;
  if v_club_id is null then
    raise exception 'Registration not found.';
  end if;
  if not is_club_admin(v_club_id) then
    raise exception 'Only a club admin can withdraw a registration.';
  end if;
  update tournament_registrations set status = 'withdrawn' where id = p_registration_id;
end;
$$;

create or replace function set_tournament_registration_open(p_tournament_id uuid, p_open boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_club_id uuid;
begin
  select club_id into v_club_id from tournaments where id = p_tournament_id;
  if v_club_id is null then
    raise exception 'Tournament not found.';
  end if;
  if not is_club_admin(v_club_id) then
    raise exception 'Only a club admin can change registration status.';
  end if;
  update tournaments set registration_open = p_open where id = p_tournament_id;
end;
$$;

create or replace function create_court_scorer_code(p_tournament_id uuid, p_court_label text)
returns text language plpgsql security definer set search_path = public as $$
declare v_club_id uuid; v_code text;
begin
  select club_id into v_club_id from tournaments where id = p_tournament_id;
  if v_club_id is null then
    raise exception 'Tournament not found.';
  end if;
  if not is_club_admin(v_club_id) then
    raise exception 'Only a club admin can create scorer codes.';
  end if;
  if p_court_label is null or btrim(p_court_label) = '' then
    raise exception 'Court label is required.';
  end if;

  v_code := upper(substr(md5(random()::text), 1, 6));
  insert into tournament_court_scorer_codes (tournament_id, club_id, court_label, code, created_by)
  values (p_tournament_id, v_club_id, btrim(p_court_label), v_code, auth.uid())
  on conflict (tournament_id, court_label) do update set code = excluded.code, created_by = excluded.created_by, created_at = now();

  return v_code;
end;
$$;

-- Atomic write+advance, same shape as record_tournament_match_score, but
-- authorized by a valid per-court code instead of club membership — a
-- scorer holding this code needs no account and no club membership. Court
-- scoping degrades gracefully: if the match's court_label isn't set yet
-- (Batch C not built), any code valid for the tournament works; once a
-- match has a court_label, the code must match it exactly.
create or replace function record_tournament_match_score_with_code(
  p_match_id uuid, p_score_a int, p_score_b int, p_court_label text, p_code text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_club_id uuid;
  v_match_court text;
  v_tournament_id uuid;
  v_stage_status text;
  v_code_valid boolean;
begin
  select tm.club_id, tm.court_label, ts.tournament_id, ts.status
  into v_club_id, v_match_court, v_tournament_id, v_stage_status
  from tournament_matches tm join tournament_stages ts on ts.id = tm.stage_id
  where tm.id = p_match_id;
  if v_club_id is null then
    raise exception 'Match not found.';
  end if;

  if v_match_court is not null and v_match_court <> p_court_label then
    raise exception 'This code is for a different court.';
  end if;

  select exists (
    select 1 from tournament_court_scorer_codes
    where tournament_id = v_tournament_id and court_label = p_court_label and code = upper(btrim(p_code))
  ) into v_code_valid;
  if not v_code_valid then
    raise exception 'Invalid scorer code for this court.';
  end if;

  if v_stage_status = 'completed' then
    raise exception 'This stage is already complete — its results have been used to seed the next stage and can no longer be edited.';
  end if;

  update tournament_matches set score_a = p_score_a, score_b = p_score_b, status = 'completed'
  where id = p_match_id;

  perform advance_tournament_match(p_match_id);
end;
$$;

grant execute on function record_tournament_match_score_with_code(uuid, int, int, text, text) to anon;

-- Extend the existing narrow public JSON with registrations (name/partner/
-- status only — no user_id, no club internals) so participants can see
-- who else has signed up on the same public page they'd register from.
-- Withdrawn entries are excluded, not just hidden client-side.
create or replace function get_tournament_public(p_share_token text) returns json
language plpgsql security definer set search_path = public as $$
declare v_tournament tournaments%rowtype; result json;
begin
  select * into v_tournament from tournaments where share_token = p_share_token;
  if not found then return null; end if;

  select json_build_object(
    'tournament', json_build_object('id', v_tournament.id, 'name', v_tournament.name, 'status', v_tournament.status, 'registrationOpen', v_tournament.registration_open),
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
                'isBye', m.is_bye, 'scheduledAt', m.scheduled_at, 'scoreA', m.score_a, 'scoreB', m.score_b, 'status', m.status,
                'courtLabel', m.court_label
              )), '[]'::json)
              from tournament_matches m join tournament_stages st on st.id = m.stage_id
              where st.tournament_id = v_tournament.id),
    'registrations', (select coalesce(json_agg(json_build_object(
                'id', id, 'registrantName', registrant_name, 'partnerName', partner_name, 'status', status
              ) order by created_at), '[]'::json)
              from tournament_registrations where tournament_id = v_tournament.id and status <> 'withdrawn')
  ) into result;

  return result;
end;
$$;
