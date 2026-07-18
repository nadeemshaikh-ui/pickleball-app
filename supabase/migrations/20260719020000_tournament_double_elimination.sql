-- Allow 'double_elimination' as a stage_type. The fixture generation and
-- bracket-advancement logic (winner_next_match_id / loser_next_match_id
-- propagation) all live client-side (lib/tournamentFixtures.ts) and in the
-- existing generic advance_tournament_match/create_tournament_stage RPCs,
-- which already support arbitrary loser-bracket wiring — no DB function
-- changes needed beyond loosening this check constraint.

alter table tournament_stages drop constraint tournament_stages_stage_type_check;
alter table tournament_stages add constraint tournament_stages_stage_type_check
  check (stage_type in ('league', 'group', 'knockout', 'page_playoff', 'simple_semifinal', 'double_elimination'));
