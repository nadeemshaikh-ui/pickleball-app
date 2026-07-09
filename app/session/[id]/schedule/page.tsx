'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getRounds, type RoundRow } from '@/lib/db';
import { formatScheduleAsText } from '@/lib/scheduleText';

export default function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getRounds(id).then(setRounds);
  }, [id]);

  const byRound = new Map<number, RoundRow[]>();
  for (const r of rounds) {
    const list = byRound.get(r.round_number) ?? [];
    list.push(r);
    byRound.set(r.round_number, list);
  }
  const sortedRoundNumbers = [...byRound.keys()].sort((a, b) => a - b);

  async function handleCopy() {
    await navigator.clipboard.writeText(formatScheduleAsText(rounds));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <h1>Schedule</h1>
      <button
        onClick={handleCopy}
        style={{ padding: '12px 24px', fontSize: 16, marginBottom: 16, background: '#1a5f3f', color: 'white', border: 'none', borderRadius: 8 }}
      >
        {copied ? 'Copied!' : 'Copy as WhatsApp text'}
      </button>
      {sortedRoundNumbers.map(roundNumber => {
        const courts = byRound.get(roundNumber)!.sort((a, b) => a.court - b.court);
        return (
          <div key={roundNumber} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #ddd' }}>
            <strong>Round {roundNumber}</strong>
            {courts.map(c => (
              <div key={c.court}>Court {c.court}: {c.team_a.join(' & ')} vs {c.team_b.join(' & ')}</div>
            ))}
            <div>Sitting: {courts[0].sitting_out.join(', ')}</div>
          </div>
        );
      })}
      <Link href={`/session/${id}/play`}>Start Scoring →</Link>
    </main>
  );
}
