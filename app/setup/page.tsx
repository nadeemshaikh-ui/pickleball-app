'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateScrambleSchedule, generateSquadRivalrySchedule } from '@/lib/shuffle';
import { createSession, insertRounds } from '@/lib/db';

export default function SetupPage() {
  const router = useRouter();
  const [names, setNames] = useState<string[]>(Array(10).fill(''));
  const [format, setFormat] = useState<'scramble' | 'squad_rivalry'>('scramble');
  const [roundCount, setRoundCount] = useState(12);
  const [courtLabels, setCourtLabels] = useState<[string, string]>(['1', '2']);
  const [roundDurationMinutes, setRoundDurationMinutes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateName(index: number, value: string) {
    const copy = [...names];
    copy[index] = value;
    setNames(copy);
  }

  async function handleGenerate() {
    setError(null);
    const trimmed = names.map(n => n.trim());
    if (trimmed.some(n => n.length === 0)) {
      setError('All 10 player names are required.');
      return;
    }
    if (new Set(trimmed).size !== 10) {
      setError('Player names must be unique.');
      return;
    }
    const trimmedCourtLabels: [string, string] = [courtLabels[0].trim(), courtLabels[1].trim()];
    if (trimmedCourtLabels[0] === '' || trimmedCourtLabels[1] === '') {
      setError('Both court numbers/names are required.');
      return;
    }
    const parsedDuration = roundDurationMinutes.trim() === '' ? null : Number(roundDurationMinutes);
    if (parsedDuration !== null && (!Number.isFinite(parsedDuration) || parsedDuration <= 0)) {
      setError('Minutes per round must be a positive number, or left blank.');
      return;
    }
    setSubmitting(true);
    try {
      const seed = `${Date.now()}`;
      if (format === 'scramble') {
        const rounds = generateScrambleSchedule(trimmed, roundCount, seed);
        const sessionId = await createSession(trimmed, 'scramble', roundCount, null, trimmedCourtLabels, parsedDuration);
        await insertRounds(sessionId, rounds);
        router.push(`/session/${sessionId}/schedule`);
      } else {
        const { squads, rounds } = generateSquadRivalrySchedule(trimmed, roundCount, seed);
        const sessionId = await createSession(trimmed, 'squad_rivalry', roundCount, squads, trimmedCourtLabels, parsedDuration);
        await insertRounds(sessionId, rounds);
        router.push(`/session/${sessionId}/schedule`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create session.');
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <h1>Session Setup</h1>

      <h2>Players (10)</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {names.map((name, i) => (
          <input
            key={i}
            value={name}
            onChange={e => updateName(i, e.target.value)}
            placeholder={`Player ${i + 1}`}
            style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
          />
        ))}
      </div>

      <h2>Format</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="radio" checked={format === 'scramble'} onChange={() => setFormat('scramble')} />
          <span>Scramble — random partners every round</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="radio" checked={format === 'squad_rivalry'} onChange={() => setFormat('squad_rivalry')} />
          <span>Squad Rivalry — 2 fixed squads all night</span>
        </label>
      </div>

      <h2>Court Numbers</h2>
      <div className="card" style={{ display: 'flex', gap: 12 }}>
        <input
          value={courtLabels[0]}
          onChange={e => setCourtLabels([e.target.value, courtLabels[1]])}
          placeholder="Court 1 (e.g. 5)"
          aria-label="Court 1 number or name"
          style={{ flex: 1, minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
        />
        <input
          value={courtLabels[1]}
          onChange={e => setCourtLabels([courtLabels[0], e.target.value])}
          placeholder="Court 2 (e.g. 12)"
          aria-label="Court 2 number or name"
          style={{ flex: 1, minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
        />
      </div>

      <h2>Rounds</h2>
      <input
        type="number"
        value={roundCount}
        onChange={e => setRoundCount(Number(e.target.value))}
        min={1}
        style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 100, border: '1px solid var(--border)', borderRadius: 8, background: 'white' }}
      />

      <h2>Minutes per Round (optional)</h2>
      <input
        type="number"
        value={roundDurationMinutes}
        onChange={e => setRoundDurationMinutes(e.target.value)}
        min={1}
        placeholder="e.g. 10"
        aria-label="Minutes per round, optional"
        style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 100, border: '1px solid var(--border)', borderRadius: 8, background: 'white' }}
      />

      {error && <p style={{ color: 'var(--danger)', marginTop: 12, fontWeight: 600 }}>{error}</p>}

      <button className="btn-primary" onClick={handleGenerate} disabled={submitting} style={{ width: '100%', marginTop: 20 }}>
        {submitting ? 'Generating…' : 'Generate Schedule'}
      </button>
    </main>
  );
}
