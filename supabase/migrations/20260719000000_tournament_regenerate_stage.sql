-- "Regenerate Bracket" safety net (design-research item, StageWizard follow-up):
-- lets an admin undo a just-generated stage that turned out wrong (bad group
-- count, wrong advance mode) without leaving orphaned data. Deliberately
-- narrow: only the LAST stage in the tournament (deleting a middle stage
-- would desync source_stage_id chains for stages after it), and only if
-- every non-bye match in it is still unscored (deleting a stage with real
-- results would silently destroy completed match history). Matches cascade
-- via tournament_matches.stage_id -> tournament_stages.id on delete cascade,
-- so deleting the stage row is sufficient.

create or replace function delete_tournament_stage(p_stage_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_club_id uuid;
  v_tournament_id uuid;
  v_stage_order int;
  v_max_order int;
  v_scored_count int;
begin
  select club_id, tournament_id, stage_order
  into v_club_id, v_tournament_id, v_stage_order
  from tournament_stages where id = p_stage_id;

  if v_club_id is null then
    raise exception 'Stage not found.';
  end if;
  if not is_club_admin(v_club_id) then
    raise exception 'Only a club admin can delete a stage.';
  end if;

  select max(stage_order) into v_max_order from tournament_stages where tournament_id = v_tournament_id;
  if v_stage_order <> v_max_order then
    raise exception 'Only the most recent stage can be regenerated — earlier stages have later stages chained off them.';
  end if;

  select count(*) into v_scored_count
  from tournament_matches where stage_id = p_stage_id and is_bye = false and status = 'completed';
  if v_scored_count > 0 then
    raise exception 'This stage has scored matches — deleting it would lose that history. Regenerate is only for a stage with no scores yet.';
  end if;

  delete from tournament_stages where id = p_stage_id;
end;
$$;

grant execute on function delete_tournament_stage(uuid) to authenticated;
