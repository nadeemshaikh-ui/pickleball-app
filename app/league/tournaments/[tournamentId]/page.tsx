'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Trophy, Plus, Trash2, Copy } from 'lucide-react';
import { fetchTournament, watchUrlFor, type TournamentRow } from '@/lib/tournaments';
import {
  fetchTournamentTeams,
  createTournamentTeam,
  deleteTournamentTeam,
  updateTournamentTeamSeed,
  uploadTournamentTeamLogo,
  type TournamentTeamRow,
} from '@/lib/tournamentTeams';
import { fetchStages, generateNextStage, type TournamentStageRow, type StageType } from '@/lib/tournamentStages';
import { listPlayers, type PlayerRow } from '@/lib/players';
import { isCurrentUserAdmin } from '@/lib/auth';
import { useCurrentClub } from '@/lib/useCurrentClub';

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

  async function load(clubId: string, id: string) {
    const [t, tm, st, pl] = await Promise.all([fetchTournament(id), fetchTournamentTeams(id), fetchStages(id), listPlayers(clubId)]);
    setTournament(t);
    setTeams(tm);
    setStages(st);
    setPlayers(pl);
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

  async function handleGenerateStage() {
    if (!currentClubId || !stageName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const lastStage = stages.length > 0 ? stages[stages.length - 1] : null;
      await generateNextStage(tournamentId, lastStage?.id ?? null, stageType, stageName.trim(), {
        groupCount,
        doubleHeader,
        advancePerGroup: stageType === 'group' ? 2 : undefined,
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
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Generate Next Stage</div>
          <input type="text" placeholder="Stage name (e.g. 'Group Stage', 'Semifinals')" value={stageName} onChange={e => setStageName(e.target.value)} />
          <select value={stageType} onChange={e => setStageType(e.target.value as StageType)}>
            {Object.entries(STAGE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {stageType === 'group' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              Number of groups
              <input type="number" min={2} value={groupCount} onChange={e => setGroupCount(Number(e.target.value))} style={{ width: 60 }} />
            </label>
          )}
          {(stageType === 'league' || stageType === 'group') && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={doubleHeader} onChange={e => setDoubleHeader(e.target.checked)} />
              Double Header (every matchup played twice)
            </label>
          )}
          <button className="btn-primary" onClick={handleGenerateStage} disabled={busy || !stageName.trim()}>
            Generate Stage
          </button>
        </div>
      )}
    </main>
  );
}
