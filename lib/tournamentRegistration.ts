import { supabase } from './supabase';

export interface TournamentRegistrationRow {
  id: string;
  tournament_id: string;
  club_id: string;
  registrant_name: string;
  partner_name: string | null;
  registered_by_user_id: string | null;
  status: 'registered' | 'waitlisted' | 'withdrawn';
  created_at: string;
}

// Anon-reachable — self-registration (player fills their own name) and
// organizer-entered guest entries (host types a name on someone's behalf)
// are the SAME action, just operated by different people. No separate
// guest path. Goes through the share token, not tournamentId, since a
// signed-out registrant never has authenticated access to look up a
// tournament by id.
export async function registerForTournament(shareToken: string, registrantName: string, partnerName: string | null): Promise<void> {
  const { error } = await supabase.rpc('register_for_tournament', {
    p_share_token: shareToken,
    p_registrant_name: registrantName,
    p_partner_name: partnerName,
  });
  if (error) throw error;
}

// Admin-only at the DB level (RLS) — the organizer's own view of the
// registration list, including withdrawn entries (unlike the public
// get_tournament_public payload, which excludes them).
export async function fetchTournamentRegistrations(tournamentId: string): Promise<TournamentRegistrationRow[]> {
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as TournamentRegistrationRow[];
}

export async function withdrawTournamentRegistration(registrationId: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_tournament_registration', { p_registration_id: registrationId });
  if (error) throw error;
}

export async function setTournamentRegistrationOpen(tournamentId: string, open: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_tournament_registration_open', { p_tournament_id: tournamentId, p_open: open });
  if (error) throw error;
}
