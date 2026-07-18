'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Trophy, Plus, Trash2, Copy, Sparkles, UserPlus, KeyRound } from 'lucide-react';
import { fetchTournament, watchUrlFor, type TournamentRow } from '@/lib/tournaments';
import {
  fetchTournamentRegistrations,
  withdrawTournamentRegistration,
  setTournamentRegistrationOpen,
  type TournamentRegistrationRow,
} from '@/lib/tournamentRegistration';
import { fetchCourtScorerCodes, createCourtScorerCode, type CourtScorerCodeRow } from '@/lib/tournamentScorers';
import {
  fetchTournamentTeams,
  createTournamentTeam,
  deleteTournamentTeam,
  updateTournamentTeamSeed,
  uploadTournamentTeamLogo,
  type TournamentTeamRow,
} from '@/lib/tournamentTeams';
import { fetchStages, generateNextStage, type TournamentStageRow, type StageType } from '@/lib/tournamentStages';
import { drawMysteryPairs } from '@/lib/mysteryPartner';
import { listPlayers, type PlayerRow } from '@/lib/players';
import { isCurrentUserAdmin } from '@/lib/auth';
import { useCurrentClub } from '@/lib/useCurrentClub';
import { StageWizard } from '@/components/tournaments/StageWizard';

// Between-pair delay while a draw streams in — no Supabase Realtime channel
// here (the rest of the app deliberately polls instead of using Realtime,
// see app/session/[id]/leaderboard/page.tsx's reasoning: cheaper to build
// and run for a handful of concurrent viewers). The same watchable, streamed
// reveal is achieved by pacing each pair's DB write and having every viewer
// of this page — including the admin doing the draw — poll tournament_teams
// on the same interval the rest of the app already uses.
const MYSTERY_DRAW_PAIR_DELAY_MS = 1200;
const TEAMS_POLL_INTERVAL_MS = 4000;

const STAGE_TYPE_LABELS: Record<StageType, string> = {
  league: 'League (round-robin)',
  group: 'Group Stage',
  knockout: 'Straight Knockout',
  page_playoff: 'Page Playoff (top 4)',
  simple_semifinal: 'Simple Semifinal (top 4)',
};

export default function TournamentDetailPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [tournament, setTournament] = useState<TournamentRow | null>(null);
  const [teams, setTeams] = useState<TournamentTeamRow[]>([]);
  const [stages, setStages] = useState<TournamentStageRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [teamName, setTeamName] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');

  const [stageType, setStageType] = useState<StageType>('league');
  const [stageName, setStageName] = useState('');
  const [groupCount, setGroupCount] = useState(2);
  const [doubleHeader, setDoubleHeader] = useState(false);
  const [advanceMode, setAdvanceMode] = useState<'per_group' | 'combined'>('per_group');
  const [advancePerGroup, setAdvancePerGroup] = useState(2);
  const [advanceCount, setAdvanceCount] = useState(8);

  const [mysteryPool, setMysteryPool] = useState<Set<string>>(new Set());
  const [byePlayer, setByePlayer] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [drawProgress, setDrawProgress] = useState<{ done: number; total: number } | null>(null);

  const [registrations, setRegistrations] = useState<TournamentRegistrationRow[]>([]);
  const [scorerCodes, setScorerCodes] = useState<CourtScorerCodeRow[]>([]);
  const [newCourtLabel, setNewCourtLabel] = useState('');

  async function load(clubId: string, id: string) {
    const [t, tm, st, pl, reg, codes] = await Promise.all([
      fetchTournament(id),
      fetchTournamentTeams(id),
      fetchStages(id),
      listPlayers(clubId),
      fetchTournamentRegistrations(id),
      fetchCourtScorerCodes(id),
    ]);
    setTournament(t);
    setTeams(tm);
    setStages(st);
    setPlayers(pl);
    setRegistrations(reg);
    setScorerCodes(codes);
  }

  async function handleToggleRegistration() {
    if (!tournament) return;
    setBusy(true);
    setError(null);
    try {
      await setTournamentRegistrationOpen(tournament.id, !tournament.registration_open);
      setTournament({ ...tournament, registration_open: !tournament.registration_open });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update registration status.');
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdrawRegistration(registrationId: string) {
    setBusy(true);
    setError(null);
    try {
      await withdrawTournamentRegistration(registrationId);
      setRegistrations(prev => prev.map(r => (r.id === registrationId ? { ...r, status: 'withdrawn' } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to withdraw registration.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateScorerCode() {
    if (!tournament || !newCourtLabel.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createCourtScorerCode(tournament.id, newCourtLabel.trim());
      setNewCourtLabel('');
      setScorerCodes(await fetchCourtScorerCodes(tournament.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create scorer code.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (clubLoading) return;
    if (!currentClubId || !tournamentId) {
      setLoading(false);
      return;
    }
    async function init() {
      try {
        await Promise.all([load(currentClubId!, tournamentId), isCurrentUserAdmin(currentClubId!).then(setIsAdmin)]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load tournament.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [currentClubId, clubLoading, tournamentId]);

  // Lets anyone with this page open watch a Mystery Partner draw stream in
  // live, not just the admin who triggered it — polling rather than a
  // Realtime subscription, matching this app's existing convention.
  useEffect(() => {
    if (!tournamentId || stages.length > 0) return;
    const interval = setInterval(() => {
      fetchTournamentTeams(tournamentId).then(setTeams).catch(() => {});
    }, TEAMS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [tournamentId, stages.length]);

  async function handleAddTeam() {
    if (!currentClubId || !teamName.trim() || !player1 || !player2 || player1 === player2) return;
    setBusy(true);
    setError(null);
    try {
      await createTournamentTeam({ tournamentId, name: teamName.trim(), playerNames: [player1, player2] });
      setTeamName('');
      setPlayer1('');
      setPlayer2('');
      setTeams(await fetchTournamentTeams(tournamentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add team.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogoUpload(teamId: string, file: File) {
    setBusy(true);
    setError(null);
    try {
      const url = await uploadTournamentTeamLogo(file);
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('tournament_teams').update({ logo_url: url }).eq('id', teamId);
      setTeams(await fetchTournamentTeams(tournamentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload logo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveTeam(teamId: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteTournamentTeam(teamId);
      setTeams(await fetchTournamentTeams(tournamentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove team.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSeedChange(teamId: string, seed: string) {
    const n = seed === '' ? null : Number(seed);
    setBusy(true);
    setError(null);
    try {
      await updateTournamentTeamSeed(teamId, n);
      setTeams(await fetchTournamentTeams(tournamentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update seed.');
    } finally {
      setBusy(false);
    }
  }

  function toggleMysteryPoolPlayer(name: string) {
    setMysteryPool(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setByePlayer('');
  }

  async function handleMysteryDraw() {
    const pool = [...mysteryPool];
    if (pool.length < 2) return;
    setError(null);
    setDrawing(true);
    try {
      const pairs = drawMysteryPairs(pool, byePlayer || undefined);
      setDrawProgress({ done: 0, total: pairs.length });
      const existingCount = teams.length;
      for (let i = 0; i < pairs.length; i++) {
        await createTournamentTeam({
          tournamentId,
          name: `Mystery Pair ${existingCount + i + 1}`,
          playerNames: pairs[i].players,
        });
        setTeams(await fetchTournamentTeams(tournamentId));
        setDrawProgress({ done: i + 1, total: pairs.length });
        if (i < pairs.length - 1) await new Promise(resolve => setTimeout(resolve, MYSTERY_DRAW_PAIR_DELAY_MS));
      }
      setMysteryPool(new Set());
      setByePlayer('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mystery Partner draw failed partway through — check the Teams list above for what did get created.');
    } finally {
      setDrawing(false);
      setDrawProgress(null);
    }
  }

  async function handleGenerateStage() {
    if (!currentClubId || !stageName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const lastStage = stages.length > 0 ? stages[stages.length - 1] : null;
      await generateNextStage(tournamentId, lastStage?.id ?? null, stageType, stageName.trim(), {
        groupCount,
        doubleHeader,
        advanceMode: stageType === 'group' ? advanceMode : undefined,
        advancePerGroup: stageType === 'group' && advanceMode === 'per_group' ? advancePerGroup : undefined,
        advanceCount: stageType === 'group' && advanceMode === 'combined' ? advanceCount : undefined,
      });
      setStageName('');
      setStages(await fetchStages(tournamentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate stage.');
    } finally {
      setBusy(false);
    }
  }

  function copyWatchLink() {
    if (!tournament) return;
    navigator.clipboard.writeText(`${window.location.origin}${watchUrlFor(tournament.share_token)}`).catch(() => {
      setError('Could not copy the link — copy it manually from the address bar instead.');
    });
  }

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId || !tournament) return <main className="page"><p>Tournament not found.</p></main>;

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href="/league/tournaments" className="text-link-btn">← Tournaments</Link>
        <button className="icon-btn" aria-label="Copy spectator link" onClick={copyWatchLink}>
          <Copy size={16} />
        </button>
      </div>

      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={22} /> {tournament.name}</h1>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>{error}</p>}

      <h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><UserPlus size={18} /> Registrations ({registrations.filter(r => r.status !== 'withdrawn').length})</h2>
      <div className="card" style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: registrations.length > 0 ? 10 : 0, cursor: 'pointer' }}>
          <input type="checkbox" checked={tournament.registration_open} onChange={handleToggleRegistration} disabled={busy} />
          Registration open — anyone with the spectator link can sign up
        </label>
        {registrations.filter(r => r.status !== 'withdrawn').map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px solid var(--border)' }}>
            <span style={{ flex: 1, fontSize: 13 }}>{r.registrant_name}{r.partner_name ? ` & ${r.partner_name}` : ''}</span>
            <button className="btn-secondary" style={{ minHeight: 28, padding: '3px 10px', fontSize: 12 }} onClick={() => handleWithdrawRegistration(r.id)} disabled={busy}>
              Withdraw
            </button>
          </div>
        ))}
      </div>

      <h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><KeyRound size={18} /> Court Scorer Codes</h2>
      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px' }}>
          Share a code with whoever&apos;s running a court — they can enter scores for that court without an account.
        </p>
        {scorerCodes.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{c.court_label}</span>
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>{c.code}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            value={newCourtLabel}
            onChange={e => setNewCourtLabel(e.target.value)}
            placeholder="Court name (e.g. Court 1)"
            aria-label="Court label"
            style={{ flex: 1, minHeight: 40, padding: '8px 10px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 8 }}
          />
          <button className="btn-secondary" onClick={handleCreateScorerCode} disabled={busy || !newCourtLabel.trim()}>
            Generate code
          </button>
        </div>
      </div>

      <h2>Teams</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {teams.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No teams yet.</p>}
        {teams.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, flex: 1 }}>{t.name}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t.player_names.join(' & ')}</span>
            {isAdmin && (
              <>
                <input
                  type="number"
                  placeholder="Seed"
                  defaultValue={t.seed ?? ''}
                  onBlur={e => handleSeedChange(t.id, e.target.value)}
                  style={{ width: 60 }}
                />
                <label className="text-link-btn" style={{ cursor: 'pointer' }}>
                  Logo
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => e.target.files?.[0] && handleLogoUpload(t.id, e.target.files[0])}
                  />
                </label>
                <button className="icon-btn" aria-label="Remove team" disabled={busy} onClick={() => handleRemoveTeam(t.id)}>
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        ))}

        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <input type="text" placeholder="Team name" value={teamName} onChange={e => setTeamName(e.target.value)} style={{ flex: '1 1 140px' }} />
            <select value={player1} onChange={e => setPlayer1(e.target.value)} style={{ flex: '1 1 120px' }}>
              <option value="">Player 1</option>
              {players.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <select value={player2} onChange={e => setPlayer2(e.target.value)} style={{ flex: '1 1 120px' }}>
              <option value="">Player 2</option>
              {players.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <button className="btn-primary" onClick={handleAddTeam} disabled={busy || !teamName.trim() || !player1 || !player2}>
              <Plus size={14} /> Add
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={18} /> Mystery Partner Draw</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              Pick a pool of players — they&apos;ll be randomly paired into teams. Pairs stream in one at a time so anyone with this page open can
              watch the reveal.
            </p>
            {(() => {
              const alreadyOnATeam = new Set(teams.flatMap(t => t.player_names));
              const candidates = players.filter(p => !alreadyOnATeam.has(p.name));
              return (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {candidates.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className={mysteryPool.has(p.name) ? 'btn-primary' : 'btn-secondary'}
                        onClick={() => toggleMysteryPoolPlayer(p.name)}
                        disabled={drawing}
                        style={{ minHeight: 32, padding: '4px 10px', fontSize: 13 }}
                      >
                        {p.name}
                      </button>
                    ))}
                    {candidates.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Every registered player is already on a team.</p>}
                  </div>

                  {mysteryPool.size > 0 && mysteryPool.size % 2 !== 0 && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      Odd pool ({mysteryPool.size}) — who sits out this draw?
                      <select value={byePlayer} onChange={e => setByePlayer(e.target.value)} disabled={drawing}>
                        <option value="">Choose a bye…</option>
                        {[...mysteryPool].map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </label>
                  )}

                  <button
                    className="btn-primary"
                    onClick={handleMysteryDraw}
                    disabled={
                      drawing ||
                      mysteryPool.size < 2 ||
                      (mysteryPool.size % 2 !== 0 && !byePlayer)
                    }
                  >
                    {drawing && drawProgress
                      ? `Drawing… ${drawProgress.done}/${drawProgress.total} pairs revealed`
                      : 'Start Draw'}
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}

      <h2>Stages</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {stages.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No stages yet.</p>}
        {stages.map(s => (
          <Link key={s.id} href={`/league/tournaments/${tournamentId}/stage/${s.id}`} className="card" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700 }}>{s.name}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>{STAGE_TYPE_LABELS[s.stage_type]} · {s.status}</span>
          </Link>
        ))}
      </div>

      {isAdmin && teams.length >= 2 && (
        <StageWizard
          teams={teams}
          stages={stages}
          stageName={stageName}
          onStageNameChange={setStageName}
          stageType={stageType}
          onStageTypeChange={setStageType}
          groupCount={groupCount}
          onGroupCountChange={setGroupCount}
          doubleHeader={doubleHeader}
          onDoubleHeaderChange={setDoubleHeader}
          advanceMode={advanceMode}
          onAdvanceModeChange={setAdvanceMode}
          advancePerGroup={advancePerGroup}
          onAdvancePerGroupChange={setAdvancePerGroup}
          advanceCount={advanceCount}
          onAdvanceCountChange={setAdvanceCount}
          busy={busy}
          onGenerate={handleGenerateStage}
        />
      )}
    </main>
  );
}
