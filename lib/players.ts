import { supabase } from './supabase';

export interface PlayerRow {
  id: string;
  club_id: string;
  user_id: string | null;
  name: string;
  nickname: string | null;
  photo_url: string | null;
  bio: string | null;
  elo_rating: number;
  games_played: number;
  created_at: string;
  equipped_badge_id: string | null;
  dominant_hand: 'right' | 'left' | 'ambidextrous' | null;
  paddle: string | null;
  playing_since_year: number | null;
  signature_shot: string | null;
  email?: string | null;
  dupr_id?: string | null;
  dupr_rating?: number | null;
  dupr_verified?: boolean;
}

export const MIN_GAMES_FOR_SKILL_RATING = 20;

export interface RatingInfo {
  rating: number;
  gamesPlayed: number;
}

// Fetches ratings for the given names, then fills in anyone unrated (not
// registered, or under MIN_GAMES_FOR_SKILL_RATING) with the pool median of
// players who do have enough games — so they don't skew the balance by
// being silently treated as some default like 1500.
export async function getSkillRatingsForNames(clubId: string, names: string[]): Promise<Map<string, number> | null> {
  const { data, error } = await supabase.from('players').select('name, elo_rating, games_played').eq('club_id', clubId).in('name', names);
  if (error || !data) return null;

  const rated = data.filter(p => p.games_played >= MIN_GAMES_FOR_SKILL_RATING);
  if (rated.length < 2) return null; // not enough signal to balance meaningfully

  const sorted = [...rated].sort((a, b) => a.elo_rating - b.elo_rating);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1].elo_rating + sorted[mid].elo_rating) / 2 : sorted[mid].elo_rating;

  const ratingByName = new Map(rated.map(p => [p.name, p.elo_rating]));
  return new Map(names.map(name => [name, ratingByName.get(name) ?? median]));
}

export async function listPlayers(clubId: string): Promise<PlayerRow[]> {
  const { data, error } = await supabase.from('players').select('*').eq('club_id', clubId).order('name', { ascending: true });
  if (error) throw error;
  return data as PlayerRow[];
}

const FOUNDING_FIVE_COUNT = 5;

// The first 5 player rows ever registered at this club, by created_at — for
// the "Founding Five" badge. A player row's created_at is when they first
// registered, not when the club itself was founded, so this is "among the
// first 5 to join" rather than literal club-founding membership.
export async function fetchFoundingFiveNames(clubId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('players')
    .select('name')
    .eq('club_id', clubId)
    .order('created_at', { ascending: true })
    .limit(FOUNDING_FIVE_COUNT);
  if (error) throw error;
  return new Set((data as { name: string }[]).map(p => p.name));
}

// For the single-club player profile page — looked up by the players.id
// roster/leaderboard rows already carry, not by user_id.
export async function getPlayerById(clubId: string, playerId: string): Promise<PlayerRow | null> {
  const { data, error } = await supabase.from('players').select('*').eq('club_id', clubId).eq('id', playerId).maybeSingle();
  if (error) throw error;
  return data as PlayerRow | null;
}

// A user_id can now have one player row per club (unique per club_id+user_id,
// not globally) — so "my player" only makes sense scoped to a specific club.
export async function getOwnPlayer(clubId: string, userId: string): Promise<PlayerRow | null> {
  const { data, error } = await supabase.from('players').select('*').eq('club_id', clubId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as PlayerRow | null;
}

export interface UpsertPlayerOptions {
  clubId: string;
  userId: string;
  name: string;
  nickname: string | null;
  photoUrl: string | null;
  bio: string | null;
  dominantHand?: 'right' | 'left' | 'ambidextrous' | null;
  paddle?: string | null;
  playingSinceYear?: number | null;
  signatureShot?: string | null;
}

export async function setEquippedBadge(playerId: string, badgeId: string | null): Promise<void> {
  const { error } = await supabase.from('players').update({ equipped_badge_id: badgeId }).eq('id', playerId);
  if (error) throw error;
}

export async function upsertOwnPlayer(options: UpsertPlayerOptions): Promise<void> {
  const { error } = await supabase.from('players').upsert(
    {
      club_id: options.clubId,
      user_id: options.userId,
      name: options.name,
      nickname: options.nickname,
      photo_url: options.photoUrl,
      bio: options.bio,
      dominant_hand: options.dominantHand ?? null,
      paddle: options.paddle ?? null,
      playing_since_year: options.playingSinceYear ?? null,
      signature_shot: options.signatureShot ?? null,
    },
    { onConflict: 'club_id,user_id' }
  );
  if (error) throw error;
}
