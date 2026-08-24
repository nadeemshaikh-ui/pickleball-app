-- Create custom enums for Match features
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_format') THEN
        CREATE TYPE match_format AS ENUM ('singles', 'doubles', 'mixed_doubles', 'open_play');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cost_split_policy') THEN
        CREATE TYPE cost_split_policy AS ENUM ('even_split', 'creator_pays', 'individual_payment');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'broadcast_target') THEN
        CREATE TYPE broadcast_target AS ENUM ('all_members', 'invite_only', 'dupr_range_only', 'preferred_group');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rsvp_status') THEN
        CREATE TYPE rsvp_status AS ENUM ('invited', 'in', 'out', 'pending', 'waitlisted');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
        CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'confirmed', 'rejected', 'expired');
    END IF;
END $$;

-- Matches Table
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    format match_format NOT NULL DEFAULT 'doubles',
    venue_details JSONB NOT NULL, -- Contains venue_id, court_number, address, name
    dupr_min NUMERIC(3, 2) CHECK (dupr_min >= 2.00 AND dupr_min <= 8.00),
    dupr_max NUMERIC(3, 2) CHECK (dupr_max >= 2.00 AND dupr_max <= 8.00),
    cost_split_policy cost_split_policy NOT NULL DEFAULT 'even_split',
    total_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    max_players INT NOT NULL DEFAULT 4,
    broadcast_target broadcast_target NOT NULL DEFAULT 'all_members',
    scheduled_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_dupr_range CHECK (dupr_min <= dupr_max)
);

-- Match RSVPs / Waitlist Table
CREATE TABLE IF NOT EXISTS match_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status rsvp_status NOT NULL DEFAULT 'pending',
    waitlist_position INT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (match_id, player_id)
);

-- Actionable Action/Push Notifications Queue
CREATE TABLE IF NOT EXISTS match_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    status notification_status NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & rapid query execution
CREATE INDEX IF NOT EXISTS idx_matches_scheduled_time ON matches(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_match_rsvps_composite ON match_rsvps(match_id, status, waitlist_position);
CREATE INDEX IF NOT EXISTS idx_match_notifications_expiry ON match_notifications(expires_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Safely drop if exists then create)
DROP POLICY IF EXISTS "Matches are visible to all authenticated users" ON matches;
CREATE POLICY "Matches are visible to all authenticated users"
    ON matches FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Matches can be created by any authenticated user" ON matches;
CREATE POLICY "Matches can be created by any authenticated user"
    ON matches FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Matches can be updated by their creator" ON matches;
CREATE POLICY "Matches can be updated by their creator"
    ON matches FOR UPDATE TO authenticated USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "RSVPs are visible to all authenticated users" ON match_rsvps;
CREATE POLICY "RSVPs are visible to all authenticated users"
    ON match_rsvps FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create/update their own RSVP" ON match_rsvps;
CREATE POLICY "Users can create/update their own RSVP"
    ON match_rsvps FOR ALL TO authenticated USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "Notifications are visible to the target user" ON match_notifications;
CREATE POLICY "Notifications are visible to the target user"
    ON match_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Auto-Promotion & Cancellation Queue Triggers
CREATE OR REPLACE FUNCTION handle_match_rsvp_change()
RETURNS TRIGGER AS $$
DECLARE
    v_scheduled_time TIMESTAMPTZ;
    v_max_players INT;
    v_confirmed_count INT;
    v_next_waitlisted RECORD;
BEGIN
    -- Get match details
    SELECT scheduled_time, max_players INTO v_scheduled_time, v_max_players 
    FROM matches WHERE id = COALESCE(NEW.match_id, OLD.match_id);

    -- Check if it is a cancellation/decline
    IF (TG_OP = 'UPDATE' AND OLD.status = 'in' AND NEW.status = 'out') OR (TG_OP = 'DELETE' AND OLD.status = 'in') THEN
        -- 2-hour cutoff window for late cancellations
        IF v_scheduled_time - NOW() < INTERVAL '2 hours' THEN
            -- Flag as late cancellation, do not auto-promote to prevent short-notice empty slots
            RAISE NOTICE 'Late cancellation within 2-hour cutoff.';
        ELSE
            -- Auto-promote the first person on the waitlist
            SELECT * INTO v_next_waitlisted 
            FROM match_rsvps 
            WHERE match_id = OLD.match_id AND status = 'waitlisted'
            ORDER BY waitlist_position ASC
            LIMIT 1;

            IF v_next_waitlisted.id IS NOT NULL THEN
                -- Promote player
                UPDATE match_rsvps SET status = 'in', waitlist_position = NULL WHERE id = v_next_waitlisted.id;
                
                -- Shift everyone else up the waitlist
                UPDATE match_rsvps 
                SET waitlist_position = waitlist_position - 1 
                WHERE match_id = OLD.match_id AND status = 'waitlisted' AND waitlist_position > v_next_waitlisted.waitlist_position;
            END IF;
        END IF;
    END IF;

    -- Handle moving a new player to waitlist if match is full
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
        SELECT COUNT(*) INTO v_confirmed_count FROM match_rsvps WHERE match_id = NEW.match_id AND status = 'in';
        IF v_confirmed_count >= v_max_players THEN
            NEW.status := 'waitlisted';
            SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO NEW.waitlist_position FROM match_rsvps WHERE match_id = NEW.match_id AND status = 'waitlisted';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_match_rsvp_change ON match_rsvps;
CREATE TRIGGER trigger_match_rsvp_change
BEFORE INSERT OR UPDATE OR DELETE ON match_rsvps
FOR EACH ROW EXECUTE FUNCTION handle_match_rsvp_change();
