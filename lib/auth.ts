import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export async function signInWithGoogle(redirectTo?: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectTo ?? window.location.href },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

// True if the signed-in user is a seeded admin. Not a client-side trust
// boundary by itself — every write that matters is also gated by the
// "players self or admin update" RLS policy at the DB level, so this is
// just for showing/hiding admin UI, not the actual security check.
export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error) return false;
  return Boolean(data);
}
