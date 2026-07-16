-- Fixes from a dedicated concurrency/financial-integrity review of the
-- Phase 7/8 live-bidding system (20260716020000_auction_phase7_8_bidding.sql).

-- ============================================================
-- HIGH: split contact info into its own restrictively-RLS'd table so
-- auction_players itself can use the same broad is_club_member() SELECT
-- policy every other table uses. Supabase Realtime's postgres_changes
-- enforces the subscribed table's RLS per row per client — the previous
-- admin-or-self-only policy on auction_players silently dropped live bid
-- update events for every ordinary team owner, undermining the entire
-- reason Realtime was used here instead of polling.
-- ============================================================

create table auction_player_contacts (
  auction_player_id uuid primary key references auction_players(id) on delete cascade,
  club_id           uuid not null references clubs(id) on delete cascade,
  player_user_id    uuid references auth.users(id),
  whatsapp_number   text,
  instagram_handle  text
);

insert into auction_player_contacts (auction_player_id, club_id, player_user_id, whatsapp_number, instagram_handle)
select id, club_id, player_user_id, whatsapp_number, instagram_handle from auction_players
where whatsapp_number is not null or instagram_handle is not null or player_user_id is not null;

alter table auction_player_contacts enable row level security;
create policy "admins and self select auction_player_contacts" on auction_player_contacts for select
  using (is_club_admin(club_id) or player_user_id = auth.uid());
revoke insert, update, delete on auction_player_contacts from authenticated;

alter table auction_players drop column whatsapp_number;
alter table auction_players drop column instagram_handle;

drop policy "admins and self select auction_players" on auction_players;
create policy "members select auction_players" on auction_players for select using (is_club_member(club_id));

-- ============================================================
-- HIGH: place_bid checked the bidding team's club_id but never its
-- auction_id — a team from a DIFFERENT (e.g. past/completed) auction in
-- the same club could still bid, silently deducting/crediting purse on a
-- team invisible on the current auction's roster page. Also folds in a LOW
-- fix: reject bids once the auction itself has left 'active' status
-- (previously only current_lot_player_id was checked).
-- ============================================================

create or replace function place_bid(p_auction_player_id uuid, p_team_id uuid, p_amount bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_club_id uuid;
  v_auction_id uuid;
  v_auction_status text;
  v_current_lot uuid;
  v_lot_closes_at timestamptz;
  v_current_bid_amount bigint;
  v_current_bid_team_id uuid;
  v_category_id uuid;
  v_base_price bigint;
  v_min_increment bigint;
  v_team_owner uuid;
  v_team_club_id uuid;
  v_team_auction_id uuid;
  v_purse_remaining bigint;
  v_min_roster_size int;
  v_min_category_price bigint;
  v_won_count int;
  v_remaining_slots int;
  v_max_bid bigint;
  v_floor bigint;
begin
  select auction_id, club_id, category_id into v_auction_id, v_club_id, v_category_id
  from auction_players where id = p_auction_player_id for update;
  if v_auction_id is null then raise exception 'Player not found in any auction.'; end if;

  select owner_user_id, club_id, auction_id into v_team_owner, v_team_club_id, v_team_auction_id from auction_teams where id = p_team_id;
  if v_team_owner is null or v_team_owner != auth.uid() then raise exception 'Only the team owner can bid for this team.'; end if;
  if v_team_club_id != v_club_id or v_team_auction_id != v_auction_id then raise exception 'That team is not part of this auction.'; end if;

  select status, current_lot_player_id into v_auction_status, v_current_lot from auctions where id = v_auction_id;
  if v_auction_status != 'active' then raise exception 'This auction is not currently active.'; end if;
  if v_current_lot is distinct from p_auction_player_id then raise exception 'This lot is not currently open for bidding.'; end if;

  select current_bid_amount, current_bid_team_id, lot_closes_at into v_current_bid_amount, v_current_bid_team_id, v_lot_closes_at
  from auction_players where id = p_auction_player_id;
  if v_lot_closes_at <= now() then raise exception 'This lot has already closed.'; end if;
  if v_current_bid_team_id = p_team_id then raise exception 'Your team already holds the highest bid on this lot.'; end if;

  select base_price into v_base_price from auction_categories where id = v_category_id;
  select min_increment from auctions into v_min_increment where id = v_auction_id;
  v_floor := coalesce(v_current_bid_amount, v_base_price - v_min_increment) + v_min_increment;
  if p_amount < v_floor then raise exception 'Bid must be at least %.', v_floor; end if;

  select purse_remaining into v_purse_remaining from auction_teams where id = p_team_id;
  select min_roster_size into v_min_roster_size from auctions where id = v_auction_id;
  select min(base_price) into v_min_category_price from auction_categories where auction_id = v_auction_id;
  select count(*) into v_won_count from auction_players where auction_id = v_auction_id and winning_team_id = p_team_id and status = 'sold';
  v_remaining_slots := greatest(v_min_roster_size - v_won_count, 1);
  v_max_bid := v_purse_remaining - (v_remaining_slots - 1) * v_min_category_price;
  if p_amount > v_max_bid then
    raise exception 'Bid of % exceeds your max bid of % (based on % more required roster slot(s) after this one).', p_amount, v_max_bid, v_remaining_slots - 1;
  end if;

  update auction_players set
    current_bid_amount = p_amount,
    current_bid_team_id = p_team_id,
    lot_closes_at = now() + make_interval(secs => (select soft_close_seconds from auctions where id = v_auction_id))
  where id = p_auction_player_id;

  insert into auction_bids (auction_player_id, club_id, team_id, amount) values (p_auction_player_id, v_club_id, p_team_id, p_amount);
end;
$$;

-- ============================================================
-- MEDIUM: start_auction_lot's "is another lot open" check was a plain
-- read-then-write with no lock — two admins starting different lots at
-- nearly the same instant could both pass the check, orphaning one
-- player's lot state (auctions.current_lot_player_id can only point to one
-- row). Fixed by making the claim itself an atomic conditional UPDATE
-- (only succeeds if current_lot_player_id IS NULL at the moment Postgres
-- executes it), checked via row count.
-- ============================================================

create or replace function start_auction_lot(p_auction_id uuid, p_auction_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_club_id uuid; v_auction_status text; v_player_status text; v_player_auction_id uuid; v_updated_rows int;
begin
  select club_id, status into v_club_id, v_auction_status from auctions where id = p_auction_id;
  if v_club_id is null then raise exception 'Auction not found.'; end if;
  if not is_club_admin(v_club_id) then raise exception 'Only a club admin can start a lot.'; end if;
  if v_auction_status != 'active' then raise exception 'Auction must be Active to start a lot.'; end if;

  select auction_id, status into v_player_auction_id, v_player_status from auction_players where id = p_auction_player_id;
  if v_player_auction_id is distinct from p_auction_id then raise exception 'That player is not in this auction pool.'; end if;
  if v_player_status != 'pooled' then raise exception 'Only a pooled (not yet sold/unsold) player can be put up for bid.'; end if;

  update auctions set current_lot_player_id = p_auction_player_id where id = p_auction_id and current_lot_player_id is null;
  get diagnostics v_updated_rows = row_count;
  if v_updated_rows = 0 then raise exception 'Another lot is still open — resolve it before starting the next one.'; end if;

  update auction_players set current_bid_amount = null, current_bid_team_id = null,
    lot_closes_at = now() + make_interval(secs => (select soft_close_seconds from auctions where id = p_auction_id))
  where id = p_auction_player_id;
end;
$$;

-- External signature unchanged (still takes whatsapp_number/
-- instagram_handle) — only the internal target table changes.
create or replace function create_auction_player(
  p_auction_id uuid, p_player_name text, p_player_user_id uuid, p_category_id uuid,
  p_whatsapp_number text, p_instagram_handle text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_club_id uuid; v_id uuid;
begin
  select club_id into v_club_id from auctions where id = p_auction_id;
  if v_club_id is null then raise exception 'Auction not found.'; end if;
  if not is_club_admin(v_club_id) then raise exception 'Only a club admin can add players to the auction pool.'; end if;

  insert into auction_players (auction_id, club_id, player_name, player_user_id, category_id)
  values (p_auction_id, v_club_id, p_player_name, p_player_user_id, p_category_id)
  returning id into v_id;

  if p_whatsapp_number is not null or p_instagram_handle is not null or p_player_user_id is not null then
    insert into auction_player_contacts (auction_player_id, club_id, player_user_id, whatsapp_number, instagram_handle)
    values (v_id, v_club_id, p_player_user_id, p_whatsapp_number, p_instagram_handle);
  end if;

  return v_id;
end;
$$;
