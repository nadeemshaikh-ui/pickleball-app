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
  description: string | null;
  default_dupr_rated?: boolean;
  dupr_club_id?: string | null;
  dupr_connected?: boolean;
}

export async function updateClubDuprSettings(clubId: string, defaultDuprRated: boolean, duprClubId: string | null): Promise<void> {
  const { error } = await supabase
    .from('clubs')
    .update({
      default_dupr_rated: defaultDuprRated,
      dupr_club_id: duprClubId?.trim() || null,
      dupr_connected: !!duprClubId?.trim(),
    })
    .eq('id', clubId);
  if (error) throw error;
}

// Name + logo only — for the branded header stamped onto every shared
// session/league image (see components/ShareBrandedHeader.tsx), not a full
// club record fetch.
export async function getClubBranding(clubId: string): Promise<{ name: string; logo_url: string | null } | null> {
  const { data, error } = await supabase.from('clubs').select('name, logo_url').eq('id', clubId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getClubById(clubId: string): Promise<ClubRow | null> {
  const { data, error } = await supabase.from('clubs').select('*').eq('id', clubId).maybeSingle();
  if (error) throw error;
  return data as ClubRow | null;
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

// Super-admin-only at the DB level. Permanently removes the club itself
// (not just its session/stat data — see resetClubData for that) along with
// its roster and everything that references it. Used from the super admin
// console to clear out test/dummy clubs.
export async function deleteClub(clubId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_club', { target_club_id: clubId });
  if (error) throw error;
}

export async function updateClubUpiVpa(clubId: string, upiVpa: string | null): Promise<void> {
  const { error } = await supabase.from('clubs').update({ upi_vpa: upiVpa }).eq('id', clubId);
  if (error) throw error;
}

export async function updateClubDescription(clubId: string, description: string | null): Promise<void> {
  const { error } = await supabase.from('clubs').update({ description }).eq('id', clubId);
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

export interface JoinRequestProfile {
  name: string;
  nickname: string | null;
  photoUrl: string | null;
  bio: string | null;
  dominantHand: 'right' | 'left' | 'ambidextrous' | null;
  paddle: string | null;
  playingSinceYear: number | null;
  signatureShot: string | null;
}

export interface JoinRequestRow {
  id: string;
  club_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  resolved_at: string | null;
  name: string | null;
  nickname: string | null;
  photo_url: string | null;
  bio: string | null;
  dominant_hand: 'right' | 'left' | 'ambidextrous' | null;
  paddle: string | null;
  playing_since_year: number | null;
  signature_shot: string | null;
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
    .select('club_id, role, club:clubs(id, name, logo_url, logo_url_2, join_code, created_by, created_at, upi_vpa, description)')
    .eq('user_id', userData.user.id)
    .is('removed_at', null);
  if (error) throw error;
  const rows = data as unknown as { club_id: string; role: 'admin' | 'member'; club: ClubRow }[];
  // Deterministic order (admin clubs first, then alphabetical) — Postgres
  // gives no ordering guarantee here, and useCurrentClub() falls back to
  // memberships[0] for a fresh sign-in with nothing saved yet, so an
  // unordered result could hand a multi-club admin a random starting club.
  rows.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
    return a.club.name.localeCompare(b.club.name);
  });
  return rows.map(r => ({
    club_id: r.club_id,
    role: r.role,
    club: r.club,
  }));
}

export type CreateClubResult = { status: 'created'; club: ClubRow } | { status: 'pending_approval' };

// A signed-in user's first-ever club is created instantly via the
// create_own_club RPC; a 2nd+ club from the same account is queued for
// super-admin approval instead (see club_creation_requests). The RPC
// derives the "already has a club?" check and the actual inserts
// server-side so this can't be bypassed from the client.
export async function createClub(name: string, logoFile: File | null): Promise<CreateClubResult> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Must be signed in to create a club.');
  const logoUrl = logoFile ? await uploadClubLogo(logoFile) : null;
  const joinCode = randomJoinCode();

  const { data, error } = await supabase.rpc('create_own_club', { p_name: name, p_logo_url: logoUrl, p_join_code: joinCode });
  if (error) throw error;

  if (data.status === 'pending_approval') return { status: 'pending_approval' };

  const { data: club, error: fetchError } = await supabase.from('clubs').select('*').eq('id', data.club_id).single();
  if (fetchError) throw fetchError;
  return { status: 'created', club: club as ClubRow };
}

export interface ClubCreationRequestRow {
  id: string;
  user_id: string;
  requested_name: string;
  requested_logo_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  resolved_at: string | null;
}

export async function listMyPendingClubCreationRequests(): Promise<ClubCreationRequestRow[]> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return [];
  const { data, error } = await supabase
    .from('club_creation_requests')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });
  if (error) throw error;
  return data as ClubCreationRequestRow[];
}

// Super-admin only at the DB level (RLS) — every club creation request
// across the whole platform, not just the caller's own.
export async function listPendingClubCreationRequests(): Promise<ClubCreationRequestRow[]> {
  const { data, error } = await supabase
    .from('club_creation_requests')
    .select('*')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });
  if (error) throw error;
  return data as ClubCreationRequestRow[];
}

export async function approveClubCreationRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_club_creation_request', { p_request_id: requestId });
  if (error) throw error;
}

export async function rejectClubCreationRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_club_creation_request', { p_request_id: requestId });
  if (error) throw error;
}

export const PENDING_JOIN_CODE_KEY = 'pickleball-pending-join-code';

export function formatEmailName(email: string): string {
  if (!email || !email.includes('@')) return 'Player';
  const local = email.split('@')[0];
  const cleaned = local.replace(/[._+]/g, ' ').replace(/\d+$/g, '');
  const capitalized = cleaned
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return capitalized.trim() || local;
}

export function resolveMemberDisplayName(m: { player_name?: string | null; google_name?: string | null; email?: string | null }): string {
  if (m.player_name && m.player_name !== 'Player' && m.player_name !== 'Unnamed player' && m.player_name.trim().length > 0) {
    return m.player_name.trim();
  }
  if (m.google_name && m.google_name.trim().length > 0) {
    return m.google_name.trim();
  }
  if (m.email && m.email.includes('@')) {
    return formatEmailName(m.email);
  }
  return 'Member';
}

export async function joinClubByCode(code: string): Promise<ClubRow> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Must be signed in to join a club.');
  if (user.is_anonymous) throw new Error('Guest users cannot join a club. Please sign in with Google.');
  const { data: club, error } = await supabase.from('clubs').select('*').eq('join_code', code.trim().toUpperCase()).maybeSingle();
  if (error) throw error;
  if (!club) throw new Error('No club found with that code.');

  const { error: memberError } = await supabase.from('club_members').insert({ club_id: club.id, user_id: user.id, role: 'member' });
  if (memberError && memberError.code !== '23505') {
    throw memberError;
  }

  // Automatically create/upsert a player profile for this club using Google Auth metadata or email
  const googleName = user.user_metadata?.full_name || user.user_metadata?.name;
  const bestName = googleName && googleName.trim().length > 0
    ? googleName.trim()
    : (user.email ? formatEmailName(user.email) : 'Member');
  const googlePhoto = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

  const { data: existingPlayer } = await supabase
    .from('players')
    .select('id, name')
    .eq('club_id', club.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existingPlayer) {
    // Check if an admin manually created an unlinked player row with a matching name
    const { data: unlinkedMatch } = await supabase
      .from('players')
      .select('id, name')
      .eq('club_id', club.id)
      .is('user_id', null)
      .ilike('name', `%${bestName.split(' ')[0]}%`)
      .maybeSingle();

    if (unlinkedMatch) {
      // Auto-link existing manual player record to this authenticated user
      await supabase
        .from('players')
        .update({ user_id: user.id, photo_url: googlePhoto })
        .eq('id', unlinkedMatch.id);
    } else {
      await supabase.from('players').upsert(
        {
          club_id: club.id,
          user_id: user.id,
          name: bestName,
          photo_url: googlePhoto,
        },
        { onConflict: 'club_id,user_id' }
      );
    }
  }

  return club as ClubRow;
}

export async function checkAndExecutePendingJoinCode(userId: string): Promise<ClubRow | null> {
  if (typeof window === 'undefined') return null;
  const user = (await supabase.auth.getUser()).data.user;
  if (!user || user.is_anonymous) return null;

  const pendingCode = sessionStorage.getItem(PENDING_JOIN_CODE_KEY);
  if (!pendingCode) return null;

  try {
    const club = await joinClubByCode(pendingCode);
    sessionStorage.removeItem(PENDING_JOIN_CODE_KEY);
    const { markOnboardingComplete } = await import('./onboarding');
    await markOnboardingComplete(userId);
    return club;
  } catch {
    sessionStorage.removeItem(PENDING_JOIN_CODE_KEY);
    return null;
  }
}

export async function searchClubsByName(query: string): Promise<ClubRow[]> {
  if (query.trim().length < 2) return [];
  const { data, error } = await supabase.from('clubs').select('*').ilike('name', `%${query.trim()}%`).limit(10);
  if (error) throw error;
  return data as ClubRow[];
}

// Profile is collected before the request is sent (see ProfileStep's
// onSubmit mode) and staged on the request row itself — players rows are
// club-scoped and a pending requester isn't a member yet, so there's
// nowhere else to put it. approve_join_request() materializes it into a
// real players row once an admin approves.
//
// Via RPC, not a direct client upsert: club_join_requests only grants
// self-INSERT via RLS (no self-UPDATE), and carries a UNIQUE (club_id,
// user_id) constraint with no pending-only scoping, so a plain insert can
// never resubmit after a rejection or refresh a resubmission's profile —
// it just silently 23505s. request_to_join_club() does the upsert
// server-side, refusing to clobber an already-approved row back to pending.
export async function requestToJoinClub(clubId: string, profile: JoinRequestProfile): Promise<void> {
  const { error } = await supabase.rpc('request_to_join_club', {
    p_club_id: clubId,
    p_name: profile.name,
    p_nickname: profile.nickname,
    p_photo_url: profile.photoUrl,
    p_bio: profile.bio,
    p_dominant_hand: profile.dominantHand,
    p_paddle: profile.paddle,
    p_playing_since_year: profile.playingSinceYear,
    p_signature_shot: profile.signatureShot,
  });
  if (error) throw error;

  // Auto-approve request immediately to remove admin approval bottlenecks
  const user = (await supabase.auth.getUser()).data.user;
  if (user) {
    const { data: req } = await supabase
      .from('club_join_requests')
      .select('id')
      .eq('club_id', clubId)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (req) {
      await supabase.rpc('approve_join_request', { p_request_id: req.id });
    }
  }
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

export interface SuperAdminJoinRequestRow extends JoinRequestRow {
  club_name: string;
}

// Super-admin-only in practice (RLS — see "join_requests super admin read"),
// no clubId filter. Mirrors listPendingClubCreationRequests so the console
// can show every club's pending join requests in one place instead of an
// admin having to know to check each club's own Settings page.
export async function listAllPendingJoinRequestsForSuperAdmin(): Promise<SuperAdminJoinRequestRow[]> {
  const { data, error } = await supabase
    .from('club_join_requests')
    .select('*, clubs(name)')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });
  if (error) throw error;
  return (data as (JoinRequestRow & { clubs: { name: string } | null })[]).map(r => ({ ...r, club_name: r.clubs?.name ?? 'Unknown club' }));
}

// Admin-only at the DB level (RLS + a raise inside the function itself).
// approve_join_request materializes the staged profile into a real players
// row and adds the membership row in one transaction; reject just marks the
// request resolved. Replaces the old direct-update resolveJoinRequest.
export async function approveJoinRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_join_request', { p_request_id: requestId });
  if (error) throw error;
}

export async function rejectJoinRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_join_request', { p_request_id: requestId });
  if (error) throw error;
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
  removed_at: string | null;
  removed_by: string | null;
  email?: string | null;
  google_name?: string | null;
  player_name?: string | null;
  player_id?: string | null;
  photo_url?: string | null;
}

export async function listClubMembers(clubId: string): Promise<ClubMemberRow[]> {
  const { data, error } = await supabase.rpc('get_club_members_info', { p_club_id: clubId });
  if (error) {
    const { data: raw, error: rawErr } = await supabase
      .from('club_members')
      .select('user_id, role, joined_at, danger_zone_access, removed_at, removed_by')
      .eq('club_id', clubId)
      .order('joined_at');
    if (rawErr) throw rawErr;
    return raw as ClubMemberRow[];
  }
  return data as ClubMemberRow[];
}

// Admin-only at the DB level (RLS + a raise inside the function itself).
// Revokes access (is_club_member/is_club_admin both exclude removed rows)
// without deleting the member's players row or any match history — their
// stats stay intact as history, just off the active roster/leaderboard.
export async function removeMember(clubId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_club_member', { p_club_id: clubId, p_target_user_id: userId });
  if (error) throw error;
}

export async function permanentlyDeleteMember(clubId: string, userId: string): Promise<void> {
  // Delete member from club_members and players table
  const { error: cmErr } = await supabase.from('club_members').delete().eq('club_id', clubId).eq('user_id', userId);
  if (cmErr) throw cmErr;
  const { error: pErr } = await supabase.from('players').delete().eq('club_id', clubId).eq('user_id', userId);
  if (pErr) throw pErr;
}

export async function restoreMember(clubId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_club_member', { p_club_id: clubId, p_target_user_id: userId });
  if (error) throw error;
}

// The leaderboard/crown-board matviews are untracked (live-only) and keyed
// by player name, not user_id — rather than editing them blind, removed
// members are stripped from active rankings client-side by name. Their
// history stays reachable via their player profile page and match history.
export async function fetchRemovedMemberNames(clubId: string): Promise<Set<string>> {
  const [{ data: removed, error: removedError }, { data: players, error: playersError }] = await Promise.all([
    supabase.from('club_members').select('user_id').eq('club_id', clubId).not('removed_at', 'is', null),
    supabase.from('players').select('user_id, name').eq('club_id', clubId),
  ]);
  if (removedError) throw removedError;
  if (playersError) throw playersError;
  const removedUserIds = new Set((removed ?? []).map(m => m.user_id));
  return new Set((players ?? []).filter(p => p.user_id && removedUserIds.has(p.user_id)).map(p => p.name));
}

export async function setDangerZoneAccess(clubId: string, userId: string, access: boolean): Promise<void> {
  const { error } = await supabase
    .from('club_members')
    .update({ danger_zone_access: access })
    .eq('club_id', clubId)
    .eq('user_id', userId);
  if (error) throw error;
}

// Promote/demote between 'admin' and 'member'. Callers are responsible for
// not demoting a club's last remaining admin (checked client-side, same as
// every other member-management action here) — the DB doesn't enforce a
// minimum-admin-count invariant.
export async function setMemberRole(clubId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
  const { error } = await supabase
    .from('club_members')
    .update({ role })
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
    supabase.from('club_members').select('club_id').is('removed_at', null),
  ]);
  if (clubsError) throw clubsError;
  if (membersError) throw membersError;
  const counts = new Map<string, number>();
  for (const m of members ?? []) counts.set(m.club_id, (counts.get(m.club_id) ?? 0) + 1);
  return (clubs as ClubRow[]).map(c => ({ ...c, member_count: counts.get(c.id) ?? 0 }));
}
