import { supabase } from './supabase';

export interface CircleRow {
  id: string;
  name: string;
  join_code: string;
  created_by: string;
  created_at: string;
}

export interface CircleMembership {
  circle_id: string;
  joined_at: string;
  circle: CircleRow;
}

// Mirrors listMyClubs() in lib/clubs.ts, minus role — circles have no admin
// tier by design (see 20260723000000_circles_schema.sql). Order is
// deterministic (newest-joined first) for the same reason club order is
// pinned: useCurrentGroup falls back to memberships[0] for a fresh visitor
// with nothing saved yet.
export async function listMyCircles(): Promise<CircleMembership[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from('circle_members')
    .select('circle_id, joined_at, circle:circles(id, name, join_code, created_by, created_at)')
    .eq('user_id', userData.user.id)
    .order('joined_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as CircleMembership[]) ?? [];
}

function randomJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — easy to read aloud
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Creates the circle and adds the creator as a member in one go — a circle
// with zero members would be permanently invisible to its own creator under
// the "circles member read" RLS policy (is_circle_member(id)).
export async function createCircle(name: string): Promise<CircleRow> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Must be signed in to create a circle.');

  const { data: circle, error } = await supabase
    .from('circles')
    .insert({ name: name.trim(), created_by: user.id, join_code: randomJoinCode() })
    .select('*')
    .single();
  if (error) throw error;

  const { error: memberError } = await supabase
    .from('circle_members')
    .insert({ circle_id: circle.id, user_id: user.id });
  if (memberError) throw memberError;

  return circle as CircleRow;
}

// Joining is instant, no approval — matches "anyone who has the code" trust
// level of a shared invite link (same as joinClubByCode in lib/clubs.ts).
// The circle row itself isn't SELECT-able by a non-member (RLS), so the
// join_code lookup has to go through a SECURITY DEFINER RPC rather than a
// plain client select — mirrors clubs' pattern, but clubs.id is world-
// readable while circles.id is not, hence the RPC instead of a direct query.
export async function joinCircleByCode(code: string): Promise<CircleRow> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Must be signed in to join a circle.');

  const { data: circleId, error } = await supabase.rpc('join_circle_by_code', {
    p_join_code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  if (!circleId) throw new Error('No circle found with that code.');

  const { data: circle, error: fetchError } = await supabase.from('circles').select('*').eq('id', circleId).single();
  if (fetchError) throw fetchError;
  return circle as CircleRow;
}
