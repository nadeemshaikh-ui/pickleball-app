-- Slot-claiming registration (design-research item): an alternative to the
-- free-form "type your name" registration already shipped in Batch A — the
-- organizer pre-creates N numbered slots, players claim a specific one.
-- Mutually exclusive with free-form per tournament (slot_count null/0 =
-- free-form, as today; slot_count > 0 = slot-claim mode), not layered on
-- top, to keep the public page's mental model simple: one registration
-- surface per tournament, chosen by the admin.

alter table tournaments add column slot_count int;
alter table tournament_registrations add column slot_number int;

-- Partial unique index (not a plain unique constraint) so a withdrawn
-- registration frees its slot for someone else to claim, matching how
-- withdraw_tournament_registration already works for free-form entries.
-- This is also what makes claiming race-safe: two concurrent claims for the
-- same slot can both pass the RPC's own SELECT check, but only one INSERT
-- will survive this index — the loser gets a unique_violation to catch.
create unique index tournament_registrations_slot_unique
  on tournament_registrations (tournament_id, slot_number)
  where slot_number is not null and status <> 'withdrawn';

create or replace function set_tournament_slot_count(p_tournament_id uuid, p_slot_count int)
returns void language plpgsql security definer set search_path = public as $$
declare v_club_id uuid;
begin
  select club_id into v_club_id from tournaments where id = p_tournament_id;
  if v_club_id is null then
    raise exception 'Tournament not found.';
  end if;
  if not is_club_admin(v_club_id) then
    raise exception 'Only a club admin can change slot settings.';
  end if;
  if p_slot_count is not null and p_slot_count < 1 then
    raise exception 'Slot count must be at least 1, or null to turn off slot-claiming.';
  end if;
  update tournaments set slot_count = p_slot_count where id = p_tournament_id;
end;
$$;

grant execute on function set_tournament_slot_count(uuid, int) to authenticated;

create or replace function claim_tournament_slot(
  p_share_token text, p_slot_number int, p_registrant_name text, p_partner_name text
) returns void language plpgsql security definer set search_path = public as $$
declare v_tournament tournaments%rowtype;
begin
  select * into v_tournament from tournaments where share_token = p_share_token;
  if not found then
    raise exception 'Tournament not found.';
  end if;
  if not v_tournament.registration_open then
    raise exception 'Registration is closed for this tournament.';
  end if;
  if v_tournament.slot_count is null then
    raise exception 'This tournament is not using numbered slots.';
  end if;
  if p_slot_number < 1 or p_slot_number > v_tournament.slot_count then
    raise exception 'Slot % does not exist — this tournament has % slots.', p_slot_number, v_tournament.slot_count;
  end if;
  if p_registrant_name is null or btrim(p_registrant_name) = '' then
    raise exception 'Name is required.';
  end if;

  begin
    insert into tournament_registrations (tournament_id, club_id, registrant_name, partner_name, registered_by_user_id, slot_number)
    values (v_tournament.id, v_tournament.club_id, btrim(p_registrant_name), nullif(btrim(coalesce(p_partner_name, '')), ''), auth.uid(), p_slot_number);
  exception when unique_violation then
    raise exception 'Slot % was just claimed by someone else — pick another.', p_slot_number;
  end;
end;
$$;

grant execute on function claim_tournament_slot(text, int, text, text) to anon;

-- Extend the public JSON with slotCount (tournament-level) and slotNumber
-- (per-registration) so the /watch page can render the slot grid.
create or replace function get_tournament_public(p_share_token text) returns json
language plpgsql security definer set search_path = public as $$
declare v_tournament tournaments%rowtype; result json;
begin
  select * into v_tournament from tournaments where share_token = p_share_token;
  if not found then return null; end if;

  select json_build_object(
    'tournament', json_build_object(
      'id', v_tournament.id, 'name', v_tournament.name, 'status', v_tournament.status,
      'registrationOpen', v_tournament.registration_open, 'selfScoreEnabled', v_tournament.self_score_enabled,
      'slotCount', v_tournament.slot_count
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
                'id', id, 'registrantName', registrant_name, 'partnerName', partner_name, 'status', status, 'slotNumber', slot_number
              ) order by created_at), '[]'::json)
              from tournament_registrations where tournament_id = v_tournament.id and status <> 'withdrawn')
  ) into result;

  return result;
end;
$$;
