'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getSession, getRounds, renamePlayerEverywhere, type RoundRow, type SessionRow } from '@/lib/db';
import { getClubBranding } from '@/lib/clubs';
import { shareElementAsImage } from '@/lib/shareImage';
import { listPlayers, type PlayerRow } from '@/lib/players';
import { flightForRating } from '@/lib/flights';
import { preloadPlayerPhotos } from '@/lib/playerPhotos';
import SessionNav from '@/components/SessionNav';
import NewSessionLink from '@/components/NewSessionLink';
import SessionDate from '@/components/SessionDate';
import GroupHeader from '@/components/GroupHeader';
import Avatar from '@/components/Avatar';
import { ChairIcon, WhatsAppIcon } from '@/components/icons';
import { formatLabel } from '@/lib/formatLabel';
import { computeRoundTimeRange } from '@/lib/roundTiming';
import ScheduleImageTemplate from '@/components/ScheduleImageTemplate';
import { getCurrentUser } from '@/lib/auth';
import { submitPrediction, fetchPredictionsForRounds, type PredictionRow } from '@/lib/predictions';

const FLIGHT_RANK: Record<string, number> = { Platinum: 4, Gold: 3, Silver: 2, Bronze: 1 };

export default function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [playersByName, setPlayersByName] = useState<Map<string, PlayerRow>>(new Map());
  const [showRoster, setShowRoster] = useState(true);
  const [showEditPlayers, setShowEditPlayers] = useState(false);
  const [nameDrafts, setNameDrafts] = useState<string[]>([]);
  const [savingNames, setSavingNames] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [sharingImage, setSharingImage] = useState(false);
  const [imageShareError, setImageShareError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [club, setClub] = useState<{ name: string; logo_url: string | null } | null>(null);
  const [ownPlayerName, setOwnPlayerName] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Map<string, PredictionRow[]>>(new Map());
  const [predictingRoundId, setPredictingRoundId] = useState<string | null>(null);
  const tableCaptureRef = useRef<HTMLDivElement>(null);

  async function reload() {
    const [s, r, user] = await Promise.all([getSession(id), getRounds(id), getCurrentUser()]);
    setSession(s);
    setRounds(r);
    setNameDrafts(s.players);
    getClubBranding(s.club_id).then(setClub).catch(() => setClub(null));
    listPlayers(s.club_id)
      .then(players => {
        setPlayersByName(new Map(players.map(p => [p.name, p])));
        setOwnPlayerName(user ? players.find(p => p.user_id === user.id)?.name ?? null : null);
      })
      .catch(() => setPlayersByName(new Map()));
    fetchPredictionsForRounds(r.map(round => round.id))
      .then(setPredictions)
      .catch(() => setPredictions(new Map()));
    preloadPlayerPhotos().catch(() => {});
  }

  async function handlePredict(roundId: string, team: 'a' | 'b') {
    if (!session || !ownPlayerName) return;
    setPredictingRoundId(roundId);
    try {
      await submitPrediction(roundId, session.club_id, ownPlayerName, team);
      setPredictions(await fetchPredictionsForRounds(rounds.map(r => r.id)));
    } catch {
      // Most likely a duplicate pick (unique constraint) — silently
      // refresh so the UI reflects whatever the DB actually has.
      setPredictions(await fetchPredictionsForRounds(rounds.map(r => r.id)));
    } finally {
      setPredictingRoundId(null);
    }
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

  async function handleShareImage() {
    if (!tableCaptureRef.current) return;
    setImageShareError(null);
    setSharingImage(true);
    try {
      const result = await shareElementAsImage(tableCaptureRef.current, `schedule-${id}.png`);
      if (result === 'downloaded') {
        setImageShareError('Image downloaded — attach it to WhatsApp manually (direct share isn\'t supported on this browser).');
      }
    } catch (e) {
      setImageShareError(e instanceof Error ? e.message : 'Failed to share image.');
    } finally {
      setSharingImage(false);
    }
  }

  return (
    <>
      <main className="page">
        <div className="page-header-row">
          <NewSessionLink />
          <button
            className="icon-btn"
            aria-label="Share schedule image on WhatsApp"
            onClick={handleShareImage}
            disabled={sharingImage}
          >
            <WhatsAppIcon size={24} />
          </button>
        </div>
        {sharingImage && <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'right', marginTop: -8 }}>Preparing image…</p>}
        {imageShareError && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14 }}>{imageShareError}</p>}

        {session && <GroupHeader groupName={session.group_name} logoUrl1={session.logo_url_1} logoUrl2={session.logo_url_2} />}
        <h1>Schedule</h1>
        {session && <SessionDate createdAt={session.created_at} venue={session.venue} />}
        {session?.round_duration_minutes && (
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>
            {session.round_count} rounds × ~{session.round_duration_minutes} min — about{' '}
            {Math.round((session.round_count * session.round_duration_minutes) / 60 * 10) / 10} hr total
            {session.start_time && ` — starting ${session.start_time}`}
          </p>
        )}

        {session && session.players.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button
              className="text-link-btn"
              onClick={() => setShowRoster(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
            >
              <span>Who's Playing ({session.players.length})</span>
              <span>{showRoster ? 'Hide' : 'Show'}</span>
            </button>
            {showRoster && (
              <div className="card" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...session.players]
                  .sort((x, y) => {
                    const px = playersByName.get(x);
                    const py = playersByName.get(y);
                    const rankX = FLIGHT_RANK[flightForRating(px?.elo_rating ?? 1500)];
                    const rankY = FLIGHT_RANK[flightForRating(py?.elo_rating ?? 1500)];
                    if (rankX !== rankY) return rankY - rankX;
                    return (py?.elo_rating ?? 1500) - (px?.elo_rating ?? 1500);
                  })
                  .map(name => {
                    const p = playersByName.get(name);
                    const flight = flightForRating(p?.elo_rating ?? 1500);
                    return (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={name} size={32} />
                        <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{name}</span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{flight}</span>
                        {p && <span style={{ fontSize: 11, color: 'var(--muted)' }} title="Skill rating — used to balance courts and flights">Rating {p.elo_rating}</span>}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        <Link href={`/session/${id}/play`} className="btn-primary" style={{ width: '100%', marginTop: 16 }}>
          Start Scoring →
        </Link>

        {session?.storylines && session.storylines.length > 0 && (
          <Link href={`/session/${id}/storyline`} className="btn-secondary" style={{ width: '100%', display: 'block', textAlign: 'center', marginTop: 10 }}>
            Tonight&apos;s Storyline
          </Link>
        )}

        <button className="text-link-btn" onClick={() => setShowEditPlayers(v => !v)}>
          {showEditPlayers ? 'Hide edit players' : 'Edit Players'}
        </button>

        {showEditPlayers && (
          <div className="card" style={{ marginTop: 10, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
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

        {/* Off-screen copy, always rendered — this is what gets captured for the share-image button regardless of which view is showing on screen. */}
        {session && (
          <div style={{ position: 'fixed', left: -99999, top: 0 }} aria-hidden="true">
            <div ref={tableCaptureRef}>
              <ScheduleImageTemplate session={session} rounds={rounds} club={club} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 20, marginBottom: 12 }}>
          <button
            className={viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setViewMode('table')}
            style={{ flex: 1, minHeight: 40, fontSize: 14 }}
          >
            Table View
          </button>
          <button
            className={viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setViewMode('cards')}
            style={{ flex: 1, minHeight: 40, fontSize: 14 }}
          >
            Card View
          </button>
        </div>

        {viewMode === 'table' && session && (
          <div style={{ overflowX: 'auto', margin: '0 -16px', padding: '0 16px 4px' }}>
            <ScheduleImageTemplate session={session} rounds={rounds} />
          </div>
        )}

        {viewMode === 'cards' && (
          <div>
            {sortedRoundNumbers.map(roundNumber => {
              const courts = byRound.get(roundNumber)!.sort((a, b) => a.court - b.court);
              const sameSitOut =
                courts.length === 2 &&
                JSON.stringify([...courts[0].sitting_out].sort()) === JSON.stringify([...courts[1].sitting_out].sort());
              const timeRange = session ? computeRoundTimeRange(session.start_time, session.round_duration_minutes, roundNumber) : null;
              return (
                <div key={roundNumber} className="round-card">
                  <div className="round-card-header">
                    <span className="round-label">Round {roundNumber}</span>
                    {timeRange && <span className="round-label" style={{ fontSize: 14 }}>{timeRange}</span>}
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
                          <span className="stat-icon"><ChairIcon size={20} /></span>
                          Resting: {c.sitting_out.join(', ')}
                        </div>
                      )}
                      {c.score_a === null && c.score_b === null && ownPlayerName && (
                        <div style={{ marginTop: 8 }}>
                          {predictions.get(c.id)?.some(p => p.predictor_name === ownPlayerName) ? (
                            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                              You picked{' '}
                              <strong>
                                {predictions.get(c.id)!.find(p => p.predictor_name === ownPlayerName)!.picked_team === 'a'
                                  ? c.team_a.join(' & ')
                                  : c.team_b.join(' & ')}
                              </strong>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>Who wins?</span>
                              <button
                                className="btn-secondary"
                                style={{ flex: 1, minHeight: 30, fontSize: 12, padding: '4px 8px' }}
                                disabled={predictingRoundId === c.id}
                                onClick={() => handlePredict(c.id, 'a')}
                              >
                                {c.team_a.join(' & ')}
                              </button>
                              <button
                                className="btn-secondary"
                                style={{ flex: 1, minHeight: 30, fontSize: 12, padding: '4px 8px' }}
                                disabled={predictingRoundId === c.id}
                                onClick={() => handlePredict(c.id, 'b')}
                              >
                                {c.team_b.join(' & ')}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {sameSitOut && courts[0].sitting_out.length > 0 && (
                    <div className="resting-badge">
                      <span className="stat-icon"><ChairIcon size={20} /></span>
                      Resting: {courts[0].sitting_out.join(', ')}
                    </div>
                  )}
                  {session && (
                    <div className="meta-bar">
                      <span>ROUND {roundNumber}</span>
                      <span>COURT {courtLabels.join('/')}</span>
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
          </div>
        )}
      </main>
      <SessionNav sessionId={id} />
    </>
  );
}
