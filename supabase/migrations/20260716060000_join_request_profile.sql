-- A pending join request previously carried only club_id/user_id, so the
-- admin approval screen could never show who was asking (no name, no
-- photo — the query had nothing to show, this wasn't a rendering bug).
-- Profile fields are now collected before the request is sent (players
-- rows are club-scoped and a pending requester isn't a member yet, so the
-- profile is staged directly on the request row itself rather than in a
-- separate table) and materialized into a real players row on approval.
alter table club_join_requests add column name               text;
alter table club_join_requests add column nickname            text;
alter table club_join_requests add column photo_url           text;
alter table club_join_requests add column bio                 text;
alter table club_join_requests add column dominant_hand       text;
alter table club_join_requests add column paddle              text;
alter table club_join_requests add column playing_since_year  int;
alter table club_join_requests add column signature_shot      text;

-- club_join_requests only grants self-INSERT (no self-UPDATE) RLS-wise, and
-- carries a UNIQUE (club_id, user_id) constraint with no pending-only
-- scoping — a plain client insert can never resubmit after a rejection or
-- refresh a resubmission's profile, it just 23505s. This RPC does the
-- upsert server-side (bypassing RLS as SECURITY DEFINER) and refuses to
-- clobber a row that's already 'approved' back to pending.
create or replace function request_to_join_club(
  p_club_id uuid, p_name text, p_nickname text, p_photo_url text, p_bio text,
  p_dominant_hand text, p_paddle text, p_playing_since_year int, p_signature_shot text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Name is required.';
  end if;
  insert into club_join_requests (club_id, user_id, status, requested_at, resolved_at, name, nickname, photo_url, bio, dominant_hand, paddle, playing_since_year, signature_shot)
  values (p_club_id, auth.uid(), 'pending', now(), null, p_name, p_nickname, p_photo_url, p_bio, p_dominant_hand, p_paddle, p_playing_since_year, p_signature_shot)
  on conflict (club_id, user_id) do update set
    status = 'pending', requested_at = now(), resolved_at = null,
    name = excluded.name, nickname = excluded.nickname, photo_url = excluded.photo_url, bio = excluded.bio,
    dominant_hand = excluded.dominant_hand, paddle = excluded.paddle,
    playing_since_year = excluded.playing_since_year, signature_shot = excluded.signature_shot
  where club_join_requests.status <> 'approved';
end;
$$;

create or replace function approve_join_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_req club_join_requests%rowtype;
begin
  select * into v_req from club_join_requests where id = p_request_id and status = 'pending';
  if not found then
    raise exception 'Request not found or already resolved.';
  end if;
  if not is_club_admin(v_req.club_id) then
    raise exception 'Only a club admin can approve join requests.';
  end if;
  if v_req.name is null or btrim(v_req.name) = '' then
    raise exception 'This request has no profile — ask the requester to resubmit their join request.';
  end if;

  insert into players (club_id, user_id, name, nickname, photo_url, bio, dominant_hand, paddle, playing_since_year, signature_shot)
  values (v_req.club_id, v_req.user_id, v_req.name, v_req.nickname, v_req.photo_url, v_req.bio, v_req.dominant_hand, v_req.paddle, v_req.playing_since_year, v_req.signature_shot)
  on conflict (club_id, user_id) do update set
    name = excluded.name,
    nickname = excluded.nickname,
    photo_url = excluded.photo_url,
    bio = excluded.bio,
    dominant_hand = excluded.dominant_hand,
    paddle = excluded.paddle,
    playing_since_year = excluded.playing_since_year,
    signature_shot = excluded.signature_shot;

  insert into club_members (club_id, user_id, role, danger_zone_access)
  values (v_req.club_id, v_req.user_id, 'member', false)
  on conflict (club_id, user_id) do nothing;

  update club_join_requests set status = 'approved', resolved_at = now() where id = p_request_id;
end;
$$;

create or replace function reject_join_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_club_id uuid;
begin
  select club_id into v_club_id from club_join_requests where id = p_request_id and status = 'pending';
  if v_club_id is null then
    raise exception 'Request not found or already resolved.';
  end if;
  if not is_club_admin(v_club_id) then
    raise exception 'Only a club admin can reject join requests.';
  end if;
  update club_join_requests set status = 'rejected', resolved_at = now() where id = p_request_id;
end;
$$;
