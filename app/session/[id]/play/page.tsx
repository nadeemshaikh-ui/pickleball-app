'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, getRounds, updateRoundScore, markSessionCompleted, type RoundRow, type SessionRow } from '@/lib/db';

export default function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [activeRoundNumber, setActiveRoundNumber] = useState(1);
  const [scoreInputs, setScoreInputs] = useState<Record<number, [string, string]>>({});

  function firstIncompleteRound(r: RoundRow[]): number | undefined {
    return [...new Set(r.map(x => x.round_number))]
      .sort((a, b) => a - b)
      .find(rn => r.filter(x => x.round_number === rn).some(x => x.score_a === null));
  }

  async function reload() {
    const [s, r] = await Promise.all([getSession(id), getRounds(id)]);
    setSession(s);
    setRounds(r);
    setActiveRoundNumber(firstIncompleteRound(r) ?? 1);
  }

  useEffect(() => {
    reload();
  }, [id]);

  const roundNumbers = [...new Set(rounds.map(r => r.round_number))].sort((a, b) => a - b);

  async function handleSaveRound(roundNumber: number) {
    const courts = rounds.filter(r => r.round_number === roundNumber);
    for (const court of courts) {
      const input = scoreInputs[court.court];
      if (!input || input[0] === '' || input[1] === '') continue;
      await updateRoundScore(court.id, Number(input[0]), Number(input[1]));
    }
    // Re-derive the next active round from actual data rather than blindly
    // incrementing — otherwise editing a past round (via "jump to a round")
    // after the session was already fully scored would incorrectly force
    // navigation forward instead of respecting the real completion state.
    const updatedRounds = await getRounds(id);
    setRounds(updatedRounds);
    const stillIncomplete = firstIncompleteRound(updatedRounds);
    if (stillIncomplete === undefined) {
      await markSessionCompleted(id);
      router.push(`/session/${id}/results`);
    } else {
      setActiveRoundNumber(stillIncomplete);
    }
  }

  const activeCourts = rounds.filter(r => r.round_number === activeRoundNumber).sort((a, b) => a.court - b.court);

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <h1>Round {activeRoundNumber} of {session?.round_count ?? '…'}</h1>

      {activeCourts.map(court => (
        <div key={court.id} style={{ marginBottom: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <div>Court {court.court}: {court.team_a.join(' & ')} vs {court.team_b.join(' & ')}</div>
          <input
            type="number"
            placeholder={`${court.team_a.join(' & ')} score`}
            defaultValue={court.score_a ?? ''}
            onChange={e =>
              setScoreInputs(prev => ({ ...prev, [court.court]: [e.target.value, prev[court.court]?.[1] ?? ''] }))
            }
            style={{ padding: 8, marginRight: 8, width: 80 }}
          />
          <input
            type="number"
            placeholder={`${court.team_b.join(' & ')} score`}
            defaultValue={court.score_b ?? ''}
            onChange={e =>
              setScoreInputs(prev => ({ ...prev, [court.court]: [prev[court.court]?.[0] ?? '', e.target.value] }))
            }
            style={{ padding: 8, width: 80 }}
          />
        </div>
      ))}

      <button
        onClick={() => handleSaveRound(activeRoundNumber)}
        style={{ padding: '16px 32px', fontSize: 18, background: '#1a5f3f', color: 'white', border: 'none', borderRadius: 8 }}
      >
        Save & Next Round
      </button>

      <h2 style={{ marginTop: 32 }}>Jump to a round to edit</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {roundNumbers.map(rn => (
          <button
            key={rn}
            onClick={() => setActiveRoundNumber(rn)}
            style={{ padding: 8, background: rn === activeRoundNumber ? '#1a5f3f' : '#eee', color: rn === activeRoundNumber ? 'white' : 'black', border: 'none', borderRadius: 4 }}
          >
            {rn}
          </button>
        ))}
      </div>
    </main>
  );
}
