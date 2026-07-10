import { supabase } from './supabase';

export interface PlayerRow {
  id: string;
  user_id: string | null;
  name: string;
  nickname: string | null;
  photo_url: string | null;
  bio: string | null;
  elo_rating: number;
  games_played: number;
  created_at: string;
}

export async function listPlayers(): Promise<PlayerRow[]> {
  const { data, error } = await supabase.from('players').select('*').order('name', { ascending: true });
  if (error) throw error;
  return data as PlayerRow[];
}

export async function getOwnPlayer(userId: string): Promise<PlayerRow | null> {
  const { data, error } = await supabase.from('players').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as PlayerRow | null;
}

export interface UpsertPlayerOptions {
  userId: string;
  name: string;
  nickname: string | null;
  photoUrl: string | null;
  bio: string | null;
}

export async function upsertOwnPlayer(options: UpsertPlayerOptions): Promise<void> {
  const { error } = await supabase.from('players').upsert(
    {
      user_id: options.userId,
      name: options.name,
      nickname: options.nickname,
      photo_url: options.photoUrl,
      bio: options.bio,
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}
