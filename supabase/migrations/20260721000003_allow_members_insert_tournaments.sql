-- Migration: Allow all club members to create tournaments and generate stages for testing
-- Applied on 2026-07-21

drop policy if exists "admins insert tournaments" on tournaments;
create policy "members insert tournaments" on tournaments for insert with check (is_club_member(club_id));

-- Update RPC create_tournament_stage to allow club members
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
  if not is_club_member(v_club_id) then
    raise exception 'Must be a club member to generate tournament stages.';
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

-- Update RPC create_tournament_team to allow club members
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
  if not is_club_member(v_club_id) then
    raise exception 'Must be a club member to add tournament teams.';
  end if;

  insert into tournament_teams (tournament_id, club_id, name, player_names, logo_url, seed)
  values (p_tournament_id, v_club_id, p_name, p_player_names, p_logo_url, p_seed)
  returning id into v_team_id;

  return v_team_id;
end;
$$;
