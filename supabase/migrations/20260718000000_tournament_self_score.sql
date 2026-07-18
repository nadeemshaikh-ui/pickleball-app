-- Tournament-wide self-score toggle: an admin-opt-in alternative to per-court
-- scorer codes, for club nights where anyone with the /watch link is already
-- trusted (same trust model the scorer-code system already relies on — see
-- record_tournament_match_score_with_code, anon-callable with no identity
-- check beyond a shared code). Off by default; existing tournaments unaffected.

alter table tournaments add column self_score_enabled boolean not null default false;

create or replace function set_tournament_self_score(p_tournament_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_club_id uuid;
begin
  select club_id into v_club_id from tournaments where id = p_tournament_id;
  if v_club_id is null then
    raise exception 'Tournament not found.';
  end if;
  if not is_club_admin(v_club_id) then
    raise exception 'Only a club admin can change self-score settings.';
  end if;
  update tournaments set self_score_enabled = p_enabled where id = p_tournament_id;
end;
$$;

create or replace function record_tournament_match_score_self(
  p_match_id uuid, p_score_a int, p_score_b int
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_tournament_id uuid;
  v_self_score_enabled boolean;
  v_stage_status text;
begin
  select ts.tournament_id, t.self_score_enabled, ts.status
  into v_tournament_id, v_self_score_enabled, v_stage_status
  from tournament_matches tm
  join tournament_stages ts on ts.id = tm.stage_id
  join tournaments t on t.id = ts.tournament_id
  where tm.id = p_match_id;

  if v_tournament_id is null then
    raise exception 'Match not found.';
  end if;
  if not v_self_score_enabled then
    raise exception 'Self-scoring is not enabled for this tournament.';
  end if;
  if v_stage_status = 'completed' then
    raise exception 'This stage is already complete — its results have been used to seed the next stage and can no longer be edited.';
  end if;

  update tournament_matches set score_a = p_score_a, score_b = p_score_b, status = 'completed'
  where id = p_match_id;

  perform advance_tournament_match(p_match_id);
end;
$$;

grant execute on function set_tournament_self_score(uuid, boolean) to authenticated;
grant execute on function record_tournament_match_score_self(uuid, int, int) to anon;

-- Extend the public JSON with the flag so /watch and /watch/display can
-- decide whether to show inline score-entry on match cards.
create or replace function get_tournament_public(p_share_token text) returns json
language plpgsql security definer set search_path = public as $$
declare v_tournament tournaments%rowtype; result json;
begin
  select * into v_tournament from tournaments where share_token = p_share_token;
  if not found then return null; end if;

  select json_build_object(
    'tournament', json_build_object(
      'id', v_tournament.id, 'name', v_tournament.name, 'status', v_tournament.status,
      'registrationOpen', v_tournament.registration_open, 'selfScoreEnabled', v_tournament.self_score_enabled
    ),
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
