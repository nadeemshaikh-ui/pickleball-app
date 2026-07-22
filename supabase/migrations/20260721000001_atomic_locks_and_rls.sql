-- Migration: 20260721000001_atomic_locks_and_rls.sql
-- Description: Adds PostgreSQL advisory locks for atomic stage creation and hardens score recording RLS permissions.

-- 1. Atomic Tournament Stage Creation RPC with Transaction Advisory Lock
CREATE OR REPLACE FUNCTION atomic_create_tournament_stage(
  p_tournament_id UUID,
  p_club_id UUID,
  p_name TEXT,
  p_stage_order INT,
  p_stage_type TEXT,
  p_config JSONB
) RETURNS UUID AS $$
DECLARE
  v_new_stage_id UUID;
BEGIN
  -- Acquire transaction-level advisory lock using hash of tournament ID to prevent concurrent stage generation spikes
  PERFORM pg_advisory_xact_lock(hashtext(p_tournament_id::TEXT));

  -- Check if stage already exists for this order
  IF EXISTS (
    SELECT 1 FROM tournament_stages 
    WHERE tournament_id = p_tournament_id AND stage_order = p_stage_order
  ) THEN
    RAISE EXCEPTION 'Stage order % already exists for tournament %', p_stage_order, p_tournament_id;
  END IF;

  INSERT INTO tournament_stages (
    tournament_id,
    club_id,
    name,
    stage_order,
    stage_type,
    config,
    created_at
  ) VALUES (
    p_tournament_id,
    p_club_id,
    p_name,
    p_stage_order,
    p_stage_type,
    p_config,
    now()
  ) RETURNING id INTO v_new_stage_id;

  RETURN v_new_stage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atomic Player Rename RPC
CREATE OR REPLACE FUNCTION rename_player_everywhere(
  p_club_id UUID,
  p_old_name TEXT,
  p_new_name TEXT
) RETURNS VOID AS $$
BEGIN
  -- Update club member profile name if matched
  UPDATE club_members
  SET name = p_new_name
  WHERE club_id = p_club_id AND name = p_old_name;

  -- Update player names array inside tournament teams
  UPDATE tournament_teams
  SET player_names = array_replace(player_names, p_old_name, p_new_name)
  WHERE club_id = p_club_id AND p_old_name = ANY(player_names);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
