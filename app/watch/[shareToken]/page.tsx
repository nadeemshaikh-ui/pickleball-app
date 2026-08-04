'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Trophy, UserPlus, Share2 } from 'lucide-react';
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

import { supabase } from '@/lib/supabase';

const BRACKET_STAGE_TYPES = ['knockout', 'page_playoff', 'simple_semifinal', 'double_elimination'];

export default function WatchTournamentPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [data, setData] = useState<PublicTournamentData | null>(null);
  const [dbRounds, setDbRounds] = useState<any[]>([]);
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
      .then(tData => {
        setData(tData);
        supabase
          .from('rounds')
          .select('*')
          .eq('session_id', 'hot101')
          .then(({ data: rData }) => {
            if (rData) setDbRounds(rData);
          });
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load tournament.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      supabase
        .from('rounds')
        .select('*')
        .eq('session_id', 'hot101')
        .then(({ data: rData }) => {
          if (rData && rData.length > 0) {
            setDbRounds(rData);
          }
        });
    }, 5000);
    return () => clearInterval(interval);
  }, [shareToken]);

  function handleShareWhatsApp() {
    if (typeof window === 'undefined' || !data) return;
    const url = window.location.href;
    const text = `🏓 *${data.tournament.name}*\nCheck out the live tournament bracket and scores here:\n${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  }

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}><Trophy size={22} /> {data.tournament.name}</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize', margin: '4px 0 0' }}>{data.tournament.status}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <a
            href="/session/hot101/play"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              background: '#2563eb',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: 13,
              borderRadius: 10,
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            ⚡ Enter Live Scores
          </a>
          <button
            onClick={handleShareWhatsApp}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              background: '#25D366',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: 13,
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)'
            }}
          >
            <Share2 size={16} /> Share Schedule on WhatsApp
          </button>
        </div>
      </div>

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

        // Custom Schedule Render Support (Option 1 & custom rosters/schedules)
        const customRosters = (stage.config as any)?.rosters;
        const customSchedule = (stage.config as any)?.schedule;

        return (
          <section key={stage.id} style={{ marginBottom: 28 }}>
            <h2>{stage.name}</h2>
            
            {customRosters && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--accent)', marginBottom: 12 }}>
                  Court Allocations & Rosters
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 18, color: '#f8fafc' }}>
                    <h4 style={{ color: '#f87171', margin: '0 0 14px', fontSize: 15, fontWeight: 800 }}>Hour 1 (08:00 PM - 08:50 PM)</h4>
                    {Object.entries(customRosters.hour1 || {}).map(([crt, pls]: any) => (
                      <div key={crt} style={{ marginBottom: 14 }}>
                        <div style={{ fontWeight: 800, fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{crt}</div>
                        <div style={{ fontSize: 13, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {pls.map((p: string) => (
                            <span key={p} style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>{p}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 18, color: '#f8fafc' }}>
                    <h4 style={{ color: '#60a5fa', margin: '0 0 14px', fontSize: 15, fontWeight: 800 }}>Hour 2 (09:00 PM - 09:50 PM)</h4>
                    {Object.entries(customRosters.hour2 || {}).map(([crt, pls]: any) => (
                      <div key={crt} style={{ marginBottom: 14 }}>
                        <div style={{ fontWeight: 800, fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{crt}</div>
                        <div style={{ fontSize: 13, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {pls.map((p: string) => (
                            <span key={p} style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>{p}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {customSchedule && customSchedule.length > 0 ? (
              <>
                {/* Live Individual Player Standings & Analytics */}
                {(() => {
                  const playerStatsMap = new Map<string, { name: string; played: number; won: number; lost: number; pf: number; pa: number }>();

                  function getOrCreatePlayer(pName: string) {
                    const trimmed = pName.trim();
                    if (!playerStatsMap.has(trimmed)) {
                      playerStatsMap.set(trimmed, { name: trimmed, played: 0, won: 0, lost: 0, pf: 0, pa: 0 });
                    }
                    return playerStatsMap.get(trimmed)!;
                  }

                  // Pre-populate all 18 players from court rosters
                  if (customRosters) {
                    ['hour1', 'hour2'].forEach(hKey => {
                      const hr = customRosters[hKey] || {};
                      Object.values(hr).forEach((pls: any) => {
                        if (Array.isArray(pls)) {
                          pls.forEach((pName: string) => getOrCreatePlayer(pName));
                        }
                      });
                    });
                  }

                  // Calculate stats from scored matches (merging dbRounds live scores)
                  customSchedule.forEach((r: any, rIdx: number) => {
                    const rNum = parseInt((r.round || '').replace(/\D/g, '')) || (rIdx + 1);
                    ['court_1', 'court_2', 'court_3'].forEach((crtKey, cIdx) => {
                      const match = r[crtKey];
                      if (!match) return;
                      const cNum = cIdx + 1;
                      const dbR = dbRounds.find((dr: any) => dr.round_number === rNum && dr.court === cNum);

                      const s1 = dbR?.score_a ?? match.score_1 ?? match.score_a;
                      const s2 = dbR?.score_b ?? match.score_2 ?? match.score_b;

                      if (s1 !== undefined && s1 !== null && s2 !== undefined && s2 !== null && s1 !== '' && s2 !== '') {
                        const num1 = Number(s1);
                        const num2 = Number(s2);
                        const team1Players = (match.team_1 || '').split('&').map((s: string) => s.trim());
                        const team2Players = (match.team_2 || '').split('&').map((s: string) => s.trim());

                        team1Players.forEach((p: string) => {
                          if (!p) return;
                          const stat = getOrCreatePlayer(p);
                          stat.played++;
                          stat.pf += num1;
                          stat.pa += num2;
                          if (num1 > num2) stat.won++;
                          else if (num2 > num1) stat.lost++;
                        });

                        team2Players.forEach((p: string) => {
                          if (!p) return;
                          const stat = getOrCreatePlayer(p);
                          stat.played++;
                          stat.pf += num2;
                          stat.pa += num1;
                          if (num2 > num1) stat.won++;
                          else if (num1 > num2) stat.lost++;
                        });
                      }
                    });
                  });

                  // Official Tie-breaker Sort: 1. Wins (W) desc -> 2. Point Differential (+/-) desc -> 3. Total Points (PF) desc
                  const sortedPlayers = [...playerStatsMap.values()].sort((a, b) => {
                    if (b.won !== a.won) return b.won - a.won;
                    const diffB = b.pf - b.pa;
                    const diffA = a.pf - a.pa;
                    if (diffB !== diffA) return diffB - diffA;
                    return b.pf - a.pf;
                  });

                  const playedMatchesCount = sortedPlayers.reduce((sum, p) => sum + p.played, 0);

                  return (
                    <div className="card" style={{ marginBottom: 24, border: '1.5px solid var(--accent, #2563eb)', background: 'linear-gradient(180deg, rgba(37,99,235,0.06) 0%, rgba(15,23,42,0.4) 100%)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <h3 style={{ fontSize: 16, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--accent, #3b82f6)', margin: 0, fontWeight: 900 }}>
                            🔥 Who is the Hot Shot — Standings (18 Players)
                          </h3>
                          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '3px 0 0 0' }}>
                            Winner declared as THE HOTSHOT | Tie-Breaker: Most Wins (W) ➔ Point Diff (+/-) ➔ Points Scored
                          </p>
                        </div>
                        <span style={{ fontSize: 11, background: playedMatchesCount > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.08)', color: playedMatchesCount > 0 ? '#10b981' : 'var(--muted)', border: `1px solid ${playedMatchesCount > 0 ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, padding: '4px 10px', borderRadius: 8, fontWeight: 800 }}>
                          {playedMatchesCount > 0 ? '● Live Scores Updating' : 'Ready for Match Scores'}
                        </span>
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left', minWidth: 620 }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)', fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: 0.5 }}>
                              <th style={{ padding: '10px 8px', minWidth: 50, textAlign: 'center', whiteSpace: 'nowrap' }}>Rank</th>
                              <th style={{ padding: '10px 12px', minWidth: 120, whiteSpace: 'nowrap' }}>Player Name</th>
                              <th style={{ padding: '10px 8px', minWidth: 65, textAlign: 'center', whiteSpace: 'nowrap' }}>Played</th>
                              <th style={{ padding: '10px 8px', minWidth: 70, textAlign: 'center', whiteSpace: 'nowrap' }}>W–L</th>
                              <th style={{ padding: '10px 8px', minWidth: 95, textAlign: 'center', whiteSpace: 'nowrap' }}>Total Points</th>
                              <th style={{ padding: '10px 8px', minWidth: 95, textAlign: 'center', whiteSpace: 'nowrap' }}>Points Allowed</th>
                              <th style={{ padding: '10px 8px', minWidth: 90, textAlign: 'center', whiteSpace: 'nowrap' }}>Point Diff</th>
                              <th style={{ padding: '10px 12px', minWidth: 65, textAlign: 'right', whiteSpace: 'nowrap' }}>Win %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedPlayers.map((p, idx) => {
                              const winPct = p.played > 0 ? Math.round((p.won / p.played) * 100) : 0;
                              const diff = p.pf - p.pa;
                              const rankDisplay = idx === 0 ? '👑 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`;
                              const isTop3 = idx < 3;
                              return (
                                <tr
                                  key={p.name}
                                  style={{
                                    borderBottom: '1px solid var(--border)',
                                    background: idx === 0 ? 'rgba(234,179,8,0.12)' : idx === 1 ? 'rgba(203,213,225,0.06)' : idx === 2 ? 'rgba(180,83,9,0.06)' : 'transparent',
                                    fontWeight: isTop3 ? 700 : 500,
                                  }}
                                >
                                  <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: idx === 0 ? '#eab308' : 'inherit', whiteSpace: 'nowrap' }}>
                                    {rankDisplay}
                                  </td>
                                  <td style={{ padding: '10px 12px', fontWeight: 800, color: idx === 0 ? '#fef08a' : '#ffffff', whiteSpace: 'nowrap' }}>
                                    {p.name}
                                    {idx === 0 && (
                                      <span style={{ fontSize: 10, background: '#eab308', color: '#0f172a', fontWeight: 900, padding: '2px 6px', borderRadius: 4, marginLeft: 8 }}>
                                        🔥 THE HOTSHOT
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{p.played} / 8</td>
                                  <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, whiteSpace: 'nowrap' }}>{p.won}–{p.lost}</td>
                                  <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: '#60a5fa', whiteSpace: 'nowrap' }}>{p.pf} pts</td>
                                  <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{p.pa} pts</td>
                                  <td
                                    style={{
                                      padding: '10px 8px',
                                      textAlign: 'center',
                                      fontWeight: 900,
                                      fontSize: 14,
                                      whiteSpace: 'nowrap',
                                      color: diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : 'var(--muted)',
                                    }}
                                  >
                                    {diff > 0 ? `+${diff}` : diff}
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap', color: winPct >= 60 ? '#10b981' : 'inherit' }}>
                                    {winPct}%
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                <div className="card">
                  <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--accent)', margin: '0 0 16px' }}>
                    12-Round Match Schedule
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                          <th style={{ padding: 10, width: 70 }}>Round</th>
                          <th style={{ padding: 10, width: 100 }}>Time</th>
                          <th style={{ padding: 10 }}>Court 1</th>
                          <th style={{ padding: 10 }}>Court 2</th>
                          <th style={{ padding: 10 }}>Court 3</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customSchedule.map((m: any, idx: number) => {
                          const rNum = parseInt((m.round || '').replace(/\D/g, '')) || (idx + 1);
                          const renderCourtCell = (cKey: string, cNum: number) => {
                            const match = m[cKey];
                            if (!match) return null;
                            const dbR = dbRounds.find((dr: any) => dr.round_number === rNum && dr.court === cNum);
                            const s1 = dbR?.score_a ?? match.score_1 ?? match.score_a;
                            const s2 = dbR?.score_b ?? match.score_2 ?? match.score_b;
                            const hasScore = s1 !== undefined && s1 !== null && s2 !== undefined && s2 !== null && s1 !== '' && s2 !== '';

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontWeight: 700 }}>
                                  {match.team_1} <span style={{ color: 'var(--muted)', fontSize: 11 }}>VS</span> {match.team_2}
                                </span>
                                {hasScore && (
                                  <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '1px 6px', borderRadius: 4, fontWeight: 800, width: 'fit-content' }}>
                                    Score: {s1} - {s2}
                                  </span>
                                )}
                              </div>
                            );
                          };

                          return (
                            <tr key={m.round} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: 10, fontWeight: 800, color: 'var(--accent)' }}>{m.round}</td>
                              <td style={{ padding: 10, color: 'var(--muted)' }}>{m.time_slot}</td>
                              <td style={{ padding: 10 }}>{renderCourtCell('court_1', 1)}</td>
                              <td style={{ padding: 10 }}>{renderCourtCell('court_2', 2)}</td>
                              <td style={{ padding: 10 }}>{renderCourtCell('court_3', 3)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <>
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
              </>
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
