'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Trophy, Plus, Trash2, Copy, Sparkles, UserPlus, KeyRound } from 'lucide-react';
import { fetchTournament, watchUrlFor, type TournamentRow } from '@/lib/tournaments';
import {
  fetchTournamentRegistrations,
  withdrawTournamentRegistration,
  setTournamentRegistrationOpen,
  setTournamentSlotCount,
  type TournamentRegistrationRow,
} from '@/lib/tournamentRegistration';
import { fetchCourtScorerCodes, createCourtScorerCode, setTournamentSelfScore, type CourtScorerCodeRow } from '@/lib/tournamentScorers';
import {
  fetchTournamentTeams,
  createTournamentTeam,
  deleteTournamentTeam,
  updateTournamentTeamSeed,
  uploadTournamentTeamLogo,
  type TournamentTeamRow,
} from '@/lib/tournamentTeams';
import { fetchStages, generateNextStage, deleteStage, type TournamentStageRow, type StageType } from '@/lib/tournamentStages';
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
  double_elimination: 'Double Elimination',
};

export default function TournamentDetailPage() {
  return (
    <Suspense fallback={<main className="page"><p>Loading…</p></main>}>
      <TournamentDetailPageInner />
    </Suspense>
  );
}

function TournamentDetailPageInner() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const searchParams = useSearchParams();
  const isMystery = searchParams.get('mystery') === '1';
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [tournament, setTournament] = useState<TournamentRow | null>(null);
  const [teams, setTeams] = useState<TournamentTeamRow[]>([]);
  const [stages, setStages] = useState<TournamentStageRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // "Form Teams" is one unified screen (industry-standard pattern: an
  // instant one-click auto-pair for everyone remaining, plus tap-to-pair
  // for manual overrides) rather than a mode-select gate — no reason a
  // small pool should force a modal choice before doing anything.
  const [manualPick1, setManualPick1] = useState('');

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

  async function handleSetSlotCount(raw: string) {
    if (!tournament) return;
    const trimmed = raw.trim();
    const next = trimmed === '' ? null : Number(trimmed);
    if (next !== null && (!Number.isInteger(next) || next < 1)) {
      setError('Slot count must be a whole number of 1 or more, or blank to turn slots off.');
      return;
    }
    if (next === tournament.slot_count) return;
    const maxClaimed = Math.max(0, ...registrations.filter(r => r.slot_number !== null).map(r => r.slot_number!));
    if (next !== null && next < maxClaimed) {
      if (!window.confirm(`Slot #${maxClaimed} is already claimed — lowering below that hides it from the public grid without freeing it. Continue?`)) return;
    }
    setBusy(true);
    setError(null);
    try {
      await setTournamentSlotCount(tournament.id, next);
      setTournament({ ...tournament, slot_count: next });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update slot count.');
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

  async function handleToggleSelfScore() {
    if (!tournament) return;
    setBusy(true);
    setError(null);
    try {
      await setTournamentSelfScore(tournament.id, !tournament.self_score_enabled);
      setTournament({ ...tournament, self_score_enabled: !tournament.self_score_enabled });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update self-score setting.');
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

  // Manual mode's sequential flow: tap a player, tap a second, team is
  // created immediately and the picker resets for "Team N+1" — no name
  // field, no dropdowns, matches the same tap-to-select pattern the
  // Mystery Draw pool already uses below.
  async function handleManualAddPair(p1: string, p2: string) {
    if (!currentClubId) return;
    setBusy(true);
    setError(null);
    try {
      await createTournamentTeam({ tournamentId, name: `Team ${teams.length + 1}`, playerNames: [p1, p2] });
      setManualPick1('');
      setTeams(await fetchTournamentTeams(tournamentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add team.');
    } finally {
      setBusy(false);
    }
  }

  function handleManualChipClick(name: string) {
    if (!manualPick1) {
      setManualPick1(name);
      return;
    }
    if (name === manualPick1) {
      setManualPick1('');
      return;
    }
    handleManualAddPair(manualPick1, name);
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


  async function handleMysteryDraw(explicitPool?: string[]) {
    const pool = explicitPool ?? [...mysteryPool];
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

  async function handleRegenerateStage(stageId: string) {
    if (!window.confirm('Delete this stage and its matches? Only works if nothing has been scored yet.')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteStage(stageId);
      setStages(await fetchStages(tournamentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete stage.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateStage() {
    if (!stageName.trim()) {
      setError('Name this stage before generating it (e.g. "Group Stage", "Quarterfinals").');
      return;
    }
    if (!currentClubId) {
      setError('Lost track of which club this is — refresh the page and try again.');
      return;
    }
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
        <Link href="/tournaments" className="text-link-btn">← Tournaments</Link>
        <button className="icon-btn" aria-label="Copy spectator link" onClick={copyWatchLink}>
          <Copy size={16} />
        </button>
      </div>

      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={22} /> {tournament.name}</h1>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>{error}</p>}

      <h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><UserPlus size={18} /> Registrations ({registrations.filter(r => r.status !== 'withdrawn').length})</h2>
      <div className="card" style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={tournament.registration_open} onChange={handleToggleRegistration} disabled={busy} />
          Registration open — anyone with the spectator link can sign up
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: registrations.length > 0 ? 10 : 0 }}>
          Numbered slots
          <input
            type="number"
            min={1}
            placeholder="Off — free-form names"
            defaultValue={tournament.slot_count ?? ''}
            onBlur={e => handleSetSlotCount(e.target.value)}
            disabled={busy}
            style={{ width: 160 }}
          />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>set a count to switch from free-form names to numbered claimable slots</span>
        </label>
        {registrations.filter(r => r.status !== 'withdrawn').map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px solid var(--border)' }}>
            <span style={{ flex: 1, fontSize: 13 }}>
              {r.slot_number !== null && <strong>#{r.slot_number} </strong>}
              {r.registrant_name}{r.partner_name ? ` & ${r.partner_name}` : ''}
            </span>
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={tournament.self_score_enabled} onChange={handleToggleSelfScore} disabled={busy} />
          Let anyone self-score — no code needed. Unlike court codes, this covers every match (not just one court) and can only be turned off, not revoked per person.
        </label>
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

      <h2>{isMystery ? 'Step 1: Teams' : 'Teams'}</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {teams.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No teams yet.</p>}
        {teams.length > 0 && (
          <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>
            Seed is optional — it only affects tiebreakers and bracket placement (lower number = seeded higher). Leave blank to skip it.
          </p>
        )}
        {teams.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, flex: 1 }}>{t.name}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t.player_names.join(' & ')}</span>
            {isAdmin && (
              <>
                <input
                  type="number"
                  placeholder="Seed"
                  title="Optional. Ranks this team for tiebreakers and bracket placement — lower number seeds higher. Leave blank if you don't need manual seeding."
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
      </div>

      {isAdmin && (() => {
        const alreadyOnATeam = new Set(teams.flatMap(t => t.player_names));
        const candidates = players.filter(p => !alreadyOnATeam.has(p.name));
        if (candidates.length === 0) return null;
        const oddCount = candidates.length % 2 !== 0;
        return (
          <>
            <h2>Form Teams</h2>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <button
                className="btn-primary"
                onClick={() => handleMysteryDraw(candidates.filter(p => p.name !== byePlayer).map(p => p.name))}
                disabled={drawing || candidates.length < 2 || (oddCount && !byePlayer)}
              >
                {drawing && drawProgress ? `Pairing… ${drawProgress.done}/${drawProgress.total}` : `Auto-Pair All ${candidates.length} Remaining`}
              </button>
              {oddCount && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  Odd number left ({candidates.length}) — who sits out this round?
                  <select value={byePlayer} onChange={e => setByePlayer(e.target.value)} disabled={drawing}>
                    <option value="">Choose a bye…</option>
                    {candidates.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </label>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 6px' }}>
                  {manualPick1
                    ? `${manualPick1} selected — tap their partner to pair them instead.`
                    : 'Or tap any 2 below to pair them yourself:'}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {candidates.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={manualPick1 === p.name ? 'btn-primary' : 'btn-secondary'}
                      onClick={() => handleManualChipClick(p.name)}
                      disabled={busy || drawing}
                      style={{ minHeight: 32, padding: '4px 10px', fontSize: 13 }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      <h2>Stages</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {stages.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No stages yet.</p>}
        {stages.map((s, i) => (
          <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href={`/tournaments/${tournamentId}/stage/${s.id}`} style={{ display: 'flex', justifyContent: 'space-between', flex: 1 }}>
              <span style={{ fontWeight: 700 }}>{s.name}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>{STAGE_TYPE_LABELS[s.stage_type]} · {s.status}</span>
            </Link>
            {isAdmin && i === stages.length - 1 && s.status !== 'completed' && (
              <button
                className="icon-btn"
                aria-label={`Regenerate ${s.name}`}
                title="Delete this stage and its matches (only if unscored)"
                disabled={busy}
                onClick={() => handleRegenerateStage(s.id)}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
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
