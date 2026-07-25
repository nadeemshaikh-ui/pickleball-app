-- Late Arrivals plan, Item 3: atomically swaps every unplayed round from
-- p_from_round onward for a freshly-computed set. Covers all 4 formats
-- Item 3 supports (scramble, squad_rivalry, fixed_partners, court_blocks —
-- King of the Court has no bench mechanism to regenerate against, and
-- Team Championship is explicitly out of scope for the whole plan).
--
-- The actual scheduling (seeded PRNG, fairness ledger, per-format rules —
-- Squad Rivalry's squad-growth, Fixed Partners' orphan-pairing, Court
-- Swap's block-boundary) happens in TypeScript (lib/regenerate.ts) — this
-- function only does the persistence step, but does it as ONE
-- statement-sequence inside a single plpgsql function body, which
-- Postgres runs as one implicit transaction. That's what the plan's own
-- "do the delete and insert in one transaction or an RPC" instruction
-- actually requires — three separate sequential client calls (insert,
-- delete, update) cannot give that guarantee no matter what order they're
-- issued in, since any of the three can fail independently and every
-- reader in this app assumes exactly one row per (round_number, court), so
-- even a *temporary* duplicate window between two client calls is a real
-- correctness bug, not just a recoverable one.
--
-- p_expected_round_count is an optimistic-concurrency check: if the
-- session's round_count no longer matches what the caller read before
-- computing p_new_rounds, someone else's regeneration (or an Add/Remove
-- Round click) already landed and this attempt is working from stale
-- data — better to reject and let the client reload than silently produce
-- a second, conflicting set of "new" rounds on top of theirs.
--
-- p_absent_players is applied atomically together with the round swap —
-- ticking attendance and regenerating the schedule are one user action
-- (the plan's own "ticking is the trigger" principle), so they must be one
-- database commit, not two independently-failable client calls where a
-- failure in the second leaves the roster flag and the actual schedule
-- disagreeing about who's playing.
--
-- p_squads is null for every format except Squad Rivalry, where a
-- returning player who was absent since setup needs to be assigned to a
-- squad for the very first time (existing squad members never move —
-- only growth is ever written here).
--
-- Admin-gated server-side (not just via the client UI's isAdmin check),
-- matching this codebase's existing precedent for the same shape of
-- problem — see delete_tournament_stage in
-- 20260719000000_tournament_regenerate_stage.sql.

create or replace function regenerate_session_rounds(
  p_session_id text,
  p_from_round int,
  p_expected_round_count int,
  p_new_rounds jsonb,
  p_absent_players text[],
  p_squads jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_club_id uuid;
  v_circle_id uuid;
  v_format text;
  v_round_count int;
  v_players text[];
  v_active_count int;
begin
  select club_id, circle_id, format, round_count, players
  into v_club_id, v_circle_id, v_format, v_round_count, v_players
  from sessions where id = p_session_id;

  if v_format is null then
    raise exception 'Session not found.';
  end if;
  if v_format not in ('scramble', 'squad_rivalry', 'fixed_partners', 'court_blocks') then
    raise exception 'Regeneration is not built for this format yet.';
  end if;

  if v_club_id is not null then
    if not is_club_admin(v_club_id) then
      raise exception 'Only a club admin can change tonight''s schedule.';
    end if;
  elsif v_circle_id is not null then
    if not is_circle_member(v_circle_id) then
      raise exception 'You do not have access to this session.';
    end if;
  else
    raise exception 'Session has neither a club nor a circle.';
  end if;

  if v_round_count <> p_expected_round_count then
    raise exception 'This session''s schedule changed since you loaded it — reload and try again.';
  end if;

  if p_from_round is null or p_from_round < 1 then
    raise exception 'Invalid regeneration point.';
  end if;

  select count(*) into v_active_count
  from unnest(v_players) as p
  where p <> all(coalesce(p_absent_players, '{}'::text[]));
  if v_active_count < 4 then
    raise exception 'At least 4 players must be active — this change would leave fewer.';
  end if;

  delete from rounds where session_id = p_session_id and round_number >= p_from_round;

  insert into rounds (session_id, round_number, court, team_a, team_b, sitting_out, score_a, score_b)
  select
    p_session_id,
    (elem->>'round_number')::int,
    (elem->>'court')::int,
    array(select jsonb_array_elements_text(elem->'team_a')),
    array(select jsonb_array_elements_text(elem->'team_b')),
    array(select jsonb_array_elements_text(elem->'sitting_out')),
    null,
    null
  from jsonb_array_elements(p_new_rounds) as elem;

  update sessions
  set round_count = (select coalesce(max(round_number), 0) from rounds where session_id = p_session_id),
      absent_players = p_absent_players,
      squads = coalesce(p_squads, squads)
  where id = p_session_id;
end;
$$;

grant execute on function regenerate_session_rounds(text, int, int, jsonb, text[], jsonb) to authenticated;
