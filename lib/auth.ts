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

// True if the signed-in user is that specific club's admin. Not a
// client-side trust boundary by itself — every write that matters is also
// gated by club-scoped RLS policies at the DB level (via is_club_admin()),
// so this is just for showing/hiding admin UI, not the actual security check.
export async function isCurrentUserAdmin(clubId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}
