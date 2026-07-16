-- Auction Mode Phase 7 (live bidding) + Phase 8 (lot resolution, relist).
-- The highest-risk piece in the whole tournament/auction plan — money-
-- adjacent, concurrency-critical. See place_bid's own comments for how
-- correctness is structured; verified live against real simultaneous-bid
-- scenarios (self-outbid guard, floor/increment, price cap, expiry,
-- sold/unsold outcomes, purse deduction) before this was committed.

alter table auctions
  add column current_lot_player_id uuid references auction_players(id),
  add column soft_close_seconds int not null default 15 check (soft_close_seconds > 0),
  add column min_increment bigint not null default 5000 check (min_increment > 0);

alter table auction_players
  add column current_bid_amount bigint,
  add column current_bid_team_id uuid references auction_teams(id),
  add column lot_closes_at timestamptz,
  add column lot_order int not null default 0;

create table auction_bids (
  id                uuid primary key default gen_random_uuid(),
  auction_player_id uuid not null references auction_players(id) on delete cascade,
  club_id           uuid not null references clubs(id) on delete cascade,
  team_id           uuid not null references auction_teams(id),
  amount            bigint not null check (amount > 0),
  created_at        timestamptz not null default now()
);
create index auction_bids_auction_player_id_idx on auction_bids (auction_player_id);
create index auction_bids_club_id_idx on auction_bids (club_id);

alter table auction_bids enable row level security;
create policy "members select auction_bids" on auction_bids for select using (is_club_member(club_id));
revoke insert, update, delete on auction_bids from authenticated;

-- ============================================================
-- Bidding functions — the correctness-critical core.
-- ============================================================

create or replace function start_auction_lot(p_auction_id uuid, p_auction_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_club_id uuid; v_auction_status text; v_current_lot uuid; v_player_status text; v_player_auction_id uuid;
begin
  select club_id, status, current_lot_player_id into v_club_id, v_auction_status, v_current_lot from auctions where id = p_auction_id;
  if v_club_id is null then raise exception 'Auction not found.'; end if;
  if not is_club_admin(v_club_id) then raise exception 'Only a club admin can start a lot.'; end if;
  if v_auction_status != 'active' then raise exception 'Auction must be Active to start a lot.'; end if;
  if v_current_lot is not null then raise exception 'Another lot is still open — resolve it before starting the next one.'; end if;

  select auction_id, status into v_player_auction_id, v_player_status from auction_players where id = p_auction_player_id;
  if v_player_auction_id is distinct from p_auction_id then raise exception 'That player is not in this auction pool.'; end if;
  if v_player_status != 'pooled' then raise exception 'Only a pooled (not yet sold/unsold) player can be put up for bid.'; end if;

  update auction_players set current_bid_amount = null, current_bid_team_id = null,
    lot_closes_at = now() + make_interval(secs => (select soft_close_seconds from auctions where id = p_auction_id))
  where id = p_auction_player_id;

  update auctions set current_lot_player_id = p_auction_player_id where id = p_auction_id;
end;
$$;

-- The atomic core. SELECT ... FOR UPDATE on the lot row is the FIRST
-- statement, before any read of mutable bid state — this is what makes
-- concurrent bids safe: a second, truly-simultaneous call blocks at that
-- row lock until the first transaction commits, then proceeds with a
-- fresh read of the now-current state. A race can never let two bids both
-- "win" the same instant. Enforces is-current-lot, not-expired,
-- self-outbid guard, minimum valid amount, and the per-team price cap —
-- all inside one transaction, none of it trusted from the client.
create or replace function place_bid(p_auction_player_id uuid, p_team_id uuid, p_amount bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_club_id uuid;
  v_auction_id uuid;
  v_current_lot uuid;
  v_lot_closes_at timestamptz;
  v_current_bid_amount bigint;
  v_current_bid_team_id uuid;
  v_category_id uuid;
  v_base_price bigint;
  v_min_increment bigint;
  v_team_owner uuid;
  v_team_club_id uuid;
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

  select owner_user_id, club_id into v_team_owner, v_team_club_id from auction_teams where id = p_team_id;
  if v_team_owner is null or v_team_owner != auth.uid() then raise exception 'Only the team owner can bid for this team.'; end if;
  if v_team_club_id != v_club_id then raise exception 'That team is not part of this auction.'; end if;

  select current_lot_player_id into v_current_lot from auctions where id = v_auction_id;
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

-- Idempotent, safely callable by any club member. p_force lets an admin
-- close a lot early without waiting for the timer.
create or replace function resolve_lot(p_auction_player_id uuid, p_force boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_club_id uuid; v_auction_id uuid; v_status text; v_lot_closes_at timestamptz;
  v_current_bid_amount bigint; v_current_bid_team_id uuid;
begin
  select auction_id, club_id, status, lot_closes_at, current_bid_amount, current_bid_team_id
  into v_auction_id, v_club_id, v_status, v_lot_closes_at, v_current_bid_amount, v_current_bid_team_id
  from auction_players where id = p_auction_player_id for update;
  if v_auction_id is null then raise exception 'Player not found in any auction.'; end if;

  if v_status != 'pooled' then return; end if;
  if v_lot_closes_at is null then return; end if;
  if not p_force and v_lot_closes_at > now() then return; end if;
  if p_force and not is_club_admin(v_club_id) then raise exception 'Only a club admin can force-close a lot early.'; end if;

  if v_current_bid_team_id is not null then
    update auction_players set status = 'sold', sold_price = v_current_bid_amount, winning_team_id = v_current_bid_team_id
    where id = p_auction_player_id;
    update auction_teams set purse_remaining = purse_remaining - v_current_bid_amount where id = v_current_bid_team_id;
  else
    update auction_players set status = 'unsold' where id = p_auction_player_id;
  end if;

  update auctions set current_lot_player_id = null where id = v_auction_id and current_lot_player_id = p_auction_player_id;
end;
$$;

-- pg_cron backstop — every minute, resolve any expired lot nobody's client
-- already opportunistically closed. A 1-minute worst-case latency only
-- matters when literally no one is watching.
create or replace function sweep_expired_lots()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select ap.id from auction_players ap
    join auctions a on a.id = ap.auction_id and a.current_lot_player_id = ap.id
    where ap.lot_closes_at is not null and ap.lot_closes_at <= now() and ap.status = 'pooled'
  loop
    perform resolve_lot(r.id, false);
  end loop;
end;
$$;

select cron.schedule('sweep-expired-auction-lots', '* * * * *', $$select sweep_expired_lots()$$);

create or replace function relist_auction_player(p_auction_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_club_id uuid; v_status text;
begin
  select club_id, status into v_club_id, v_status from auction_players where id = p_auction_player_id;
  if v_club_id is null then raise exception 'Player not found.'; end if;
  if not is_club_admin(v_club_id) then raise exception 'Only a club admin can relist a player.'; end if;
  if v_status != 'unsold' then raise exception 'Only an unsold player can be relisted.'; end if;

  update auction_players set status = 'pooled' where id = p_auction_player_id;
end;
$$;

create or replace function update_auction_status(p_auction_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_club_id uuid;
begin
  select club_id into v_club_id from auctions where id = p_auction_id;
  if v_club_id is null then raise exception 'Auction not found.'; end if;
  if not is_club_admin(v_club_id) then raise exception 'Only a club admin can change auction status.'; end if;
  if p_status not in ('draft','registration_open','registration_closed','active','completed') then
    raise exception 'Invalid status.';
  end if;

  update auctions set status = p_status where id = p_auction_id;
end;
$$;

-- ============================================================
-- Realtime — the one place in this app where Realtime (not polling) is the
-- right tool: a competitive live auction needs low-latency updates, unlike
-- Mystery Partner's passive reveal pacing. Clients subscribe via
-- postgres_changes, not a manual broadcast channel.
-- ============================================================

alter publication supabase_realtime add table auction_players;
alter publication supabase_realtime add table auctions;

-- current_bid_amount/current_bid_team_id/lot_closes_at aren't sensitive
-- (unlike whatsapp_number/instagram_handle) — every club member watching a
-- live auction needs to see the current bid and countdown, not just
-- admins/the player themselves. The Phase 5 view predated these columns.
create or replace view auction_players_public as
  select id, auction_id, club_id, player_name, category_id, status, sold_price, winning_team_id, created_at,
         current_bid_amount, current_bid_team_id, lot_closes_at
  from auction_players
  where is_club_member(club_id);
