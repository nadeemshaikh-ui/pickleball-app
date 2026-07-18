-- Hardens record_tournament_match_score_self per security review of the
-- self-score feature (20260718000000): the anon-reachable self-score path
-- has no per-caller identity and no secret (unlike the court-code sibling),
-- so a bad-faith visitor to a public /watch link could otherwise re-score
-- an already-completed match repeatedly, re-running advance_tournament_match
-- each time and silently flipping which team propagates into the next round
-- — desyncing bracket state with nothing to reconcile it. Once scored via
-- this path, a match is locked; a club admin must use the authenticated
-- record_tournament_match_score path to correct it. Also adds a basic score
-- sanity check now that this RPC is reachable by an unvetted anon caller.

create or replace function record_tournament_match_score_self(
  p_match_id uuid, p_score_a int, p_score_b int
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_tournament_id uuid;
  v_self_score_enabled boolean;
  v_stage_status text;
  v_match_status text;
begin
  if p_score_a < 0 or p_score_b < 0 or p_score_a = p_score_b then
    raise exception 'Invalid score — scores must be non-negative and cannot tie.';
  end if;

  select ts.tournament_id, t.self_score_enabled, ts.status, tm.status
  into v_tournament_id, v_self_score_enabled, v_stage_status, v_match_status
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
  if v_match_status = 'completed' then
    raise exception 'This match has already been scored — ask a club admin to correct it if needed.';
  end if;

  update tournament_matches set score_a = p_score_a, score_b = p_score_b, status = 'completed'
  where id = p_match_id;

  perform advance_tournament_match(p_match_id);
end;
$$;
