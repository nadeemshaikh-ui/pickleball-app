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

// The e2e suite runs against this same Supabase project (see
// e2e/setup/create-test-session.mjs) and leaves real rows behind — session
// ids literally prefixed "e2e-" and club ids using the 0000...000eN
// placeholder scheme. Flagging these lets the super-admin console separate
// real user-facing errors from test-run noise instead of drowning one in
// the other.
export function isTestArtifactError(row: Pick<AppErrorRow, 'path'>): boolean {
  return /e2e-|0{8}-0{4}-0{4}-0{4}-0{11}/.test(row.path ?? '');
}

// Plain-English cause for the handful of error strings that show up
// repeatedly, so a non-engineer glancing at this list knows whether it's
// actionable — not a general-purpose diagnosis engine, just the known
// recurring ones.
export function explainError(message: string): string | null {
  if (message.includes('Cannot coerce the result to a single JSON object')) {
    return 'A lookup expected exactly one row (e.g. one session or club) and found zero or more than one — usually means the record was deleted or never existed.';
  }
  if (message.includes('Auth session missing')) {
    return "The visitor wasn't signed in when this page tried to load their session.";
  }
  if (message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('networkerror')) {
    return "The visitor's connection dropped mid-request — usually transient, not a code bug.";
  }
  return null;
}
