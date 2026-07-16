-- Auction Mode Phase 5: schema, RLS, and Postgres functions for
-- categorization, player pool, and team setup. Live bidding (Phase 7) and
-- Firebase phone OTP (Phase 6) are explicitly NOT part of this migration —
-- saved for their own dedicated sessions per the locked plan.

-- ============================================================
-- Tables
-- ============================================================

create table auctions (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references clubs(id) on delete cascade,
  name            text not null,
  status          text not null default 'draft' check (status in ('draft', 'registration_open', 'registration_closed', 'active', 'completed')),
  purse_amount    bigint not null default 10000000 check (purse_amount > 0),
  min_roster_size int not null default 5 check (min_roster_size > 0),
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz not null default now()
);
create index auctions_club_id_idx on auctions (club_id);

create table auction_categories (
  id          uuid primary key default gen_random_uuid(),
  auction_id  uuid not null references auctions(id) on delete cascade,
  club_id     uuid not null references clubs(id) on delete cascade,
  name        text not null,
  base_price  bigint not null check (base_price > 0),
  sort_order  int not null default 0,
  unique (auction_id, name)
);
create index auction_categories_auction_id_idx on auction_categories (auction_id);

create table auction_teams (
  id               uuid primary key default gen_random_uuid(),
  auction_id       uuid not null references auctions(id) on delete cascade,
  club_id          uuid not null references clubs(id) on delete cascade,
  name             text not null,
  logo_url         text,
  owner_user_id    uuid references auth.users(id),
  purse_remaining  bigint not null check (purse_remaining >= 0),
  created_at       timestamptz not null default now(),
  unique (auction_id, name)
);
create index auction_teams_auction_id_idx on auction_teams (auction_id);

-- whatsapp_number/instagram_handle are the reason this table has its own
-- restrictive RLS (see below) instead of a plain is_club_member() SELECT
-- policy like every other table in this app — those two columns must stay
-- hidden from ordinary club members, per the plan's explicit privacy
-- requirement. General pool browsing goes through auction_players_public.
create table auction_players (
  id                 uuid primary key default gen_random_uuid(),
  auction_id         uuid not null references auctions(id) on delete cascade,
  club_id            uuid not null references clubs(id) on delete cascade,
  player_name        text not null,
  player_user_id     uuid references auth.users(id),
  category_id        uuid not null references auction_categories(id),
  whatsapp_number    text,
  instagram_handle   text,
  status             text not null default 'pooled' check (status in ('pooled', 'sold', 'unsold')),
  sold_price         bigint,
  winning_team_id    uuid references auction_teams(id),
  created_at         timestamptz not null default now(),
  unique (auction_id, player_name)
);
create index auction_players_auction_id_idx on auction_players (auction_id);
create index auction_players_category_id_idx on auction_players (category_id);

-- ============================================================
-- RLS
-- ============================================================

alter table auctions enable row level security;
alter table auction_categories enable row level security;
alter table auction_teams enable row level security;
alter table auction_players enable row level security;

create policy "members select auctions" on auctions for select using (is_club_member(club_id));
create policy "admins update auctions" on auctions for update using (is_club_admin(club_id)) with check (is_club_admin(club_id));
create policy "admins delete auctions" on auctions for delete using (is_club_admin(club_id));

create policy "members select auction_categories" on auction_categories for select using (is_club_member(club_id));
create policy "admins update auction_categories" on auction_categories for update using (is_club_admin(club_id)) with check (is_club_admin(club_id));
create policy "admins delete auction_categories" on auction_categories for delete using (is_club_admin(club_id));

create policy "members select auction_teams" on auction_teams for select using (is_club_member(club_id));
create policy "admins update auction_teams" on auction_teams for update using (is_club_admin(club_id)) with check (is_club_admin(club_id));
create policy "admins delete auction_teams" on auction_teams for delete using (is_club_admin(club_id));

-- The privacy boundary: only club admins and the player themselves can read
-- the raw row (and therefore whatsapp_number/instagram_handle). When live
-- bidding (a later phase) makes team ownership real, extend this to also
-- include the winning team's current owner — no such relationship exists
-- yet to gate against.
create policy "admins and self select auction_players" on auction_players for select
  using (is_club_admin(club_id) or player_user_id = auth.uid());
create policy "admins update auction_players" on auction_players for update using (is_club_admin(club_id)) with check (is_club_admin(club_id));
create policy "admins delete auction_players" on auction_players for delete using (is_club_admin(club_id));

-- Direct client INSERT is never the sanctioned path for any of these 4
-- tables — the create_auction*/create_auction_team/create_auction_player
-- RPCs below derive club_id from auction_id server-side (SECURITY DEFINER,
-- same cross-tenant-trust fix already applied to the tournament engine).
revoke insert on auctions, auction_categories, auction_teams, auction_players from authenticated;

-- ============================================================
-- Public pool-browsing view
-- ============================================================

-- Deliberately NOT security_invoker: the view runs as its owner, bypassing
-- auction_players' own restrictive admin/self-only RLS, so ordinary club
-- members can browse the pool (name/category/status/price) same as every
-- other feature in this app. Tenant isolation is instead enforced directly
-- in the view's WHERE clause via is_club_member(club_id) — that call still
-- reads the CALLING session's auth.uid(), independent of view ownership,
-- so this is not a privilege escalation. Contact columns are simply never
-- in the SELECT list, so there's nothing for the owner-bypass to leak.
--
-- Real bug caught during live verification: an earlier version of this
-- view used `with (security_invoker = on)`, which inherited the base
-- table's restrictive RLS and made ordinary members see ZERO rows instead
-- of the intended "browse everyone, minus contact info" — the opposite of
-- both intended failure modes (too open vs. too closed). Confirmed fixed by
-- re-testing as a real non-admin, non-self club member.
create or replace view auction_players_public as
  select id, auction_id, club_id, player_name, category_id, status, sold_price, winning_team_id, created_at
  from auction_players
  where is_club_member(club_id);

alter view auction_players_public owner to postgres;
grant select on auction_players_public to authenticated;

-- ============================================================
-- Functions
-- ============================================================

create or replace function create_auction(p_club_id uuid, p_name text, p_purse_amount bigint, p_min_roster_size int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_club_admin(p_club_id) then raise exception 'Only a club admin can create an auction.'; end if;

  insert into auctions (club_id, name, purse_amount, min_roster_size, created_by)
  values (p_club_id, p_name, p_purse_amount, p_min_roster_size, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function create_auction_category(p_auction_id uuid, p_name text, p_base_price bigint, p_sort_order int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_club_id uuid; v_id uuid;
begin
  select club_id into v_club_id from auctions where id = p_auction_id;
  if v_club_id is null then raise exception 'Auction not found.'; end if;
  if not is_club_admin(v_club_id) then raise exception 'Only a club admin can manage auction categories.'; end if;

  insert into auction_categories (auction_id, club_id, name, base_price, sort_order)
  values (p_auction_id, v_club_id, p_name, p_base_price, p_sort_order)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function create_auction_team(p_auction_id uuid, p_name text, p_logo_url text, p_owner_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_club_id uuid; v_purse bigint; v_id uuid;
begin
  select club_id, purse_amount into v_club_id, v_purse from auctions where id = p_auction_id;
  if v_club_id is null then raise exception 'Auction not found.'; end if;
  if not is_club_admin(v_club_id) then raise exception 'Only a club admin can add auction teams.'; end if;

  insert into auction_teams (auction_id, club_id, name, logo_url, owner_user_id, purse_remaining)
  values (p_auction_id, v_club_id, p_name, p_logo_url, p_owner_user_id, v_purse)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function create_auction_player(
  p_auction_id uuid, p_player_name text, p_player_user_id uuid, p_category_id uuid,
  p_whatsapp_number text, p_instagram_handle text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_club_id uuid; v_id uuid;
begin
  select club_id into v_club_id from auctions where id = p_auction_id;
  if v_club_id is null then raise exception 'Auction not found.'; end if;
  if not is_club_admin(v_club_id) then raise exception 'Only a club admin can add players to the auction pool.'; end if;

  insert into auction_players (auction_id, club_id, player_name, player_user_id, category_id, whatsapp_number, instagram_handle)
  values (p_auction_id, v_club_id, p_player_name, p_player_user_id, p_category_id, p_whatsapp_number, p_instagram_handle)
  returning id into v_id;
  return v_id;
end;
$$;
