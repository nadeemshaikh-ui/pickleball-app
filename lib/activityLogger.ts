import { supabase } from './supabase';

export interface ActivityLogRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  club_id: string | null;
  path: string;
  action: string;
  metadata: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export async function logActivity(opts: {
  path: string;
  action?: string;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  clubId?: string | null;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    const userAgent = typeof window !== 'undefined' ? navigator.userAgent : null;
    await supabase.from('app_activity_logs').insert({
      path: opts.path,
      action: opts.action || 'page_view',
      user_id: opts.userId || null,
      user_email: opts.userEmail || null,
      user_name: opts.userName || null,
      club_id: opts.clubId || null,
      metadata: opts.metadata || {},
      user_agent: userAgent,
    });
  } catch {
    // Non-blocking catch so audit logging never impacts primary user UX
  }
}

export async function fetchSuperAdminActivityLogs(limit = 100): Promise<ActivityLogRow[]> {
  const { data, error } = await supabase
    .from('app_activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as ActivityLogRow[];
}
