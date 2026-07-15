import { supabase } from './supabase';

export interface AppErrorRow {
  id: string;
  club_id: string | null;
  user_id: string | null;
  message: string;
  stack: string | null;
  path: string | null;
  created_at: string;
}

// Fire-and-forget by design — a logging call that can itself throw (e.g. if
// the network's down, which is often exactly when errors spike) must never
// become a second error. Swallows its own failure.
export async function logClientError(args: { clubId: string | null; userId: string | null; message: string; stack?: string; path: string }): Promise<void> {
  try {
    await supabase.from('app_error_log').insert({
      club_id: args.clubId,
      user_id: args.userId,
      message: args.message.slice(0, 2000),
      stack: args.stack?.slice(0, 4000) ?? null,
      path: args.path,
    });
  } catch {
    // Never let logging itself throw.
  }
}

const RECENT_LIMIT = 50;

export async function fetchRecentErrorsForClub(clubId: string): Promise<AppErrorRow[]> {
  const { data, error } = await supabase
    .from('app_error_log')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT);
  if (error) throw error;
  return data as AppErrorRow[];
}

// Super-admin-only in practice (RLS) — no club_id filter, relies on
// is_super_admin() to widen visibility to every club at once.
export async function fetchRecentErrorsAllClubs(): Promise<AppErrorRow[]> {
  const { data, error } = await supabase.from('app_error_log').select('*').order('created_at', { ascending: false }).limit(RECENT_LIMIT);
  if (error) throw error;
  return data as AppErrorRow[];
}
