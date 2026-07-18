-- Club creation was previously open to any authenticated user, unlimited.
-- Trust gate: Google-authenticated = verified (no phone/OTP infra exists
-- yet). First club per account is instant; 2nd+ from the same account
-- needs super-admin approval, mirroring the existing club_join_requests
-- shape. Re-request after rejection needs no special handling — no
-- uniqueness constraint blocks a fresh pending row.
create table club_creation_requests (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id),
  requested_name     text not null,
  requested_logo_url text,
  status             text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at       timestamptz not null default now(),
  resolved_at        timestamptz,
  resolved_by        uuid references auth.users(id)
);

alter table club_creation_requests enable row level security;

create policy "ccr select own or super admin" on club_creation_requests
  for select using (auth.uid() = user_id or is_super_admin());

revoke insert on clubs from authenticated;
drop policy if exists "clubs authenticated insert" on clubs;

create or replace function create_own_club(p_name text, p_logo_url text, p_join_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_existing_count int; v_club_id uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Club name is required.';
  end if;
  select count(*) into v_existing_count from clubs where created_by = auth.uid();
  if v_existing_count = 0 then
    insert into clubs (name, logo_url, join_code, created_by)
    values (p_name, p_logo_url, p_join_code, auth.uid())
    returning id into v_club_id;
    insert into club_members (club_id, user_id, role, danger_zone_access)
    values (v_club_id, auth.uid(), 'admin', true);
    return jsonb_build_object('status', 'created', 'club_id', v_club_id);
  else
    insert into club_creation_requests (user_id, requested_name, requested_logo_url)
    values (auth.uid(), p_name, p_logo_url);
    return jsonb_build_object('status', 'pending_approval');
  end if;
end;
$$;

create or replace function approve_club_creation_request(p_request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_req club_creation_requests%rowtype; v_club_id uuid; v_join_code text;
begin
  if not is_super_admin() then
    raise exception 'Only a super admin can approve club creation.';
  end if;
  -- FOR UPDATE locks the row for the duration of this transaction so a
  -- concurrent second approve/reject call blocks until this one commits,
  -- then re-reads status='pending' and finds nothing — without this, two
  -- concurrent approvals could both pass the check and each insert a
  -- separate club for the same request (inserts below aren't idempotent).
  select * into v_req from club_creation_requests where id = p_request_id and status = 'pending' for update;
  if not found then
    raise exception 'Request not found or already resolved.';
  end if;
  v_join_code := upper(substr(md5(random()::text), 1, 6));
  insert into clubs (name, logo_url, join_code, created_by)
  values (v_req.requested_name, v_req.requested_logo_url, v_join_code, v_req.user_id)
  returning id into v_club_id;
  insert into club_members (club_id, user_id, role, danger_zone_access)
  values (v_club_id, v_req.user_id, 'admin', true);
  update club_creation_requests set status = 'approved', resolved_at = now(), resolved_by = auth.uid()
  where id = p_request_id and status = 'pending';
  return v_club_id;
end;
$$;

create or replace function reject_club_creation_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_found boolean;
begin
  if not is_super_admin() then
    raise exception 'Only a super admin can reject club creation requests.';
  end if;
  update club_creation_requests set status = 'rejected', resolved_at = now(), resolved_by = auth.uid()
  where id = p_request_id and status = 'pending'
  returning true into v_found;
  if v_found is null then
    raise exception 'Request not found or already resolved.';
  end if;
end;
$$;
