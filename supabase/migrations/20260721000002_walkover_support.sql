-- Migration: 20260721000002_walkover_support.sql
-- Description: Adds walkover and forfeit match statuses to unblock stage advancement on rain-outs or no-shows.

ALTER TABLE tournament_matches 
DROP CONSTRAINT IF EXISTS tournament_matches_status_check;

ALTER TABLE tournament_matches 
ADD CONSTRAINT tournament_matches_status_check 
CHECK (status IN ('scheduled', 'in_progress', 'completed', 'walkover', 'forfeit'));

CREATE OR REPLACE FUNCTION record_walkover(
  p_match_id UUID,
  p_winning_team_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE tournament_matches
  SET 
    status = 'walkover',
    score_a = CASE WHEN team_a_id = p_winning_team_id THEN 11 ELSE 0 END,
    score_b = CASE WHEN team_b_id = p_winning_team_id THEN 11 ELSE 0 END,
    updated_at = now()
  WHERE id = p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
