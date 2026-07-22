-- Guest/Friend-Group mode ("circles") — lightweight group tier below clubs.
-- No admin role by design: circles have no danger-zone/void/remove-member
-- concept, so unlike club_members there is no role column and no
-- is_circle_admin() function. created_by is informational only (who
-- generated the join link), not a privilege gate.
--
-- MVP scope: sessions + rounds only. Dues, auctions, tournaments, badges,
-- ladder stay club-only — not extended to circles in this migration.
--
-- Repeats SECURITY DEFINER SET search_path = 'public' explicitly on every
-- function per this codebase's own hardening convention (see
-- 20260716090000_member_removal.sql) — a prior CREATE OR REPLACE here
-- silently dropped search_path by omitting the repeat.

create table circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique default substr(md5(random()::text), 1, 8),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table circle_members (
  circle_id uuid not null references circles(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create or replace function is_circle_member(p_circle_id uuid) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select exists (select 1 from circle_members where circle_id = p_circle_id and user_id = auth.uid());
$$;

alter table circles enable row level security;
alter table circle_members enable row level security;

create policy "circles member read" on circles for select
  using (is_circle_member(id));

create policy "circles member insert own" on circles for insert
  with check (created_by = auth.uid());

create policy "circle_members self read" on circle_members for select
  using (is_circle_member(circle_id));

create policy "circle_members self join" on circle_members for insert
  with check (user_id = auth.uid());

-- sessions.club_id becomes optional; circle_id is the alternative owner.
-- Exactly one of the two must be set — never both, never neither.
alter table sessions add column circle_id uuid references circles(id);
alter table sessions alter column club_id drop not null;
alter table sessions add constraint sessions_club_xor_circle
  check ((club_id is not null) <> (circle_id is not null));

-- Extend existing club-scoped ALL policies to OR in circle membership.
-- "admins can void sessions" is intentionally left club-only — circles have
-- no admin role, so a circle session simply cannot be voided this way yet.
drop policy "sessions club member access" on sessions;
create policy "sessions club member access" on sessions for all
  using (is_club_member(club_id) or is_circle_member(circle_id))
  with check (is_club_member(club_id) or is_circle_member(circle_id));

drop policy "rounds club member access" on rounds;
create policy "rounds club member access" on rounds for all
  using (
    exists (
      select 1 from sessions
      where sessions.id = rounds.session_id
        and (is_club_member(sessions.club_id) or is_circle_member(sessions.circle_id))
    )
  )
  with check (
    exists (
      select 1 from sessions
      where sessions.id = rounds.session_id
        and (is_club_member(sessions.club_id) or is_circle_member(sessions.circle_id))
    )
  );
