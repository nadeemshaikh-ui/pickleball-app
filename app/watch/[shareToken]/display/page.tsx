'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { fetchPublicTournament, type PublicTournamentData, type PublicTeam } from '@/lib/tournamentPublic';

const POLL_INTERVAL_MS = 5000;

// TV/projector-optimized view of a tournament — one big screen at the venue,
// not a phone-in-hand spectator page (that's /watch/[shareToken]). Same
// anon-safe data source (fetchPublicTournament), different layout: large
// text, groups with paired team names front and center, live courts called
// out, no registration form or per-stage fixture lists.
export default function TournamentDisplayPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [data, setData] = useState<PublicTournamentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function load() {
      fetchPublicTournament(shareToken)
        .then(d => (d ? setData(d) : setError('Tournament not found — check the share link.')))
        .catch(e => setError(e instanceof Error ? e.message : 'Failed to load tournament.'));
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [shareToken]);

  if (error) return <main style={{ padding: 40, fontSize: 24, color: '#f87171' }}>{error}</main>;
  if (!data) return <main style={{ padding: 40, fontSize: 24, color: '#e5e5e5' }}>Loading…</main>;

  const teamNames = new Map(data.teams.map(t => [t.id, t] as [string, PublicTeam]));

  // "Current" stage: the last one still in progress, falling back to the
  // most recently created stage if every stage is done (or none started).
  const sortedStages = [...data.stages].sort((a, b) => a.stageOrder - b.stageOrder);
  const currentStage = sortedStages.find(s => s.status !== 'completed') ?? sortedStages[sortedStages.length - 1] ?? null;

  const currentStageMatches = currentStage ? data.matches.filter(m => m.stageId === currentStage.id) : [];

  // Teams don't carry a groupLabel themselves — derive team -> group from
  // the first match in the current stage that involves each team.
  const groupOf = new Map<string, string>();
  for (const m of currentStageMatches) {
    if (m.groupLabel) {
      if (m.teamAId && !groupOf.has(m.teamAId)) groupOf.set(m.teamAId, m.groupLabel);
      if (m.teamBId && !groupOf.has(m.teamBId)) groupOf.set(m.teamBId, m.groupLabel);
    }
  }
  const groups = new Map<string, PublicTeam[]>();
  for (const team of data.teams) {
    const label = groupOf.get(team.id);
    if (!label) continue;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(team);
  }
  const sortedGroupLabels = [...groups.keys()].sort();

  const liveMatches = data.matches
    .filter(m => m.status === 'in_progress')
    .map(m => ({ ...m, teamA: m.teamAId ? teamNames.get(m.teamAId) : null, teamB: m.teamBId ? teamNames.get(m.teamBId) : null }));

  return (
    <main style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f5f5f5', padding: '32px 48px', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 42, fontWeight: 800, margin: 0 }}>
          <Trophy size={40} /> {data.tournament.name}
        </h1>
        <Link href={`/watch/${shareToken}`} style={{ color: '#a3a3a3', fontSize: 16 }}>Spectator view →</Link>
      </div>

      {liveMatches.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, textTransform: 'uppercase', letterSpacing: 1.5, color: '#a3a3a3', marginBottom: 12 }}>On Court Now</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {liveMatches.map(m => (
              <div key={m.id} style={{ background: '#171717', border: '2px solid #22c55e', borderRadius: 14, padding: 20 }}>
                {m.courtLabel && (
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', marginBottom: 8, textTransform: 'uppercase' }}>{m.courtLabel}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 22, fontWeight: 700 }}>
                  <span>{m.teamA?.name ?? 'TBD'}</span>
                  <span style={{ color: '#a3a3a3' }}>{m.scoreA ?? '–'} : {m.scoreB ?? '–'}</span>
                  <span>{m.teamB?.name ?? 'TBD'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {currentStage && (
        <section>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{currentStage.name}</h2>
          <p style={{ fontSize: 14, color: '#a3a3a3', textTransform: 'capitalize', marginBottom: 20 }}>{currentStage.status}</p>

          {sortedGroupLabels.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sortedGroupLabels.length, 4)}, 1fr)`, gap: 20 }}>
              {sortedGroupLabels.map(label => (
                <div key={label} style={{ background: '#171717', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12, color: '#facc15' }}>Group {label}</div>
                  {groups.get(label)!.map(team => (
                    <div key={team.id} style={{ padding: '8px 0', borderTop: '1px solid #262626' }}>
                      <div style={{ fontSize: 17, fontWeight: 700 }}>{team.name}</div>
                      <div style={{ fontSize: 13, color: '#a3a3a3' }}>{team.playerNames.join(' & ')}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {data.teams.map(team => (
                <div key={team.id} style={{ background: '#171717', borderRadius: 14, padding: '16px 20px', minWidth: 220 }}>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{team.name}</div>
                  <div style={{ fontSize: 13, color: '#a3a3a3' }}>{team.playerNames.join(' & ')}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {!currentStage && (
        <p style={{ fontSize: 18, color: '#a3a3a3' }}>No stages generated yet.</p>
      )}
    </main>
  );
}
