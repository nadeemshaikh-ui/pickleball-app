-- N-squad Squad Rivalry, Phase 1 (schema + backward-compat spine only —
-- no algorithm/UI changes yet, see memory project_pickleball_n_squad_plan
-- for the full locked plan). Purely additive: squads_v2 is a NEW column,
-- nothing existing reads or writes it yet, so this migration is invisible
-- to the live app. Backfills every existing squad_rivalry session's gold/
-- black data into the new N-squad array shape so no history is orphaned
-- once the app cuts over in a later phase.

alter table sessions add column squads_v2 jsonb;

update sessions
set squads_v2 = jsonb_build_array(
  jsonb_build_object(
    'id', 'gold',
    'label', coalesce(squad_gold_label, 'Gold'),
    'logoUrl', squad_gold_logo_url,
    'players', coalesce(squads -> 'gold', '[]'::jsonb)
  ),
  jsonb_build_object(
    'id', 'black',
    'label', coalesce(squad_black_label, 'Black'),
    'logoUrl', squad_black_logo_url,
    'players', coalesce(squads -> 'black', '[]'::jsonb)
  )
)
where format = 'squad_rivalry' and squads is not null;
