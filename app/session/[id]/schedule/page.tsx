'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession, getRounds, type RoundRow, type SessionRow } from '@/lib/db';
import { formatScheduleAsText } from '@/lib/scheduleText';
import SessionNav from '@/components/SessionNav';

export default function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getSession(id).then(setSession);
    getRounds(id).then(setRounds);
  }, [id]);

  const courtLabels = session?.court_labels ?? ['1', '2'];

  const byRound = new Map<number, RoundRow[]>();
  for (const r of rounds) {
    const list = byRound.get(r.round_number) ?? [];
    list.push(r);
    byRound.set(r.round_number, list);
  }
  const sortedRoundNumbers = [...byRound.keys()].sort((a, b) => a - b);

  async function handleCopy() {
    await navigator.clipboard.writeText(formatScheduleAsText(rounds, courtLabels));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <main className="page">
        <h1>Schedule</h1>
        <button className="btn-primary" onClick={handleCopy} style={{ marginTop: 16, marginBottom: 8, width: '100%' }}>
          {copied ? 'Copied!' : 'Copy as WhatsApp text'}
        </button>
        <Link href={`/session/${id}/play`} className="btn-secondary" style={{ width: '100%', marginBottom: 20 }}>
          Start Scoring →
        </Link>

        {sortedRoundNumbers.map(roundNumber => {
          const courts = byRound.get(roundNumber)!.sort((a, b) => a.court - b.court);
          return (
            <div key={roundNumber} className="round-card">
              <div className="round-card-header">
                <span className="round-label">Round {roundNumber}</span>
              </div>
              {courts.map(c => (
                <div key={c.court} className="match-box">
                  <span className="court-label">Court {courtLabels[c.court - 1]}</span>
                  <div className="match-teams-row">
                    <div className="team-box">
                      <div className="team-names">{c.team_a.join(' & ')}</div>
                    </div>
                    <span className="vs-pill">VS</span>
                    <div className="team-box">
                      <div className="team-names">{c.team_b.join(' & ')}</div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="sitting-note">Sitting: {courts[0].sitting_out.join(', ')}</div>
            </div>
          );
        })}
      </main>
      <SessionNav sessionId={id} />
    </>
  );
}
