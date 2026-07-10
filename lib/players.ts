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
    },
    { onConflict: 'club_id,user_id' }
  );
  if (error) throw error;
}
