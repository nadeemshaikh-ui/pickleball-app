'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  generateScrambleSchedule,
  generateSquadRivalrySchedule,
  generateCourtBlocksSchedule,
  generateFixedPartnersSchedule,
  type CourtBlockAssignment,
  type LockedPair,
} from '@/lib/shuffle';
import { createSession, insertRounds, uploadGroupLogo, uploadPlayerPhoto } from '@/lib/db';
import { saveRoster, loadRoster } from '@/lib/savedRoster';
import { findPresetLogos } from '@/lib/presetGroups';
import { getPlayerPhoto, savePlayerPhoto } from '@/lib/playerPhotos';

type Format = 'scramble' | 'squad_rivalry' | 'court_blocks' | 'fixed_partners';

const FORMAT_INFO: Record<Format, { label: string; summary: string; example: string }> = {
  scramble: {
    label: 'Scramble — random partners every round',
    summary: 'Every round, the app reshuffles who partners with whom and which court they play on. Over the night, it balances things so everyone partners with different people roughly equally, and everyone sits out roughly the same number of times.',
    example: 'Example: Round 1 you play with Alice against Bob & Carl. Round 2 you might play with Dave against Eve & Alice. Nobody has a fixed partner — it changes every round.',
  },
  squad_rivalry: {
    label: 'Squad Rivalry — 2 fixed squads all night',
    summary: 'At the start, players are split into 2 squads (Gold vs Black) for the whole session. Every round is Gold vs Black — your partner rotates within your own squad, but you always face the other squad. A running squad score tracks who\'s winning overall.',
    example: 'Example: You\'re on Gold. Round 1 you partner with a Gold teammate against 2 Black players. Round 2 you get a different Gold partner, still facing Black. Your squad total builds up round by round.',
  },
  court_blocks: {
    label: 'Court Swap — same group on your court, swap groups every hour',
    summary: 'Players are split into groups — one group per court — for a fixed number of rounds (a "block"). Within a block you only play against/with people in your own group, rotating partners inside it. When the block ends, groups reshuffle and everyone swaps to a different court.',
    example: 'Example: Block 1 (rounds 1-6) you\'re grouped with 4 others on Court 1, rotating partners among just those 5. Block 2 (rounds 7-12), the groups reshuffle and you might end up on Court 2 with a different set of people.',
  },
  fixed_partners: {
    label: 'Fixed Partners — same partner all night',
    summary: 'Everyone gets one partner for the entire session — that never changes. Only who you\'re facing on the other side of the net rotates each round, balanced so you play against different teams roughly evenly.',
    example: 'Example: You\'re paired with Sam for the whole night. Round 1 you and Sam face Priya & Tom. Round 2 you and Sam face a different team. Your partner is always Sam.',
  },
};

export default function SetupPage() {
  const router = useRouter();

  const [playerCount, setPlayerCount] = useState(10);
  const [courtCount, setCourtCount] = useState(2);
  const [namesEntered, setNamesEntered] = useState(false);
  const [names, setNames] = useState<string[]>(Array(10).fill(''));
  const [rosterNotice, setRosterNotice] = useState<string | null>(null);
  const [photoPreviews, setPhotoPreviews] = useState<Record<number, string>>({});
  const [photoVersion, setPhotoVersion] = useState(0);

  async function handlePhotoSelect(i: number, file: File | null) {
    if (!file) return;
    const trimmedName = names[i].trim();
    if (!trimmedName) return;
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreviews(prev => ({ ...prev, [i]: previewUrl }));
    try {
      const publicUrl = await uploadPlayerPhoto(file);
      savePlayerPhoto(trimmedName, publicUrl);
      setPhotoVersion(v => v + 1);
    } catch {
      // Upload failed — local preview still shows for this session, but
      // won't persist. Not worth blocking setup over a photo.
    }
  }

  const [format, setFormat] = useState<Format>('scramble');
  const [openFormatInfo, setOpenFormatInfo] = useState<Format | null>(null);
  const [roundCount, setRoundCount] = useState(12);
  const [courtLabels, setCourtLabels] = useState<string[]>(['1', '2']);
  const [roundDurationMinutes, setRoundDurationMinutes] = useState('');
  const [startTime, setStartTime] = useState('');

  const [roundsPerBlock, setRoundsPerBlock] = useState(6);
  const [swapCount, setSwapCount] = useState(2);
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto');
  // Per block: court index (0-based) assigned to each player, or null if unassigned.
  const [manualBlocks, setManualBlocks] = useState<(number | null)[][]>([]);

  const [lockedPairs, setLockedPairs] = useState<LockedPair[]>([]);
  const [lockPickerA, setLockPickerA] = useState('');
  const [lockPickerB, setLockPickerB] = useState('');

  const trimmedNamesForLocks = names.map(n => n.trim()).filter(Boolean);
  const lockedPlayers = new Set(lockedPairs.flatMap(p => p));

  function handleAddLock() {
    if (!lockPickerA || !lockPickerB || lockPickerA === lockPickerB) return;
    setLockedPairs(prev => [...prev, [lockPickerA, lockPickerB]]);
    setLockPickerA('');
    setLockPickerB('');
  }

  function handleRemoveLock(index: number) {
    setLockedPairs(prev => prev.filter((_, i) => i !== index));
  }

  const [groupName, setGroupName] = useState('');
  const [logo1File, setLogo1File] = useState<File | null>(null);
  const [logo2File, setLogo2File] = useState<File | null>(null);
  const presetLogos = findPresetLogos(groupName);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minPlayers = courtCount * 4;
  const [savedRoster, setSavedRoster] = useState<string[] | null>(null);

  useEffect(() => {
    loadRoster().then(setSavedRoster);
  }, []);

  function resizeKeepingExisting<T>(current: T[], newLength: number, blank: T): T[] {
    const resized = Array(newLength).fill(blank) as T[];
    for (let i = 0; i < Math.min(current.length, newLength); i++) resized[i] = current[i];
    return resized;
  }

  function handlePlayerCountConfirm() {
    if (courtCount < 1) {
      setError('You need at least 1 court.');
      return;
    }
    if (playerCount < minPlayers) {
      setError(`With ${courtCount} court(s) you need at least ${minPlayers} players (4 per court).`);
      return;
    }
    setError(null);
    // Resize rather than replace — changing court/player count used to wipe
    // every name you'd already typed, which made it look like court count
    // "couldn't" be changed after the fact.
    setNames(prev => resizeKeepingExisting(prev, playerCount, ''));
    setCourtLabels(prev => resizeKeepingExisting(prev.length ? prev : ['1', '2'], courtCount, '').map((v, i) => v || `${i + 1}`));
    setNamesEntered(true);
  }

  function handleUseSavedRoster() {
    if (!savedRoster) return;
    if (savedRoster.length < minPlayers) {
      setError(`Saved roster has ${savedRoster.length} players — need at least ${minPlayers} for ${courtCount} court(s).`);
      return;
    }
    setError(null);
    setPlayerCount(savedRoster.length);
    setNames(savedRoster);
    setCourtLabels(prev => resizeKeepingExisting(prev.length ? prev : ['1', '2'], courtCount, '').map((v, i) => v || `${i + 1}`));
    setNamesEntered(true);
    setRosterNotice('Loaded your saved roster — edit any name below, or add new players.');
  }

  function updateName(index: number, value: string) {
    const copy = [...names];
    copy[index] = value;
    setNames(copy);
  }

  function updateCourtLabel(index: number, value: string) {
    setCourtLabels(prev => prev.map((v, i) => (i === index ? value : v)));
  }

  const blockCount = format === 'court_blocks' ? swapCount : 0;

  function cycleManualBlockPlayer(blockIndex: number, playerIndex: number) {
    setManualBlocks(prev => {
      const copy = prev.map(b => [...b]);
      while (copy.length <= blockIndex) copy.push(Array(playerCount).fill(null));
      const block = copy[blockIndex];
      const current = block[playerIndex];
      block[playerIndex] = current === null ? 0 : current + 1 >= courtCount ? null : current + 1;
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
    const trimmedCourtLabels = courtLabels.map(l => l.trim());
    if (trimmedCourtLabels.some(l => l === '')) {
      setError('Every court needs a number or name.');
      return;
    }
    const parsedDuration = roundDurationMinutes.trim() === '' ? null : Number(roundDurationMinutes);
    if (parsedDuration !== null && (!Number.isFinite(parsedDuration) || parsedDuration <= 0)) {
      setError('Minutes per round must be a positive number, or left blank.');
      return;
    }

    let manualAssignments: CourtBlockAssignment[] | undefined;
    if (format === 'court_blocks' && assignmentMode === 'manual') {
      manualAssignments = [];
      for (let b = 0; b < blockCount; b++) {
        const assignment = manualBlocks[b] ?? Array(playerCount).fill(null);
        if (assignment.some(c => c === null)) {
          setError(`Swap ${b + 1}: assign every player to a court.`);
          return;
        }
        const groups: string[][] = Array.from({ length: courtCount }, () => []);
        assignment.forEach((courtIndex, playerIndex) => {
          groups[courtIndex as number].push(trimmed[playerIndex]);
        });
        if (groups.some(g => g.length < 4)) {
          setError(`Swap ${b + 1}: every court needs at least 4 players.`);
          return;
        }
        manualAssignments.push({ groups });
      }
    }

    setSubmitting(true);
    try {
      const seed = `${Date.now()}`;
      let logoUrl1: string | null = logo1File ? null : presetLogos?.logo1 ?? null;
      let logoUrl2: string | null = logo2File ? null : presetLogos?.logo2 ?? null;
      if (logo1File) logoUrl1 = await uploadGroupLogo(logo1File);
      if (logo2File) logoUrl2 = await uploadGroupLogo(logo2File);

      const baseOptions = {
        players: trimmed,
        courtLabels: trimmedCourtLabels,
        roundDurationMinutes: parsedDuration,
        groupName: groupName.trim() || null,
        logoUrl1,
        logoUrl2,
        startTime: startTime.trim() || null,
      };

      let sessionId: string;
      if (format === 'scramble') {
        const rounds = generateScrambleSchedule(trimmed, courtCount, roundCount, seed, lockedPairs);
        sessionId = await createSession({
          ...baseOptions,
          format: 'scramble',
          roundCount,
          squads: null,
          roundsPerBlock: null,
        });
        await insertRounds(sessionId, rounds);
      } else if (format === 'squad_rivalry') {
        const { squads, rounds } = generateSquadRivalrySchedule(trimmed, courtCount, roundCount, seed, lockedPairs);
        sessionId = await createSession({
          ...baseOptions,
          format: 'squad_rivalry',
          roundCount,
          squads,
          roundsPerBlock: null,
        });
        await insertRounds(sessionId, rounds);
      } else if (format === 'fixed_partners') {
        const { rounds } = generateFixedPartnersSchedule(trimmed, courtCount, roundCount, seed);
        sessionId = await createSession({
          ...baseOptions,
          format: 'fixed_partners',
          roundCount,
          squads: null,
          roundsPerBlock: null,
        });
        await insertRounds(sessionId, rounds);
      } else {
        const { rounds } = generateCourtBlocksSchedule(trimmed, courtCount, roundsPerBlock, blockCount, seed, manualAssignments);
        sessionId = await createSession({
          ...baseOptions,
          format: 'court_blocks',
          roundCount: roundsPerBlock * blockCount,
          squads: null,
          roundsPerBlock,
        });
        await insertRounds(sessionId, rounds);
      }
      await saveRoster(trimmed);
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
        <h2>How Many Courts?</h2>
        <div className="card">
          <input
            type="number"
            value={courtCount}
            onChange={e => setCourtCount(Math.max(1, Number(e.target.value)))}
            min={1}
            aria-label="Number of courts"
            style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 100, border: '1px solid var(--border)', borderRadius: 8 }}
          />
        </div>
        <h2>How Many Players?</h2>
        <div className="card">
          <input
            type="number"
            value={playerCount}
            onChange={e => setPlayerCount(Number(e.target.value))}
            min={minPlayers}
            aria-label="Number of players"
            style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 100, border: '1px solid var(--border)', borderRadius: 8 }}
          />
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
            At least {minPlayers} for {courtCount} court{courtCount === 1 ? '' : 's'} (4 per court). No upper limit.
          </p>
        </div>
        {error && <p style={{ color: 'var(--danger)', marginTop: 12, fontWeight: 600 }}>{error}</p>}
        <button className="btn-primary" onClick={handlePlayerCountConfirm} style={{ width: '100%', marginTop: 20 }}>
          Next: Enter Names
        </button>
        {savedRoster && savedRoster.length > 0 && (
          <button className="btn-secondary" onClick={handleUseSavedRoster} style={{ width: '100%', marginTop: 10 }}>
            Use Saved Roster ({savedRoster.length} players)
          </button>
        )}
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Session Setup</h1>

      <h2>Players ({playerCount})</h2>
      {rosterNotice && (
        <p style={{ color: 'var(--dark)', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{rosterNotice}</p>
      )}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {names.map((name, i) => {
          const existingPhoto = name.trim() ? getPlayerPhoto(name.trim()) : null;
          const photoSrc = photoPreviews[i] ?? existingPhoto;
          void photoVersion; // re-render trigger after upload completes
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  flex: '0 0 auto',
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  background: photoSrc ? 'transparent' : '#eee',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  cursor: 'pointer',
                }}
                aria-label={`Add photo for player ${i + 1}`}
                title="Add player photo"
              >
                {photoSrc ? (
                  <img src={photoSrc} alt="" width={36} height={36} style={{ objectFit: 'cover' }} />
                ) : (
                  '📷'
                )}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => handlePhotoSelect(i, e.target.files?.[0] ?? null)}
                />
              </label>
              <input
                value={name}
                onChange={e => updateName(i, e.target.value)}
                placeholder={`Player ${i + 1}`}
                style={{ flex: 1, minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
              />
            </div>
          );
        })}
      </div>
      <button
        className="btn-secondary"
        onClick={() => setNamesEntered(false)}
        style={{ marginTop: 8, marginBottom: 4 }}
      >
        ← Change Players / Courts
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
        {presetLogos && (
          <p style={{ fontSize: 12, color: 'var(--dark)', fontWeight: 700 }}>
            ✓ Using saved logos for &quot;{groupName.trim()}&quot; — no upload needed.
          </p>
        )}
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>
            Logo 1 {presetLogos?.logo1 && '(optional — overrides saved logo)'}
          </label>
          <input type="file" accept="image/*" aria-label="Logo 1" onChange={e => setLogo1File(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>
            Logo 2 {presetLogos?.logo2 && '(optional — overrides saved logo)'}
          </label>
          <input type="file" accept="image/*" aria-label="Logo 2" onChange={e => setLogo2File(e.target.files?.[0] ?? null)} />
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)' }}>
          Tip: to reuse the same logos every week without uploading, ask for them to be hard-coded to your group name in <code>lib/presetGroups.ts</code>.
        </p>
      </div>

      <h2>Format</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(Object.keys(FORMAT_INFO) as Format[]).map(f => (
          <div key={f}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="radio" checked={format === f} onChange={() => setFormat(f)} />
              <span style={{ flex: 1 }}>{FORMAT_INFO[f].label}</span>
              <button
                type="button"
                onClick={() => setOpenFormatInfo(openFormatInfo === f ? null : f)}
                className="btn-secondary"
                style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
              >
                {openFormatInfo === f ? 'Hide' : 'What is this?'}
              </button>
            </label>
            {openFormatInfo === f && (
              <div style={{ marginTop: 8, padding: 12, background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, lineHeight: 1.5 }}>
                <p>{FORMAT_INFO[f].summary}</p>
                <p style={{ marginTop: 8, fontStyle: 'italic', color: 'var(--muted)' }}>{FORMAT_INFO[f].example}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {(format === 'scramble' || format === 'squad_rivalry') && (
        <>
          <h2>Lock Partners (optional)</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              Keep specific players partnered together all night — the rest still rotate normally.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={lockPickerA}
                onChange={e => setLockPickerA(e.target.value)}
                aria-label="First player to lock"
                style={{ minHeight: 40, padding: '6px 10px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 8 }}
              >
                <option value="">Player A…</option>
                {trimmedNamesForLocks.filter(n => !lockedPlayers.has(n) || n === lockPickerA).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>+</span>
              <select
                value={lockPickerB}
                onChange={e => setLockPickerB(e.target.value)}
                aria-label="Second player to lock"
                style={{ minHeight: 40, padding: '6px 10px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 8 }}
              >
                <option value="">Player B…</option>
                {trimmedNamesForLocks.filter(n => n !== lockPickerA && (!lockedPlayers.has(n) || n === lockPickerB)).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <button type="button" className="btn-secondary" onClick={handleAddLock} disabled={!lockPickerA || !lockPickerB}>
                Lock
              </button>
            </div>
            {lockedPairs.length > 0 && (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lockedPairs.map(([a, b], i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    🔒 {a} & {b}
                    <button type="button" className="text-link-btn" onClick={() => handleRemoveLock(i)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <h2>Court Numbers</h2>
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, minWidth: 0 }}>
        {courtLabels.map((label, i) => (
          <input
            key={i}
            value={label}
            onChange={e => updateCourtLabel(i, e.target.value)}
            placeholder={`Court ${i + 1}`}
            aria-label={`Court ${i + 1} number or name`}
            style={{ flex: '1 1 100px', minWidth: 0, minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
          />
        ))}
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

      <h2>Start Time (optional)</h2>
      <input
        type="time"
        value={startTime}
        onChange={e => setStartTime(e.target.value)}
        aria-label="Session start time, optional"
        style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, width: 140, border: '1px solid var(--border)', borderRadius: 8, background: 'white' }}
      />
      <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
        Set this + minutes per round below to show real clock times on the schedule (e.g. 8:00–8:10 PM) instead of just round numbers.
      </p>

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
                <strong>Swap {blockIndex + 1} — tap a player to cycle through courts</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {names.map(n => n.trim()).map((name, playerIndex) => {
                    if (!name) return null;
                    const courtIndex = manualBlocks[blockIndex]?.[playerIndex] ?? null;
                    return (
                      <button
                        key={playerIndex}
                        type="button"
                        onClick={() => cycleManualBlockPlayer(blockIndex, playerIndex)}
                        style={{
                          minHeight: 44,
                          padding: '6px 14px',
                          borderRadius: 999,
                          border: '1px solid var(--border)',
                          background: courtIndex === null ? 'white' : 'var(--primary)',
                          color: courtIndex === null ? 'var(--foreground)' : 'white',
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {name}
                        {courtIndex !== null ? ` — Court ${courtLabels[courtIndex]}` : ''}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                  Every player needs a court, at least 4 players per court.
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
