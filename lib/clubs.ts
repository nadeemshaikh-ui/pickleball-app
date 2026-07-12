import { supabase } from './supabase';

export interface ClubRow {
  id: string;
  name: string;
  logo_url: string | null;
  logo_url_2: string | null;
  join_code: string;
  created_by: string;
  created_at: string;
  upi_vpa: string | null;
}

// Admin-only at the DB level (RLS + a raise inside the function itself).
// Deletes every session/round/dues/confirmation/challenge/streak-record/
// badge-holder-history row for this club and resets each player's elo/games
// back to default — the roster itself (names, photos) survives. Does not
// touch the ladder (the separate "Reset Ladder" button owns that) or other
// clubs' data.
export async function resetClubData(clubId: string): Promise<void> {
  const { error } = await supabase.rpc('reset_club_data', { target_club_id: clubId });
  if (error) throw error;
}

export async function updateClubUpiVpa(clubId: string, upiVpa: string | null): Promise<void> {
  const { error } = await supabase.from('clubs').update({ upi_vpa: upiVpa }).eq('id', clubId);
  if (error) throw error;
}

export async function getClubUpiVpa(clubId: string): Promise<string | null> {
  const { data, error } = await supabase.from('clubs').select('upi_vpa').eq('id', clubId).maybeSingle();
  if (error) throw error;
  return data?.upi_vpa ?? null;
}

export interface ClubMembership {
  club_id: string;
  role: 'admin' | 'member';
  club: ClubRow;
}

export interface JoinRequestRow {
  id: string;
  club_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  resolved_at: string | null;
}

function randomJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — easy to read aloud
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

async function uploadClubLogo(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Logo must be an image file.');
  if (file.size > MAX_LOGO_BYTES) throw new Error('Logo must be under 5MB.');
  const dotIndex = file.name.lastIndexOf('.');
  const ext = dotIndex > 0 ? file.name.slice(dotIndex + 1) : 'png';
  const path = `${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('club-logos').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('club-logos').getPublicUrl(path);
  return data.publicUrl;
}

// Every club the signed-in user belongs to, plus their role in each.
// SECURITY: must filter by the caller's own user_id. club_members' SELECT
// RLS policy is is_club_member(club_id) — any member of a club can see
// EVERY membership row for that club (needed elsewhere for the member-count
// feature), not just their own. Without this filter, a plain member's own
// admin-or-not status here depends on which row Postgres happens to return
// first among the club's members — real, previously-shipped bug: a member
// could non-deterministically be treated as admin (full Club Settings
// access, including editing branding) depending on row ordering luck. Found
// via this session's E2E permission-boundary spec, not by inspection.
export async function listMyClubs(): Promise<ClubMembership[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from('club_members')
    .select('club_id, role, club:clubs(id, name, logo_url, logo_url_2, join_code, created_by, created_at, upi_vpa)')
    .eq('user_id', userData.user.id);
  if (error) throw error;
  return (data as unknown as { club_id: string; role: 'admin' | 'member'; club: ClubRow }[]).map(r => ({
    club_id: r.club_id,
    role: r.role,
    club: r.club,
  }));
}

// Creates the club, then self-inserts the creator as its admin — the two
// inserts are separate calls (not a transaction) because the second one's
// RLS check depends on clubs.created_by already being visible, which it is
// once the first insert commits under autocommit.
export async function createClub(name: string, logoFile: File | null): Promise<ClubRow> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Must be signed in to create a club.');
  const logoUrl = logoFile ? await uploadClubLogo(logoFile) : null;

  const { data: club, error } = await supabase
    .from('clubs')
    .insert({ name, logo_url: logoUrl, join_code: randomJoinCode(), created_by: user.id })
    .select()
    .single();
  if (error) throw error;

  const { error: memberError } = await supabase
    .from('club_members')
    .insert({ club_id: club.id, user_id: user.id, role: 'admin', danger_zone_access: true });
  if (memberError) throw memberError;

  return club as ClubRow;
}

// Joining by code is instant — no admin approval needed, matches "anyone
// who has the code" trust level of a shared invite link.
export async function joinClubByCode(code: string): Promise<ClubRow> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Must be signed in to join a club.');
  const { data: club, error } = await supabase.from('clubs').select('*').eq('join_code', code.trim().toUpperCase()).maybeSingle();
  if (error) throw error;
  if (!club) throw new Error('No club found with that code.');

  const { error: memberError } = await supabase.from('club_members').insert({ club_id: club.id, user_id: user.id, role: 'member' });
  if (memberError) {
    if (memberError.code === '23505') return club as ClubRow; // already a member — not an error
    throw memberError;
  }
  return club as ClubRow;
}

export async function searchClubsByName(query: string): Promise<ClubRow[]> {
  if (query.trim().length < 2) return [];
  const { data, error } = await supabase.from('clubs').select('*').ilike('name', `%${query.trim()}%`).limit(10);
  if (error) throw error;
  return data as ClubRow[];
}

export async function requestToJoinClub(clubId: string): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Must be signed in to request to join a club.');
  const { error } = await supabase.from('club_join_requests').insert({ club_id: clubId, user_id: user.id });
  if (error && error.code !== '23505') throw error; // duplicate request is a silent no-op, not an error
}

// The requester's own view of their pending requests — powers the
// "your request is pending" banner instead of leaving them stuck with no
// club after requesting to join.
export async function listMyPendingJoinRequests(): Promise<(JoinRequestRow & { club: ClubRow })[]> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return [];
  const { data, error } = await supabase
    .from('club_join_requests')
    .select('*, club:clubs(*)')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });
  if (error) throw error;
  return data as unknown as (JoinRequestRow & { club: ClubRow })[];
}

export async function listPendingJoinRequests(clubId: string): Promise<JoinRequestRow[]> {
  const { data, error } = await supabase
    .from('club_join_requests')
    .select('*')
    .eq('club_id', clubId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });
  if (error) throw error;
  return data as JoinRequestRow[];
}

// Admin-only at the DB level (RLS) — approving also adds the membership row;
// rejecting just marks the request resolved.
export async function resolveJoinRequest(request: JoinRequestRow, decision: 'approved' | 'rejected'): Promise<void> {
  const { error } = await supabase
    .from('club_join_requests')
    .update({ status: decision, resolved_at: new Date().toISOString() })
    .eq('id', request.id);
  if (error) throw error;

  if (decision === 'approved') {
    const { error: memberError } = await supabase
      .from('club_members')
      .insert({ club_id: request.club_id, user_id: request.user_id, role: 'member' });
    if (memberError && memberError.code !== '23505') throw memberError;
  }
}

export async function updateClubBranding(clubId: string, name: string, logoFile: File | null, logoFile2: File | null = null): Promise<void> {
  const [logoUrl, logoUrl2] = await Promise.all([
    logoFile ? uploadClubLogo(logoFile) : Promise.resolve(undefined),
    logoFile2 ? uploadClubLogo(logoFile2) : Promise.resolve(undefined),
  ]);
  const update: { name: string; logo_url?: string; logo_url_2?: string } = { name };
  if (logoUrl) update.logo_url = logoUrl;
  if (logoUrl2) update.logo_url_2 = logoUrl2;
  const { error } = await supabase.from('clubs').update(update).eq('id', clubId);
  if (error) throw error;
}

export interface ClubMemberRow {
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  danger_zone_access: boolean;
}

export async function listClubMembers(clubId: string): Promise<ClubMemberRow[]> {
  const { data, error } = await supabase
    .from('club_members')
    .select('user_id, role, joined_at, danger_zone_access')
    .eq('club_id', clubId)
    .order('joined_at');
  if (error) throw error;
  return data;
}

export async function setDangerZoneAccess(clubId: string, userId: string, access: boolean): Promise<void> {
  const { error } = await supabase
    .from('club_members')
    .update({ danger_zone_access: access })
    .eq('club_id', clubId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function isSuperAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_super_admin');
  if (error) throw error;
  return data === true;
}

export interface SuperAdminClubRow extends ClubRow {
  member_count: number;
}

// Relies on the super-admin RLS carve-out on `clubs`/`club_members` — a
// normal member would only see their own club_members rows here.
export async function listAllClubsForSuperAdmin(): Promise<SuperAdminClubRow[]> {
  const [{ data: clubs, error: clubsError }, { data: members, error: membersError }] = await Promise.all([
    supabase.from('clubs').select('*').order('created_at'),
    supabase.from('club_members').select('club_id'),
  ]);
  if (clubsError) throw clubsError;
  if (membersError) throw membersError;
  const counts = new Map<string, number>();
  for (const m of members ?? []) counts.set(m.club_id, (counts.get(m.club_id) ?? 0) + 1);
  return (clubs as ClubRow[]).map(c => ({ ...c, member_count: counts.get(c.id) ?? 0 }));
}
