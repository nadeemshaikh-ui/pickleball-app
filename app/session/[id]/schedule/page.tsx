'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getSession, getRounds, renamePlayerEverywhere, type RoundRow, type SessionRow } from '@/lib/db';
import { getClubBranding } from '@/lib/clubs';
import { renderElementToImage, shareCachedImage } from '@/lib/shareImage';
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
import SquadLineupCard from '@/components/SquadLineupCard';
import CourtBlockAllocationCard from '@/components/CourtBlockAllocationCard';
import CourtAllocationImageTemplate from '@/components/CourtAllocationImageTemplate';

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
  const [scheduleImageFile, setScheduleImageFile] = useState<File | null>(null);
  const [groupingImageFile, setGroupingImageFile] = useState<File | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [club, setClub] = useState<{ name: string; logo_url: string | null } | null>(null);
  const [ownPlayerName, setOwnPlayerName] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Map<string, PredictionRow[]>>(new Map());
  const [predictingRoundId, setPredictingRoundId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tableCaptureRef = useRef<HTMLDivElement>(null);
  const groupingCaptureRef = useRef<HTMLDivElement>(null);

  async function reload() {
    try {
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
    } finally {
      setLoading(false);
    }
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

  // Pre-render the schedule image as soon as its data exists, well before
  // the user clicks share — see lib/shareImage.ts: rendering inside the
  // click handler burns the browser's user-gesture window on some mobile
  // browsers, so navigator.share() gets silently rejected even though
  // canShare() said yes. The schedule table can change right up until the
  // share button is clicked, so this just re-renders whenever the
  // underlying data changes, same as the team-championship stage page.
  useEffect(() => {
    if (!session || !tableCaptureRef.current) {
      setScheduleImageFile(null);
      return;
    }
    renderElementToImage(tableCaptureRef.current, `schedule-${id}.png`)
      .then(file => {
        setScheduleImageFile(file);
        setImageShareError(null);
      })
      .catch(e => {
        setScheduleImageFile(null);
        setImageShareError(e instanceof Error ? `Couldn't prepare the schedule image: ${e.message}` : "Couldn't prepare the schedule image.");
      });

    if (groupingCaptureRef.current) {
      renderElementToImage(groupingCaptureRef.current, `court-groupings-${id}.png`)
        .then(file => {
          setGroupingImageFile(file);
        })
        .catch(console.error);
    }
  }, [session, rounds, club, id]);

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

  const [whatsappFallbackUrl, setWhatsappFallbackUrl] = useState<string | null>(null);

  async function handleShareImage() {
    setImageShareError(null);
    setWhatsappFallbackUrl(null);
    setSharingImage(true);
    try {
      const file = scheduleImageFile ?? (tableCaptureRef.current ? await renderElementToImage(tableCaptureRef.current, `schedule-${id}.png`) : null);
      if (!file) {
        setImageShareError("Couldn't prepare the image — try again.");
        return;
      }
      const text = `🎾 Hotshots Official Schedule:\n${window.location.href}`;
      const result = await shareCachedImage(file, text);
      if (result === 'downloaded') {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        setWhatsappFallbackUrl(waUrl);
        setImageShareError('Image saved to downloads! Tap "Open WhatsApp" below to send to your group.');
      }
    } catch (e) {
      setImageShareError(e instanceof Error ? e.message : 'Failed to share image.');
    } finally {
      setSharingImage(false);
    }
  }

  async function handleShareGroupingImage() {
    setImageShareError(null);
    setWhatsappFallbackUrl(null);
    setSharingImage(true);
    try {
      const file = groupingImageFile ?? (groupingCaptureRef.current ? await renderElementToImage(groupingCaptureRef.current, `court-groupings-${id}.png`) : null);
      if (!file) {
        setImageShareError("Couldn't prepare the groupings image — try again.");
        return;
      }
      const text = `🎾 Hotshots Hourly Court & Player Groupings:\n${window.location.href}`;
      const result = await shareCachedImage(file, text);
      if (result === 'downloaded') {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        setWhatsappFallbackUrl(waUrl);
        setImageShareError('Groupings image saved to downloads! Tap "Open WhatsApp" below to send to your group.');
      }
    } catch (e) {
      setImageShareError(e instanceof Error ? e.message : 'Failed to share groupings image.');
    } finally {
      setSharingImage(false);
    }
  }

  return (
    <>
      <main className="page">
        <div className="page-header-row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <NewSessionLink />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', marginTop: 8 }}>
            <button
              className="btn-secondary"
              style={{ flex: 1, minHeight: 48, fontSize: 14, fontWeight: 900, padding: '10px 14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#121a2f', color: '#e5fa00', border: '1px solid #121a2f', borderRadius: 12 }}
              onClick={handleShareGroupingImage}
              disabled={sharingImage}
            >
              <WhatsAppIcon size={20} />
              <span>Share Groupings Image</span>
            </button>
            <button
              className="btn-secondary"
              style={{ flex: 1, minHeight: 48, fontSize: 14, fontWeight: 900, padding: '10px 14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12 }}
              onClick={handleShareImage}
              disabled={sharingImage}
            >
              <WhatsAppIcon size={20} />
              <span>Share Schedule Image</span>
            </button>
          </div>
        </div>
        {sharingImage && <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'right', marginTop: 4 }}>Preparing high-res image…</p>}
        {imageShareError && (
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 12, padding: 14, marginTop: 10 }}>
            <p style={{ color: '#0f172a', fontWeight: 700, fontSize: 14, margin: 0 }}>{imageShareError}</p>
            {whatsappFallbackUrl && (
              <a
                href={whatsappFallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 10,
                  background: '#25D366',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: 15,
                  padding: '10px 18px',
                  borderRadius: 10,
                  textDecoration: 'none'
                }}
              >
                <WhatsAppIcon size={20} />
                <span>Open WhatsApp Now →</span>
              </a>
            )}
          </div>
        )}

        <Link
          href={`/session/${id}/play`}
          className="btn-primary"
          style={{
            width: '100%',
            marginBottom: 16,
            minHeight: 54,
            fontSize: 16,
            fontWeight: 900,
            background: '#0f172a',
            color: '#e5fa00',
            border: '2px solid #0f172a',
            borderRadius: 14,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 4px 14px rgba(15,23,42,0.15)'
          }}
        >
          <span>🎾 Open Live Scoring Page →</span>
        </Link>

        {session && <GroupHeader groupName={session.group_name} logoUrl1={session.logo_url_1} logoUrl2={session.logo_url_2} />}
        <h1>Schedule</h1>
        {session && <SessionDate createdAt={session.created_at} eventDate={session.event_date} venue={session.venue} />}
        {session?.round_duration_minutes && (
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>
            {session.round_count} rounds × ~{session.round_duration_minutes} min — about{' '}
            {Math.round((session.round_count * session.round_duration_minutes) / 60 * 10) / 10} hr total
            {session.start_time && ` — starting ${session.start_time}`}
          </p>
        )}

        {session && session.format === 'squad_rivalry' && session.squads && session.squads.length === 2 && (
          <div style={{ marginTop: 16 }}>
            <SquadLineupCard
              goldLabel={session.squads[0].label || 'Gold'}
              blackLabel={session.squads[1].label || 'Black'}
              goldLogoUrl={session.squads[0].logoUrl ?? null}
              blackLogoUrl={session.squads[1].logoUrl ?? null}
              goldPlayers={session.squads[0].players}
              blackPlayers={session.squads[1].players}
              filename={`squad-lineup-${id}.png`}
            />
          </div>
        )}
        {session && session.format === 'squad_rivalry' && session.squads && session.squads.length > 2 && (
          <div className="card" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: `repeat(${Math.min(session.squads.length, 4)}, 1fr)`, gap: 12 }}>
            {session.squads.map(squad => (
              <div key={squad.id}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
                  {squad.label ?? squad.id} ({squad.players.length})
                </div>
                {squad.players.map(p => (
                  <div key={p} style={{ fontSize: 13, padding: '2px 0' }}>{p}</div>
                ))}
              </div>
            ))}
          </div>
        )}

        {session && <CourtBlockAllocationCard session={session} rounds={rounds} />}

        {session && session.players.length > 0 && !(session.format === 'squad_rivalry' && session.squads) && (
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
              <div className="card" style={{ marginTop: 8, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px', fontSize: 12, color: 'var(--muted)' }}>Player</th>
                      <th style={{ padding: '6px 8px', fontSize: 12, color: 'var(--muted)' }}>Games Played</th>
                      <th style={{ padding: '6px 8px', fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>Rating</th>
                    </tr>
                  </thead>
                  <tbody>
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
                        return (
                          <tr key={name} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Avatar name={name} size={28} />
                                <span style={{ fontWeight: 700 }}>{name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '8px', color: 'var(--muted)' }}>{p ? p.games_played : '—'}</td>
                            <td style={{ padding: '8px', textAlign: 'right', color: 'var(--muted)' }} title="Skill rating — used to balance courts and flights">
                              {p ? p.elo_rating : '—'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
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
            <div ref={groupingCaptureRef}>
              <CourtAllocationImageTemplate session={session} rounds={rounds} club={club} />
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

        {loading && (
          <div className="card" style={{ padding: '36px 24px', textAlign: 'center', margin: '24px 0', background: '#ffffff', borderRadius: 16 }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>⚡ Loading Official Schedule...</p>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Fetching live match rounds</p>
          </div>
        )}

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

              const roundsPerBlock = session?.rounds_per_block || (sortedRoundNumbers.length % 5 === 0 && sortedRoundNumbers.length > 5 ? 5 : null);
              const isBlockHeader = roundsPerBlock ? (roundNumber - 1) % roundsPerBlock === 0 : false;
              const blockIndex = roundsPerBlock ? Math.floor((roundNumber - 1) / roundsPerBlock) + 1 : 1;
              const blockStartRound = roundsPerBlock ? (blockIndex - 1) * roundsPerBlock + 1 : 1;
              const blockEndRound = roundsPerBlock ? Math.min(blockIndex * roundsPerBlock, sortedRoundNumbers.length) : sortedRoundNumbers.length;

              return (
                <div key={roundNumber} className="round-card">
                  {isBlockHeader && (
                    <div style={{ background: 'var(--primary)', color: '#ffffff', fontWeight: 800, fontSize: 16, textAlign: 'center', padding: '10px 14px', borderRadius: 10, marginTop: roundNumber === 1 ? 0 : 24, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      ★ SESSION {blockIndex} — ROUNDS {blockStartRound} TO {blockEndRound} ★
                    </div>
                  )}
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
      <SessionNav sessionId={id} format={session?.format} clubId={session?.club_id} />
    </>
  );
}
