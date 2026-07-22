-- circles has no "public read by join_code" policy (unlike clubs, which is
-- world-readable) — "circles member read" only allows a member to see a
-- circle. So joining by code needs a SECURITY DEFINER function to look the
-- circle up and insert the membership row in one step, bypassing the
-- member-only SELECT policy just for this narrow lookup.
create or replace function join_circle_by_code(p_join_code text) returns uuid
language plpgsql security definer set search_path = 'public' as $$
declare
  v_circle_id uuid;
begin
  select id into v_circle_id from circles where join_code = p_join_code;
  if v_circle_id is null then
    return null;
  end if;

  insert into circle_members (circle_id, user_id)
  values (v_circle_id, auth.uid())
  on conflict (circle_id, user_id) do nothing;

  return v_circle_id;
end;
$$;
