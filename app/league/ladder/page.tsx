'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Share2, ListOrdered, RefreshCw } from 'lucide-react';
import { fetchLadderStandings, enrollInLadder, unenrollFromLadder, resetLadder, type LadderStandingRow } from '@/lib/ladderStandings';
import { listPlayers, type PlayerRow } from '@/lib/players';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';
import { preloadPlayerPhotos } from '@/lib/playerPhotos';
import { renderElementToImage, shareCachedImage } from '@/lib/shareImage';
import { useCurrentClub } from '@/lib/useCurrentClub';
import Avatar from '@/components/Avatar';
import ConfirmModal from '@/components/ConfirmModal';
import ShareBrandedHeader from '@/components/ShareBrandedHeader';
import { displayName } from '@/lib/displayNamePref';

export default function LadderPage() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [standings, setStandings] = useState<LadderStandingRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [imageShareError, setImageShareError] = useState<string | null>(null);
  const [standingsImageFile, setStandingsImageFile] = useState<File | null>(null);
  const standingsCaptureRef = useRef<HTMLDivElement>(null);

  async function load(clubId: string) {
    const [st, pl] = await Promise.all([fetchLadderStandings(clubId), listPlayers(clubId), preloadPlayerPhotos()]);
    setStandings(st);
    setPlayers(pl);
  }

  useEffect(() => {
    if (clubLoading) return;
    if (!currentClubId) {
      setLoading(false);
      return;
    }
    async function init() {
      try {
        const [user] = await Promise.all([getCurrentUser(), load(currentClubId!)]);
        if (user) setIsAdmin(await isCurrentUserAdmin(currentClubId!));
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Failed to load ladder standings.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [currentClubId, clubLoading]);

  const enrolledNames = new Set(standings.map(s => s.player_name));
  const unenrolledPlayers = players.filter(p => !enrolledNames.has(p.name));

  async function handleEnroll(name: string) {
    if (!currentClubId) return;
    setBusyName(name);
    setActionError(null);
    try {
      await enrollInLadder(currentClubId, name);
      await load(currentClubId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to enroll player.');
    } finally {
      setBusyName(null);
    }
  }

  async function handleUnenroll(name: string) {
    if (!currentClubId) return;
    setBusyName(name);
    setActionError(null);
    try {
      await unenrollFromLadder(currentClubId, name);
      await load(currentClubId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to remove player.');
    } finally {
      setBusyName(null);
    }
  }

  async function handleReset() {
    if (!currentClubId) return;
    setShowResetConfirm(false);
    setResetting(true);
    setActionError(null);
    try {
      await resetLadder(currentClubId);
      await load(currentClubId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to reset ladder.');
    } finally {
      setResetting(false);
    }
  }

  // Pre-render ahead of the click so the share stays inside the browser's
  // user-gesture window (see lib/shareImage.ts) — rendering inside the
  // click handler can silently break navigator.share() on mobile.
  useEffect(() => {
    if (!standingsCaptureRef.current || standings.length === 0) {
      setStandingsImageFile(null);
      return;
    }
    renderElementToImage(standingsCaptureRef.current, 'ladder-standings.png')
      .then(file => {
        setStandingsImageFile(file);
        setImageShareError(null);
      })
      .catch(e => {
        setStandingsImageFile(null);
        setImageShareError(e instanceof Error ? `Couldn't prepare the image: ${e.message}` : "Couldn't prepare the image.");
      });
  }, [standings]);

  async function handleShareStandings() {
    setImageShareError(null);
    try {
      const file = standingsImageFile ?? (standingsCaptureRef.current ? await renderElementToImage(standingsCaptureRef.current, 'ladder-standings.png') : null);
      if (!file) {
        setImageShareError("Couldn't prepare the image — try again.");
        return;
      }
      const result = await shareCachedImage(file);
      if (result === 'downloaded') {
        setImageShareError('Image downloaded — attach it to WhatsApp manually (direct share isn\'t supported on this browser).');
      }
    } catch (e) {
      setImageShareError(e instanceof Error ? e.message : 'Failed to share image.');
    }
  }

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId) return <main className="page"><p>Join or create a club first — see <a href="/clubs">Clubs</a>.</p></main>;

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href="/league" className="text-link-btn">← League</Link>
        {isAdmin && standings.length > 0 && (
          <button className="icon-btn" aria-label="Share ladder standings image on WhatsApp" onClick={handleShareStandings}>
            <Share2 size={16} />
          </button>
        )}
      </div>

      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ListOrdered size={22} /> Ladder League</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', padding: '0 8px', marginBottom: 12 }}>
        Rungs move when a session is flagged as Ladder League at Setup and the lower-ranked doubles side pulls off an
        upset — the two sides swap rungs. Matches more than 3 rungs apart don't count as challenges.
      </p>

      {actionError && <p style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>{actionError}</p>}
      {imageShareError && <p style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>{imageShareError}</p>}

      {isAdmin && (
        <button className="btn-secondary" onClick={() => setShowResetConfirm(true)} disabled={resetting} style={{ marginBottom: 16 }}>
          {resetting ? 'Resetting…' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RefreshCw size={14} /> Reset Ladder (reseed by ELO)</span>}
        </button>
      )}

      {showResetConfirm && (
        <ConfirmModal
          title="Reset the ladder?"
          message="Everyone enrolled will be reseeded by current ELO rating and win/loss history on the ladder is cleared. This can't be undone."
          confirmLabel="Reset Ladder"
          danger
          onConfirm={handleReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      <div className="card" ref={standingsCaptureRef}>
        <ShareBrandedHeader clubId={currentClubId} />
        {standings.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No players enrolled on the ladder yet.</p>}
        {standings.map(s => (
          <div key={s.player_name} className="leaderboard-row">
            <span style={{ fontWeight: 800, width: 24 }}>{s.rung}</span>
            <Avatar name={s.player_name} size={28} />
            <span className="leaderboard-name">{s.player_name}</span>
            <span className="leaderboard-stats">{s.wins}W {s.losses}L</span>
            {isAdmin && (
              <button
                className="text-link-btn"
                disabled={busyName === s.player_name}
                onClick={() => handleUnenroll(s.player_name)}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {isAdmin && unenrolledPlayers.length > 0 && (
        <>
          <h2>Add to Ladder</h2>
          <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {unenrolledPlayers.map(p => (
              <button
                key={p.id}
                type="button"
                className="btn-secondary"
                disabled={busyName === p.name}
                onClick={() => handleEnroll(p.name)}
                style={{ minHeight: 36, padding: '6px 12px', fontSize: 13 }}
              >
                + {displayName(p)}
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
