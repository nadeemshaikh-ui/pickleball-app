'use client';

import { use, useEffect, useState } from 'react';
import { getSession, getRounds, updateRoundScore, markSessionCompleted, type RoundRow, type SessionRow } from '@/lib/db';
import SessionNav from '@/components/SessionNav';
import GroupHeader from '@/components/GroupHeader';
import { ChairIcon } from '@/components/icons';
import { formatLabel } from '@/lib/formatLabel';

export default function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, [string, string]>>({});
  const [savingCourtId, setSavingCourtId] = useState<string | null>(null);

  function firstIncompleteRound(r: RoundRow[]): number | undefined {
    return [...new Set(r.map(x => x.round_number))]
      .sort((a, b) => a - b)
      .find(rn => r.filter(x => x.round_number === rn).some(x => x.score_a === null));
  }

  async function reload() {
    const [s, r] = await Promise.all([getSession(id), getRounds(id)]);
    setSession(s);
    setRounds(r);
  }

  useEffect(() => {
    reload();
  }, [id]);

  const roundNumbers = [...new Set(rounds.map(r => r.round_number))].sort((a, b) => a - b);
  const currentRoundNumber = firstIncompleteRound(rounds);

  function draftFor(court: RoundRow): [string, string] {
    return drafts[court.id] ?? [court.score_a?.toString() ?? '', court.score_b?.toString() ?? ''];
  }

  async function handleSaveCourt(court: RoundRow) {
    const [a, b] = draftFor(court);
    if (a === '' || b === '') return;
    setSavingCourtId(court.id);
    await updateRoundScore(court.id, Number(a), Number(b));
    const updatedRounds = await getRounds(id);
    setRounds(updatedRounds);
    setSavingCourtId(null);
    if (firstIncompleteRound(updatedRounds) === undefined) {
      await markSessionCompleted(id);
    }
  }

  return (
    <>
      <main className="page">
        {session && <GroupHeader groupName={session.group_name} logoUrl1={session.logo_url_1} logoUrl2={session.logo_url_2} />}
        <h1>Live Scoring</h1>
        <p style={{ color: 'var(--muted)', marginTop: 4 }}>
          Round {currentRoundNumber ?? session?.round_count ?? '—'} of {session?.round_count ?? '…'} — tap a score box to enter, it saves automatically
        </p>

        {roundNumbers.map(roundNumber => {
          const courts = rounds.filter(r => r.round_number === roundNumber).sort((a, b) => a.court - b.court);
          const isDone = courts.every(c => c.score_a !== null && c.score_b !== null);
          const isCurrent = roundNumber === currentRoundNumber;
          const sameSitOut =
            courts.length === 2 &&
            JSON.stringify([...courts[0].sitting_out].sort()) === JSON.stringify([...courts[1].sitting_out].sort());

          return (
            <div key={roundNumber} className={`round-card ${isCurrent ? 'is-current' : ''} ${isDone ? 'is-done' : ''}`}>
              <div className="round-card-header">
                <span className="round-label">Round {roundNumber}</span>
                <span className={`round-status-badge ${isDone ? '' : 'pending'}`}>
                  {isDone ? 'Done' : 'Pending'}
                </span>
              </div>

              {courts.map(court => {
                const [scoreA, scoreB] = draftFor(court);
                const aWins = court.score_a !== null && court.score_b !== null && court.score_a > court.score_b;
                const bWins = court.score_a !== null && court.score_b !== null && court.score_b > court.score_a;
                return (
                  <div key={court.id} className="match-box">
                    <span className="court-label-big">COURT {session?.court_labels?.[court.court - 1] ?? court.court}</span>
                    <div className="match-teams-row">
                      <div className={`team-box ${aWins ? 'winner' : ''}`}>
                        <div className="team-names">{court.team_a.join(' & ')}</div>
                        <input
                          className="score-input"
                          type="number"
                          inputMode="numeric"
                          aria-label={`${court.team_a.join(' & ')} score, court ${court.court}, round ${roundNumber}`}
                          value={scoreA}
                          onChange={e => setDrafts(prev => ({ ...prev, [court.id]: [e.target.value, draftFor(court)[1]] }))}
                          onBlur={() => handleSaveCourt(court)}
                        />
                      </div>
                      <span className="vs-pill">VS</span>
                      <div className={`team-box ${bWins ? 'winner' : ''}`}>
                        <div className="team-names">{court.team_b.join(' & ')}</div>
                        <input
                          className="score-input"
                          type="number"
                          inputMode="numeric"
                          aria-label={`${court.team_b.join(' & ')} score, court ${court.court}, round ${roundNumber}`}
                          value={scoreB}
                          onChange={e => setDrafts(prev => ({ ...prev, [court.id]: [draftFor(court)[0], e.target.value] }))}
                          onBlur={() => handleSaveCourt(court)}
                        />
                      </div>
                      {savingCourtId === court.id && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Saving…</span>}
                    </div>
                    {!sameSitOut && court.sitting_out.length > 0 && (
                      <div className="resting-badge">
                        <span className="stat-icon"><ChairIcon size={20} /></span>
                        Resting: {court.sitting_out.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}

              {sameSitOut && courts[0]?.sitting_out.length > 0 && (
                <div className="resting-badge">
                  <span className="stat-icon"><ChairIcon size={20} /></span>
                  Resting: {courts[0].sitting_out.join(', ')}
                </div>
              )}
              {session && (
                <div className="meta-bar">
                  <span>ROUND {roundNumber}</span>
                  <span>COURT {session.court_labels.join('/')}</span>
                  <span>
                    {session.round_duration_minutes
                      ? `${session.round_duration_minutes} MIN`
                      : new Date(session.created_at).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}
                  </span>
                  <span>{formatLabel(session.format).toUpperCase()}</span>
                </div>
              )}
            </div>
          );
        })}
      </main>
      <SessionNav sessionId={id} />
    </>
  );
}
