'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession, getRounds, type RoundRow, type SessionRow } from '@/lib/db';
import { validateManualPairings } from '@/lib/teamChampionship';
import SessionNav from '@/components/SessionNav';

// Team Championship's pairing entry landing page — purely a stage
// directory now. Real feedback: stages must be fully separate pages, and
// nothing about a later stage should even exist until that stage begins.
// Generation (Suggested Pairings / Manual) used to happen here for all 15
// rounds at once — moved into each stage page
// (team-championship/stage/[stageIndex]), triggered only when that stage
// is actually opened. This page just links into stage 1/2/3 and shows
// tournament-wide validation warnings once some rounds exist.
export default function TeamChampionshipPairingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [s, r] = await Promise.all([getSession(id), getRounds(id)]);
    setSession(s);
    setRounds(r);
  }

  useEffect(() => {
    load()
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load session.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (error && !session) return <main className="page"><p style={{ color: 'var(--danger)' }}>{error}</p></main>;
  if (!session) return <main className="page"><p>Session not found.</p></main>;
  if (session.format !== 'team_championship' || !session.squads || !session.stage_config) {
    return <main className="page"><p>This session isn&apos;t a Team Championship, or is missing its team/stage setup.</p></main>;
  }

  const teams = session.squads;
  const stages = session.stage_config;
  const rosterByTeam = teams.map(t => ({ id: t.id, label: t.label ?? t.id, players: t.players }));

  const warnings =
    rounds.length > 0
      ? validateManualPairings(
          rounds.map(r => ({ roundNumber: r.round_number, teamA: r.team_a, teamB: r.team_b })),
          teams,
          stages,
          session.court_labels.length || 1
        )
      : [];

  return (
    <>
    <main className="page">
      <div className="page-header-row">
        <Link href={`/session/${id}/schedule`} className="text-link-btn">← Schedule</Link>
      </div>
      <h1>Round Pairings</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        {rosterByTeam[0]?.label} vs {rosterByTeam[1]?.label}
      </p>

      {error && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</p>}

      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
        {session.court_labels.length} court{session.court_labels.length === 1 ? '' : 's'} available
      </p>

      {warnings.length > 0 && (
        <details className="card" style={{ marginBottom: 16, borderColor: 'var(--warning, #b45309)' }}>
          <summary style={{ fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            ⚠️ {warnings.length} pairing warning{warnings.length === 1 ? '' : 's'} — not blocking, tap to review
          </summary>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
            {(['repeat_partner', 'missing_partner', 'play_count'] as const).map(type => {
              const count = warnings.filter(w => w.type === type).length;
              if (count === 0) return null;
              const typeLabel = type === 'repeat_partner' ? 'Repeat partners' : type === 'missing_partner' ? 'Never partnered' : 'Uneven play count';
              return (
                <p key={type} style={{ margin: 0, fontWeight: 700 }}>
                  {typeLabel}: {count}
                </p>
              );
            })}
          </div>
          <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--muted)', maxHeight: 300, overflowY: 'auto' }}>
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </details>
      )}

      <h2 style={{ marginTop: 8 }}>Stages</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {stages.map((stage, stageIdx) => {
          const stageIndex = stageIdx + 1;
          const stageRounds = rounds.filter(r => r.round_number >= stage.roundStart && r.round_number <= stage.roundEnd);
          const scoredCount = stageRounds.filter(r => r.score_a !== null && r.score_b !== null).length;
          return (
            <Link
              key={stage.stageLabel}
              href={`/session/${id}/team-championship/stage/${stageIndex}`}
              className="card"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{stage.stageLabel}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Rounds {stage.roundStart}–{stage.roundEnd} · {stage.pointsPerWin} pt/win ·{' '}
                  {stageRounds.length === 0 ? 'Not generated yet' : `${scoredCount}/${stageRounds.length} scored`}
                </div>
              </div>
              <span style={{ fontSize: 20 }}>→</span>
            </Link>
          );
        })}
      </div>

      {rounds.length > 0 && (
        <div className="card" style={{ marginTop: 20, textAlign: 'center' }}>
          <Link href={`/session/${id}/schedule`} className="btn-primary" style={{ display: 'inline-block' }}>
            Continue to Schedule →
          </Link>
        </div>
      )}
    </main>
    <SessionNav sessionId={id} format="team_championship" clubId={session?.club_id} stageCount={session?.stage_config?.length} />
    </>
  );
}
