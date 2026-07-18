'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Trophy, UserPlus } from 'lucide-react';
import { fetchPublicTournament, type PublicTournamentData } from '@/lib/tournamentPublic';
import { registerForTournament, claimTournamentSlot } from '@/lib/tournamentRegistration';
import { recordScoreSelf } from '@/lib/tournamentScorers';
import { computeStandings, type StandingsRow } from '@/lib/tournamentStandings';
import type { LeagueGroupResults } from '@/lib/tournamentStages';
import TournamentStandingsTable from '@/components/TournamentStandingsTable';
import TournamentFixturesList from '@/components/TournamentFixturesList';
import TournamentBracketTree from '@/components/TournamentBracketTree';
import DoubleEliminationBracket from '@/components/DoubleEliminationBracket';
import type { TournamentMatchRow } from '@/lib/tournamentMatches';
import type { TournamentTeamRow } from '@/lib/tournamentTeams';

const BRACKET_STAGE_TYPES = ['knockout', 'page_playoff', 'simple_semifinal', 'double_elimination'];

// Read-only spectator page — no auth, no write access. Works signed-out
// because fetchPublicTournament calls a SECURITY DEFINER function granted to
// anon; the raw tournament_* tables themselves have zero anon grants. This
// route needs no layout/route-group work to hide app chrome from an
// anonymous visitor — GlobalNav/AuthGate already no-op when there's no user.
export default function WatchTournamentPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [data, setData] = useState<PublicTournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regName, setRegName] = useState('');
  const [regPartner, setRegPartner] = useState('');
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regDone, setRegDone] = useState(false);
  const [claimingSlot, setClaimingSlot] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [scoringMatch, setScoringMatch] = useState<TournamentMatchRow | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    fetchPublicTournament(shareToken)
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load tournament.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [shareToken]);

  function openScoreEntry(match: TournamentMatchRow) {
    if (match.status === 'completed') {
      setError('This match already has a score — ask a club admin to correct it if needed.');
      return;
    }
    setError(null);
    setScoringMatch(match);
    setScoreA('');
    setScoreB('');
  }

  async function handleSaveScore() {
    if (!scoringMatch || scoreA === '' || scoreB === '') return;
    setSaving(true);
    setError(null);
    try {
      await recordScoreSelf(scoringMatch.id, Number(scoreA), Number(scoreB));
      setScoringMatch(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save score.');
    } finally {
      setSaving(false);
    }
  }

  async function handleClaimSlot() {
    if (claimingSlot === null || !regName.trim()) {
      setRegError('Name is required.');
      return;
    }
    setClaiming(true);
    setRegError(null);
    try {
      await claimTournamentSlot(shareToken, claimingSlot, regName.trim(), regPartner.trim() || null);
      setClaimingSlot(null);
      setRegName('');
      setRegPartner('');
      load();
    } catch (e) {
      setRegError(e instanceof Error ? e.message : 'Could not claim that slot.');
    } finally {
      setClaiming(false);
    }
  }

  async function handleRegister() {
    if (!regName.trim()) {
      setRegError('Name is required.');
      return;
    }
    setRegistering(true);
    setRegError(null);
    try {
      await registerForTournament(shareToken, regName.trim(), regPartner.trim() || null);
      setRegDone(true);
      setRegName('');
      setRegPartner('');
      load();
    } catch (e) {
      setRegError(e instanceof Error ? e.message : 'Registration failed.');
    } finally {
      setRegistering(false);
    }
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (error) return <main className="page"><p style={{ color: 'var(--danger)' }}>{error}</p></main>;
  if (!data) return <main className="page"><p>Tournament not found.</p></main>;

  const teams: TournamentTeamRow[] = data.teams.map(t => ({
    id: t.id,
    tournament_id: data.tournament.id,
    club_id: '',
    name: t.name,
    player_names: t.playerNames,
    logo_url: t.logoUrl,
    seed: t.seed,
    created_at: '',
  }));

  return (
    <main className="page">
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={22} /> {data.tournament.name}</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize', marginBottom: 16 }}>{data.tournament.status}</p>

      {data.tournament.registrationOpen && data.tournament.slotCount !== null && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}><UserPlus size={18} /> Claim a slot</h2>
          {(() => {
            const claimed = new Map(data.registrations.filter(r => r.slotNumber !== null).map(r => [r.slotNumber as number, r]));
            const slots = Array.from({ length: data.tournament.slotCount as number }, (_, i) => i + 1);
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                {slots.map(n => {
                  const reg = claimed.get(n);
                  if (reg) {
                    return (
                      <div key={n} className="card" style={{ padding: 8, fontSize: 12, background: 'var(--surface-2, rgba(127,127,127,0.08))' }}>
                        <div style={{ fontWeight: 800 }}>#{n}</div>
                        <div>{reg.registrantName}{reg.partnerName ? ` & ${reg.partnerName}` : ''}</div>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={n}
                      type="button"
                      className="btn-secondary"
                      onClick={() => { setClaimingSlot(n); setRegError(null); }}
                      style={{ padding: 8, fontSize: 12, fontWeight: 800 }}
                    >
                      #{n}<br />Claim
                    </button>
                  );
                })}
              </div>
            );
          })()}
          {claimingSlot !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>Claiming slot #{claimingSlot}</p>
              <input
                value={regName}
                onChange={e => setRegName(e.target.value)}
                placeholder="Your name (or a guest's name)"
                aria-label="Registrant name"
                style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <input
                value={regPartner}
                onChange={e => setRegPartner(e.target.value)}
                placeholder="Partner's name (optional — leave blank if you need one)"
                aria-label="Partner name"
                style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
              />
              {regError && <p style={{ color: 'var(--danger)', fontWeight: 600, margin: 0 }}>{regError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" onClick={handleClaimSlot} disabled={claiming}>
                  {claiming ? 'Claiming…' : 'Confirm'}
                </button>
                <button className="text-link-btn" onClick={() => setClaimingSlot(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {data.tournament.registrationOpen && data.tournament.slotCount === null && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}><UserPlus size={18} /> Register to play</h2>
          {regDone ? (
            <p style={{ margin: 0, fontWeight: 700 }}>You&apos;re registered! See your name below.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                value={regName}
                onChange={e => setRegName(e.target.value)}
                placeholder="Your name (or a guest's name)"
                aria-label="Registrant name"
                style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <input
                value={regPartner}
                onChange={e => setRegPartner(e.target.value)}
                placeholder="Partner's name (optional — leave blank if you need one)"
                aria-label="Partner name"
                style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
              />
              {regError && <p style={{ color: 'var(--danger)', fontWeight: 600, margin: 0 }}>{regError}</p>}
              <button className="btn-primary" onClick={handleRegister} disabled={registering}>
                {registering ? 'Registering…' : 'Register'}
              </button>
            </div>
          )}
          {data.registrations.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
                Registered ({data.registrations.length})
              </p>
              {data.registrations.map(r => (
                <p key={r.id} style={{ margin: '2px 0', fontSize: 14 }}>
                  {r.registrantName}{r.partnerName ? ` & ${r.partnerName}` : ''}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {[...data.stages].sort((a, b) => a.stageOrder - b.stageOrder).map(stage => {
        const stageMatches: TournamentMatchRow[] = data.matches
          .filter(m => m.stageId === stage.id)
          .map(m => ({
            id: m.id,
            stage_id: m.stageId,
            club_id: '',
            round_label: m.roundLabel,
            group_label: m.groupLabel,
            match_order: m.matchOrder,
            bracket_round: m.bracketRound,
            bracket_slot: m.bracketSlot,
            team_a_id: m.teamAId,
            team_b_id: m.teamBId,
            winner_next_match_id: m.winnerNextMatchId,
            winner_next_slot: m.winnerNextSlot,
            loser_next_match_id: m.loserNextMatchId,
            loser_next_slot: m.loserNextSlot,
            is_bye: m.isBye,
            scheduled_at: m.scheduledAt,
            score_a: m.scoreA,
            score_b: m.scoreB,
            status: m.status,
            created_at: '',
          }));

        const isBracket = BRACKET_STAGE_TYPES.includes(stage.stageType);
        // Prefer the frozen results (correct pointsPerWin + the actual
        // advancingTeamIds used to seed the next stage) once a stage is
        // completed; only live-compute for a stage still in progress, where
        // no frozen snapshot exists yet.
        const frozenStandings = (stage.results as LeagueGroupResults | null)?.standings;
        const combinedStandings = (stage.results as LeagueGroupResults | null)?.combinedStandings;
        const standings: StandingsRow[] = !isBracket
          ? (frozenStandings ?? computeStandings(stageMatches, teams, { pointsPerWin: stage.config.pointsPerWin }))
          : [];
        const teamNames = new Map(teams.map(t => [t.id, t.name]));

        return (
          <section key={stage.id} style={{ marginBottom: 28 }}>
            <h2>{stage.name}</h2>
            {combinedStandings && combinedStandings.length > 0 ? (
              <div className="card" style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px', fontWeight: 700, textTransform: 'uppercase' }}>
                  Combined standings — all groups
                </p>
                {[...combinedStandings].sort((a, b) => a.rank - b.rank).map(s => (
                  <div key={s.teamId} className="leaderboard-row">
                    <span className={`rank-badge ${s.rank <= 3 ? `rank-${s.rank}` : ''}`}>{s.rank}</span>
                    <span className="leaderboard-name">{teamNames.get(s.teamId) ?? 'Unknown'}{s.groupLabel ? ` (${s.groupLabel})` : ''}</span>
                    <span className="leaderboard-stats">{s.won}-{s.lost} ({Math.round(s.winPct * 100)}%)</span>
                  </div>
                ))}
              </div>
            ) : (
              !isBracket && standings.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <TournamentStandingsTable standings={standings} teamNames={teamNames} />
                </div>
              )
            )}
            {stage.stageType === 'double_elimination' ? (
              <DoubleEliminationBracket matches={stageMatches} teams={teams} onScoreClick={data.tournament.selfScoreEnabled ? openScoreEntry : undefined} />
            ) : isBracket ? (
              <TournamentBracketTree matches={stageMatches} teams={teams} onScoreClick={data.tournament.selfScoreEnabled ? openScoreEntry : undefined} />
            ) : (
              <TournamentFixturesList matches={stageMatches} teams={teams} onScoreClick={data.tournament.selfScoreEnabled ? openScoreEntry : undefined} />
            )}
          </section>
        );
      })}

      {scoringMatch && (
        <div className="card" style={{ position: 'sticky', bottom: 12, marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Enter score:</span>
          <input type="number" placeholder="Score A" value={scoreA} onChange={e => setScoreA(e.target.value)} style={{ width: 80 }} />
          <span>–</span>
          <input type="number" placeholder="Score B" value={scoreB} onChange={e => setScoreB(e.target.value)} style={{ width: 80 }} />
          <button className="btn-primary" onClick={handleSaveScore} disabled={saving || scoreA === '' || scoreB === ''}>
            Save
          </button>
          <button className="text-link-btn" onClick={() => setScoringMatch(null)}>Cancel</button>
        </div>
      )}
    </main>
  );
}
