'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  generateScrambleSchedule,
  generateSquadRivalrySchedule,
  generateCourtBlocksSchedule,
  type CourtBlockAssignment,
} from '@/lib/shuffle';
import { createSession, insertRounds, uploadGroupLogo } from '@/lib/db';

type Format = 'scramble' | 'squad_rivalry' | 'court_blocks';

export default function SetupPage() {
  const router = useRouter();

  const [playerCount, setPlayerCount] = useState(10);
  const [namesEntered, setNamesEntered] = useState(false);
  const [names, setNames] = useState<string[]>(Array(10).fill(''));

  const [format, setFormat] = useState<Format>('scramble');
  const [roundCount, setRoundCount] = useState(12);
  const [courtLabels, setCourtLabels] = useState<[string, string]>(['1', '2']);
  const [roundDurationMinutes, setRoundDurationMinutes] = useState('');

  const [roundsPerBlock, setRoundsPerBlock] = useState(6);
  const [swapCount, setSwapCount] = useState(2);
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto');
  const [manualBlocks, setManualBlocks] = useState<string[][]>([]); // per block: array of names picked for Court A

  const [groupName, setGroupName] = useState('');
  const [logo1File, setLogo1File] = useState<File | null>(null);
  const [logo2File, setLogo2File] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePlayerCountConfirm() {
    if (playerCount < 8 || playerCount % 2 !== 0) {
      setError('Player count must be even and at least 8.');
      return;
    }
    setError(null);
    setNames(Array(playerCount).fill(''));
    setNamesEntered(true);
  }

  function updateName(index: number, value: string) {
    const copy = [...names];
    copy[index] = value;
    setNames(copy);
  }

  const blockCount = format === 'court_blocks' ? swapCount : 0;
  const half = Math.floor(playerCount / 2);

  function toggleManualBlockPlayer(blockIndex: number, name: string) {
    setManualBlocks(prev => {
      const copy = prev.map(b => [...b]);
      while (copy.length <= blockIndex) copy.push([]);
      const block = copy[blockIndex];
      const idx = block.indexOf(name);
      if (idx >= 0) {
        block.splice(idx, 1);
      } else if (block.length < half) {
        block.push(name);
      }
      return copy;
    });
  }

  async function handleGenerate() {
    setError(null);
    const trimmed = names.map(n => n.trim());
    if (trimmed.some(n => n.length === 0)) {
      setError('All player names are required.');
      return;
    }
    if (new Set(trimmed).size !== trimmed.length) {
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

    if (format === 'court_blocks') {
      if (assignmentMode === 'manual') {
        for (let b = 0; b < blockCount; b++) {
          if ((manualBlocks[b]?.length ?? 0) !== half) {
            setError(`Block ${b + 1}: pick exactly ${half} players for Court A.`);
            return;
          }
        }
      }
    }

    setSubmitting(true);
    try {
      const seed = `${Date.now()}`;
      let logoUrl1: string | null = null;
      let logoUrl2: string | null = null;
      if (logo1File) logoUrl1 = await uploadGroupLogo(logo1File);
      if (logo2File) logoUrl2 = await uploadGroupLogo(logo2File);

      const baseOptions = {
        players: trimmed,
        courtLabels: trimmedCourtLabels,
        roundDurationMinutes: parsedDuration,
        groupName: groupName.trim() || null,
        logoUrl1,
        logoUrl2,
      };

      let sessionId: string;
      if (format === 'scramble') {
        const rounds = generateScrambleSchedule(trimmed, roundCount, seed);
        sessionId = await createSession({
          ...baseOptions,
          format: 'scramble',
          roundCount,
          squads: null,
          roundsPerBlock: null,
        });
        await insertRounds(sessionId, rounds);
      } else if (format === 'squad_rivalry') {
        const { squads, rounds } = generateSquadRivalrySchedule(trimmed, roundCount, seed);
        sessionId = await createSession({
          ...baseOptions,
          format: 'squad_rivalry',
          roundCount,
          squads,
          roundsPerBlock: null,
        });
        await insertRounds(sessionId, rounds);
      } else {
        const manualAssignments: CourtBlockAssignment[] | undefined =
          assignmentMode === 'manual'
            ? manualBlocks.slice(0, blockCount).map(courtA => ({
                courtA,
                courtB: trimmed.filter(p => !courtA.includes(p)),
              }))
            : undefined;
        const { rounds } = generateCourtBlocksSchedule(trimmed, roundsPerBlock, blockCount, seed, manualAssignments);
        sessionId = await createSession({
          ...baseOptions,
          format: 'court_blocks',
          roundCount: roundsPerBlock * blockCount,
          squads: null,
          roundsPerBlock,
        });
        await insertRounds(sessionId, rounds);
      }
      router.push(`/session/${sessionId}/schedule`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create session.');
      setSubmitting(false);
    }
  }

  if (!namesEntered) {
    return (
      <main className="page">
        <h1>Session Setup</h1>
        <h2>How Many Players?</h2>
        <div className="card">
          <input
            type="number"
            value={playerCount}
            onChange={e => setPlayerCount(Number(e.target.value))}
            min={8}
            step={2}
            aria-label="Number of players"
            style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 100, border: '1px solid var(--border)', borderRadius: 8 }}
          />
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>Even number, at least 8 (2 courts × 4 players).</p>
        </div>
        {error && <p style={{ color: 'var(--danger)', marginTop: 12, fontWeight: 600 }}>{error}</p>}
        <button className="btn-primary" onClick={handlePlayerCountConfirm} style={{ width: '100%', marginTop: 20 }}>
          Next: Enter Names
        </button>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Session Setup</h1>

      <h2>Players ({playerCount})</h2>
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
      <button
        className="btn-secondary"
        onClick={() => setNamesEntered(false)}
        style={{ marginTop: 8, marginBottom: 4 }}
      >
        ← Change Player Count
      </button>

      <h2>Group Branding (optional)</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
          placeholder="Group name (e.g. Sunday Smashers)"
          aria-label="Group name"
          style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
        />
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Logo 1</label>
          <input type="file" accept="image/*" aria-label="Logo 1" onChange={e => setLogo1File(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>Logo 2</label>
          <input type="file" accept="image/*" aria-label="Logo 2" onChange={e => setLogo2File(e.target.files?.[0] ?? null)} />
        </div>
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="radio" checked={format === 'court_blocks'} onChange={() => setFormat('court_blocks')} />
          <span>Court Swap — same 5 on your court, swap groups every hour</span>
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

      {format !== 'court_blocks' && (
        <>
          <h2>Rounds</h2>
          <input
            type="number"
            value={roundCount}
            onChange={e => setRoundCount(Number(e.target.value))}
            min={1}
            style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 100, border: '1px solid var(--border)', borderRadius: 8, background: 'white' }}
          />
        </>
      )}

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

      {format === 'court_blocks' && (
        <>
          <h2>How Many Times Do You Swap?</h2>
          <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                Number of swaps
              </label>
              <input
                type="number"
                value={swapCount}
                onChange={e => setSwapCount(Number(e.target.value))}
                min={1}
                aria-label="Number of swaps"
                style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 80, border: '1px solid var(--border)', borderRadius: 8 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                Rounds before each swap
              </label>
              <input
                type="number"
                value={roundsPerBlock}
                onChange={e => setRoundsPerBlock(Number(e.target.value))}
                min={1}
                aria-label="Rounds per swap"
                style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 80, border: '1px solid var(--border)', borderRadius: 8 }}
              />
            </div>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>
            = {roundsPerBlock * swapCount} rounds total, swapping courts {swapCount} time{swapCount === 1 ? '' : 's'}.
          </p>

          <h2>Who Picks the Groups?</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="radio" checked={assignmentMode === 'auto'} onChange={() => setAssignmentMode('auto')} />
              <span>App decides (recommended)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="radio" checked={assignmentMode === 'manual'} onChange={() => setAssignmentMode('manual')} />
              <span>I&apos;ll pick manually</span>
            </label>
          </div>

          {assignmentMode === 'manual' &&
            Array.from({ length: blockCount }, (_, blockIndex) => (
              <div key={blockIndex} className="card" style={{ marginTop: 12 }}>
                <strong>Swap {blockIndex + 1} — Court {courtLabels[0]} (pick {half})</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {names.filter(n => n.trim()).map(name => {
                    const selected = manualBlocks[blockIndex]?.includes(name) ?? false;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleManualBlockPlayer(blockIndex, name)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 999,
                          border: '1px solid var(--border)',
                          background: selected ? 'var(--primary)' : 'white',
                          color: selected ? 'white' : 'var(--foreground)',
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                  Court {courtLabels[1]} gets the rest automatically ({half} players).
                </p>
              </div>
            ))}
        </>
      )}

      {error && <p style={{ color: 'var(--danger)', marginTop: 12, fontWeight: 600 }}>{error}</p>}

      <button className="btn-primary" onClick={handleGenerate} disabled={submitting} style={{ width: '100%', marginTop: 20 }}>
        {submitting ? 'Generating…' : 'Generate Schedule'}
      </button>
    </main>
  );
}
