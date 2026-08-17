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

// Silent, formless entry point for circles/guest mode — gives a real
// auth.uid() (so RLS on circles/sessions/rounds works unmodified) without a
// Google prompt. Device-scoped: a fresh browser/device gets a different
// anon identity, so this does not by itself carry a person across devices —
// linkGoogleIdentity is what makes an identity portable.
export async function signInAnonymously(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

// Upgrades the CURRENT auth.uid() in place by attaching a Google identity —
// does not create a new user, so every circle/session/round row already
// owned by this anon uid stays owned by it after linking. This is the only
// way an anonymous user's data survives losing the device/browser session.
export async function linkGoogleIdentity(redirectTo?: string): Promise<void> {
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: redirectTo ?? window.location.href },
  });
  if (error) throw error;
}

export function isAnonymousUser(user: User | null): boolean {
  return Boolean(user?.is_anonymous);
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
    .is('removed_at', null)
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}
