'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession, getRounds, renamePlayerEverywhere, type RoundRow, type SessionRow } from '@/lib/db';
import { formatScheduleAsText } from '@/lib/scheduleText';
import { shareToWhatsApp } from '@/lib/whatsapp';
import SessionNav from '@/components/SessionNav';
import NewSessionLink from '@/components/NewSessionLink';
import SessionDate from '@/components/SessionDate';
import GroupHeader from '@/components/GroupHeader';
import { ChairIcon } from '@/components/icons';
import { formatLabel } from '@/lib/formatLabel';

export default function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [copied, setCopied] = useState(false);
  const [showEditPlayers, setShowEditPlayers] = useState(false);
  const [nameDrafts, setNameDrafts] = useState<string[]>([]);
  const [savingNames, setSavingNames] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  async function reload() {
    const [s, r] = await Promise.all([getSession(id), getRounds(id)]);
    setSession(s);
    setRounds(r);
    setNameDrafts(s.players);
  }

  useEffect(() => {
    reload();
  }, [id]);

  const courtLabels = session?.court_labels ?? ['1', '2'];

  async function handleSaveNames() {
    if (!session) return;
    setNameError(null);
    const trimmed = nameDrafts.map(n => n.trim());
    if (trimmed.some(n => n.length === 0)) {
      setNameError('Names cannot be blank.');
      return;
    }
    if (new Set(trimmed).size !== trimmed.length) {
      setNameError('Names must stay unique.');
      return;
    }
    setSavingNames(true);
    try {
      for (let i = 0; i < session.players.length; i++) {
        if (session.players[i] !== trimmed[i]) {
          await renamePlayerEverywhere(id, session.players[i], trimmed[i]);
        }
      }
      await reload();
      setShowEditPlayers(false);
    } catch (e) {
      setNameError(e instanceof Error ? e.message : 'Failed to save names.');
    } finally {
      setSavingNames(false);
    }
  }

  const byRound = new Map<number, RoundRow[]>();
  for (const r of rounds) {
    const list = byRound.get(r.round_number) ?? [];
    list.push(r);
    byRound.set(r.round_number, list);
  }
  const sortedRoundNumbers = [...byRound.keys()].sort((a, b) => a - b);

  async function handleCopy() {
    await navigator.clipboard.writeText(formatScheduleAsText(rounds, courtLabels, session?.round_duration_minutes ?? null));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <main className="page">
        <NewSessionLink />
        {session && <GroupHeader groupName={session.group_name} logoUrl1={session.logo_url_1} logoUrl2={session.logo_url_2} />}
        <h1>Schedule</h1>
        {session && <SessionDate createdAt={session.created_at} />}
        {session?.round_duration_minutes && (
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>
            {session.round_count} rounds × ~{session.round_duration_minutes} min — about{' '}
            {Math.round((session.round_count * session.round_duration_minutes) / 60 * 10) / 10} hr total
          </p>
        )}
        <button
          className="btn-primary"
          onClick={() => shareToWhatsApp(formatScheduleAsText(rounds, courtLabels, session?.round_duration_minutes ?? null))}
          style={{ marginTop: 16, marginBottom: 8, width: '100%' }}
        >
          Share on WhatsApp
        </button>
        <button className="btn-secondary" onClick={handleCopy} style={{ marginBottom: 12, width: '100%' }}>
          {copied ? 'Copied!' : 'Copy as Text'}
        </button>
        <Link href={`/session/${id}/play`} className="btn-secondary" style={{ width: '100%', marginBottom: 12 }}>
          Start Scoring →
        </Link>

        <button
          className="btn-secondary"
          onClick={() => setShowEditPlayers(v => !v)}
          style={{ width: '100%', marginBottom: 20 }}
        >
          {showEditPlayers ? 'Hide Edit Players' : 'Fix a Typo in Player Names'}
        </button>

        {showEditPlayers && (
          <div className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {nameDrafts.map((name, i) => (
              <input
                key={i}
                value={name}
                onChange={e =>
                  setNameDrafts(prev => prev.map((n, idx) => (idx === i ? e.target.value : n)))
                }
                aria-label={`Player ${i + 1} name`}
                style={{ minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
              />
            ))}
            {nameError && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14 }}>{nameError}</p>}
            <button className="btn-primary" onClick={handleSaveNames} disabled={savingNames}>
              {savingNames ? 'Saving…' : 'Save Names'}
            </button>
          </div>
        )}

        {sortedRoundNumbers.map(roundNumber => {
          const courts = byRound.get(roundNumber)!.sort((a, b) => a.court - b.court);
          const sameSitOut =
            courts.length === 2 &&
            JSON.stringify([...courts[0].sitting_out].sort()) === JSON.stringify([...courts[1].sitting_out].sort());
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
                  {!sameSitOut && c.sitting_out.length > 0 && (
                    <div className="resting-badge">
                      <span className="stat-icon"><ChairIcon size={16} /></span>
                      Resting: {c.sitting_out.join(', ')}
                    </div>
                  )}
                </div>
              ))}
              {sameSitOut && courts[0].sitting_out.length > 0 && (
                <div className="resting-badge">
                  <span className="stat-icon"><ChairIcon size={16} /></span>
                  Resting: {courts[0].sitting_out.join(', ')}
                </div>
              )}
              {session && (
                <div className="meta-bar">
                  <span>{new Date(session.created_at).toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</span>
                  <span>ROUND {roundNumber}</span>
                  <span>COURT {courtLabels.join('/')}</span>
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
