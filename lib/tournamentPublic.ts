import { supabase } from './supabase';
import type { StageType, StageConfig, LeagueGroupResults, BracketResults } from './tournamentStages';

// Shape returned by the get_tournament_public() RPC — camelCase, per the
// json_build_object() keys in the migration, NOT the snake_case row shape
// every other tournament_*.ts file uses for direct table reads. Kept as its
// own type rather than Pick<TournamentMatchRow, ...> since the two don't
// share a casing convention.
export interface PublicTeam {
  id: string;
  name: string;
  playerNames: [string, string];
  logoUrl: string | null;
  seed: number | null;
}

export interface PublicMatch {
  id: string;
  stageId: string;
  roundLabel: string | null;
  groupLabel: string | null;
  matchOrder: number;
  bracketRound: number | null;
  bracketSlot: number | null;
  teamAId: string | null;
  teamBId: string | null;
  winnerNextMatchId: string | null;
  winnerNextSlot: 'a' | 'b' | null;
  loserNextMatchId: string | null;
  loserNextSlot: 'a' | 'b' | null;
  isBye: boolean;
  scheduledAt: string | null;
  scoreA: number | null;
  scoreB: number | null;
  status: 'scheduled' | 'in_progress' | 'completed';
}

export interface PublicRegistration {
  id: string;
  registrantName: string;
  partnerName: string | null;
  status: 'registered' | 'waitlisted' | 'withdrawn';
}

export interface PublicTournamentData {
  tournament: { id: string; name: string; status: string; registrationOpen: boolean };
  teams: PublicTeam[];
  stages: {
    id: string;
    stageOrder: number;
    stageType: StageType;
    name: string;
    config: StageConfig;
    status: string;
    results: LeagueGroupResults | BracketResults | null;
  }[];
  matches: (PublicMatch & { courtLabel: string | null })[];
  registrations: PublicRegistration[];
}

// Cheap defense-in-depth against silent drift between this hand-maintained
// type and the SQL function's json_build_object() keys (there's no runtime
// schema library in this project, so this checks only the top-level shape,
// not deep field-by-field) — a malformed response fails loudly here instead
// of producing confusing downstream React errors.
function isPublicTournamentData(value: unknown): value is PublicTournamentData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.tournament === 'object' &&
    Array.isArray(v.teams) &&
    Array.isArray(v.stages) &&
    Array.isArray(v.matches)
  );
}

// Unauthenticated read for the /watch/[shareToken] spectator route. Works
// signed-out because get_tournament_public is a SECURITY DEFINER function
// granted to the anon role — the four raw tournament_* tables themselves
// have zero anon grants (see supabase/migrations/20260716000000_tournament_engine.sql),
// so this one narrow, token-validated function is the only anon-reachable
// surface for tournament data.
export async function fetchPublicTournament(shareToken: string): Promise<PublicTournamentData | null> {
  const { data, error } = await supabase.rpc('get_tournament_public', { p_share_token: shareToken });
  if (error) throw error;
  if (data === null) return null;
  if (!isPublicTournamentData(data)) throw new Error('Tournament data came back in an unexpected shape.');
  return data;
}
