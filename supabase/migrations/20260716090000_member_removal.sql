-- Club admin can remove a member (revokes access); their global profile and
-- match history are never deleted. removed_at follows this codebase's own
-- convention for binary state (resolved_at on club_join_requests,
-- completed_at on tournaments) rather than a text status column.
--
-- is_club_member/is_club_admin gate every RLS policy in the app, so
-- excluding removed rows here automatically revokes access everywhere with
-- no other RLS changes needed. Both CREATE OR REPLACE statements repeat
-- SECURITY DEFINER SET search_path = public explicitly — this codebase's
-- own hardening migration documents a real prior regression where an
-- earlier CREATE OR REPLACE silently dropped search_path from not
-- repeating it.
alter table club_members add column removed_at timestamptz;
alter table club_members add column removed_by uuid references auth.users(id);

create or replace function is_club_member(p_club_id uuid) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select exists (select 1 from club_members where club_id = p_club_id and user_id = auth.uid() and removed_at is null);
$$;

create or replace function is_club_admin(p_club_id uuid) returns boolean
language sql stable security definer set search_path = 'public' as $$
  select exists (select 1 from club_members where club_id = p_club_id and user_id = auth.uid() and role = 'admin' and removed_at is null);
$$;

create or replace function remove_club_member(p_club_id uuid, p_target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin_count int;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Only a club admin can remove members.';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'Admins cannot remove themselves this way.';
  end if;
  select count(*) into v_admin_count from club_members where club_id = p_club_id and role = 'admin' and removed_at is null;
  if v_admin_count <= 1 and exists (select 1 from club_members where club_id = p_club_id and user_id = p_target_user_id and role = 'admin' and removed_at is null) then
    raise exception 'Cannot remove the club''s last remaining admin.';
  end if;
  update club_members set removed_at = now(), removed_by = auth.uid()
  where club_id = p_club_id and user_id = p_target_user_id and removed_at is null;
end;
$$;

create or replace function restore_club_member(p_club_id uuid, p_target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Only a club admin can restore members.';
  end if;
  update club_members set removed_at = null, removed_by = null
  where club_id = p_club_id and user_id = p_target_user_id;
end;
$$;
