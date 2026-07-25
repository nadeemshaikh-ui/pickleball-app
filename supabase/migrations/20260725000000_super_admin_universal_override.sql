-- Universal Super Admin Permission Override Migration
-- Grants super admins global master-key access across all club permissions,
-- member lists, and role management.

create or replace function is_club_member(p_club_id uuid) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select exists (
    select 1 from club_members where club_id = p_club_id and user_id = auth.uid() and removed_at is null
  ) or is_super_admin();
$$;

create or replace function is_club_admin(p_club_id uuid) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select exists (
    select 1 from club_members where club_id = p_club_id and user_id = auth.uid() and role = 'admin' and removed_at is null
  ) or is_super_admin();
$$;

-- Allow super admins to update club member roles in any club via RLS policy
drop policy if exists "club_members update policy" on club_members;
create policy "club_members update policy" on club_members
  for update using (is_club_admin(club_id));

-- Allow super admins to view club_members rows for any club
drop policy if exists "club_members select policy" on club_members;
create policy "club_members select policy" on club_members
  for select using (is_club_member(club_id));
