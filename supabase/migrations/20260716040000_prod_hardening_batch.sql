-- Small prod-hardening batch (public bucket listing, a search_path
-- regression, one more security-definer view).

-- club-logos/group-logos/player-photos are public=true at the bucket
-- level, so reads via getPublicUrl() are already served through the public
-- CDN path, which bypasses storage.objects RLS entirely — these SELECT
-- policies were only ever needed for the storage API's list()/
-- authenticated-get operations, which no app code calls (confirmed via
-- grep: only .upload() and .getPublicUrl() are used anywhere for these
-- buckets). Dropping them closes the "public bucket allows listing"
-- advisory flag with no functional change to how logos/photos display.
drop policy "player photos public read" on storage.objects;
drop policy "public read club-logos" on storage.objects;
drop policy "public read group-logos" on storage.objects;

-- Real regression caught by this batch's own hardening pass: an earlier
-- migration (giant_slayer_wins tracking) re-created apply_ladder_after_score
-- via CREATE OR REPLACE without repeating `set search_path = public` —
-- CREATE OR REPLACE replaces the full function definition including
-- config, it doesn't merge with the version that had search_path set
-- earlier this session. Using ALTER FUNCTION here (not another
-- CREATE OR REPLACE) so there's no risk of retyping the trigger body.
alter function apply_ladder_after_score() set search_path = public;

-- auction_players_public was deliberately built without security_invoker
-- (needed when auction_players' own RLS was admin/self-only for the
-- whatsapp/instagram columns) — but the bidding-review-fixes migration
-- already broadened auction_players' own SELECT RLS to is_club_member(),
-- so ordinary members can now read the base table directly under their
-- own RLS. Safe to switch to security_invoker=on, clearing the ERROR-level
-- "Security Definer View" lint with no functional change (re-verified live
-- as a real non-admin club member after applying).
alter view auction_players_public set (security_invoker = on);
