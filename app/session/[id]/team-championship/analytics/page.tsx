'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { getSession, getRounds, type RoundRow, type SessionRow } from '@/lib/db';
import { fetchRapidFireLog } from '@/lib/rapidFire';
import { getCurrentUser } from '@/lib/auth';
import { listPlayers } from '@/lib/players';
import SessionNav from '@/components/SessionNav';
import BadgeMedallion from '@/components/BadgeMedallion';
import { renderElementToImage, shareCachedImage } from '@/lib/shareImage';
import { WhatsAppIcon } from '@/components/icons';
import AnalyticsImageTemplate from '@/components/AnalyticsImageTemplate';
import {
  computePlayerStats,
  computeMVP,
  computeTeamMVPs,
  computeHeadToHead,
  computeDuoRecords,
  computeStreaks,
  computeMatchMargins,
  computeClutchStats,
  computeImprovement,
  computeRapidFireContributions,
  computeRapidFireFinisher,
  computeRapidFireState,
  type RapidFireLogEntry,
} from '@/lib/teamChampionship';

type SortKey = 'wins' | 'winPct' | 'pointDiff' | 'matchesPlayed';

// Minimum matches before a stat is meaningful enough to award — a 1-0
// "perfect record" or a single-match "clutch player" isn't a real
// distinction, it's just too little data. Applied consistently across
// every threshold-based award below.
const MIN_MATCHES_FOR_AWARD = 2;

// Player-level stats, MVP, and the full awards list, split out of the team
// standings page — real feedback: "a separate page for player wise stats
// n analytics," followed by "list down all the possible analytics
// categories... so I can choose n award players."
export default function TeamChampionshipAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [rapidFireLog, setRapidFireLog] = useState<RapidFireLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('wins');
  const [ownPlayerName, setOwnPlayerName] = useState<string | null>(null);
  const [sharingImage, setSharingImage] = useState(false);
  const [imageShareError, setImageShareError] = useState<string | null>(null);
  const [analyticsImageFile, setAnalyticsImageFile] = useState<File | null>(null);
  const imageCaptureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const s = await getSession(id);
      setSession(s);
      const r = await getRounds(id);
      setRounds(r);
      try {
        if (s.rapid_fire_config) {
          const rf = await fetchRapidFireLog(id);
          setRapidFireLog(rf);
        }
      } catch (rfErr) {
        console.error("Rapid fire log query failed:", rfErr);
      }
      try {
        const user = await getCurrentUser();
        if (user && s.club_id) {
          const players = await listPlayers(s.club_id);
          setOwnPlayerName(players.find(p => p.user_id === user.id)?.name ?? null);
        }
      } catch (authErr) {
        console.error("Auth metadata query failed:", authErr);
      }
    }
    load()
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load analytics.'))
      .finally(() => setLoading(false));
  }, [id]);

  // Pre-render ahead of the click, same reason as every other share button
  // in this app — see lib/shareImage.ts. Recomputes the same stats the
  // render body derives below (this effect runs before those early-return
  // guards, so it can't reference those computed variables directly).
  useEffect(() => {
    if (!session?.squads || rounds.length === 0 || !imageCaptureRef.current) return;
    renderElementToImage(imageCaptureRef.current, `analytics-${id}.png`)
      .then(file => {
        setAnalyticsImageFile(file);
        setImageShareError(null);
      })
      .catch(e => {
        setAnalyticsImageFile(null);
        setImageShareError(e instanceof Error ? `Couldn't prepare the image: ${e.message}` : "Couldn't prepare the image.");
      });
  }, [session, rounds, id]);

  async function handleShareAnalytics() {
    setImageShareError(null);
    setSharingImage(true);
    try {
      const file = analyticsImageFile ?? (imageCaptureRef.current ? await renderElementToImage(imageCaptureRef.current, `analytics-${id}.png`) : null);
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
    } finally {
      setSharingImage(false);
    }
  }

  if (loading) return <main className="page"><p>Loading…</p></main>;
  if (error) return <main className="page"><p style={{ color: 'var(--danger)' }}>{error}</p></main>;
  if (!session) return <main className="page"><p>Session not found.</p></main>;
  if (session.format !== 'team_championship' || !session.squads) {
    return <main className="page"><p>This session isn&apos;t a Team Championship, or is missing its team setup.</p></main>;
  }

  const teams = session.squads;
  const stages = session.stage_config ?? [];
  const playerStats = computePlayerStats(rounds, teams);
  const overallMVP = computeMVP(playerStats);
  const teamMVPs = computeTeamMVPs(playerStats, teams);
  // A single meeting isn't a rivalry, it's just a match — only surface
  // pairs who've actually faced each other more than once, which this
  // bracket structure doesn't guarantee will happen at all.
  const rivalries = computeHeadToHead(rounds, teams).filter(r => r.meetings >= 2);

  // Every award below picks a single winner from an already-computed list
  // — no new tracking, just different lenses on the same rounds/log data.
  // Each is null/empty when there isn't enough data yet (see
  // MIN_MATCHES_FOR_AWARD), so the UI only shows awards that actually
  // mean something right now.
  const qualifyingStats = playerStats.filter(s => s.matchesPlayed >= MIN_MATCHES_FOR_AWARD);

  const ironMan = [...playerStats].sort((a, b) => b.matchesPlayed - a.matchesPlayed)[0] ?? null;

  const bestPointDiff = qualifyingStats.length > 0 ? [...qualifyingStats].sort((a, b) => b.pointDiff - a.pointDiff)[0] : null;

  const perfectRecords = qualifyingStats.filter(s => s.winPct === 1).sort((a, b) => b.matchesPlayed - a.matchesPlayed);

  const silentAssassin =
    qualifyingStats
      .filter(s => s.winPct >= 0.75)
      .sort((a, b) => a.matchesPlayed - b.matchesPlayed || b.winPct - a.winPct)[0] ?? null;

  const qualifyingDuos = computeDuoRecords(rounds, teams).filter(d => d.matchesTogether >= MIN_MATCHES_FOR_AWARD);
  const bestDuo = qualifyingDuos[0] ?? null;

  const allStreaks = computeStreaks(rounds, teams);
  const winStreakLeader = [...allStreaks].sort((a, b) => b.longestWinStreak - a.longestWinStreak)[0] ?? null;
  const lossStreakLeader = [...allStreaks].sort((a, b) => b.longestLossStreak - a.longestLossStreak)[0] ?? null;

  const margins = computeMatchMargins(rounds, stages);
  const blowout = margins.length > 0 ? [...margins].sort((a, b) => b.margin - a.margin)[0] : null;
  const nailBiter = margins.length > 0 ? [...margins].sort((a, b) => a.margin - b.margin)[0] : null;

  const clutchStats = computeClutchStats(rounds, teams, stages).filter(s => s.matchesPlayed >= MIN_MATCHES_FOR_AWARD);
  const clutchPlayer = clutchStats.length > 0 ? [...clutchStats].sort((a, b) => b.winPct - a.winPct || b.wins - a.wins)[0] : null;

  const improvementCandidates = computeImprovement(rounds, teams, stages).filter(
    i => i.firstStageMatches >= 1 && i.lastStageMatches >= 1
  );
  const mostImproved = improvementCandidates.length > 0 ? [...improvementCandidates].sort((a, b) => b.delta - a.delta)[0] : null;

  const rapidFireContributions = session.rapid_fire_config
    ? computeRapidFireContributions(rapidFireLog, teams).filter(c => c.pointsCredited > 0)
    : [];
  const rapidFireHero = rapidFireContributions.length > 0 ? [...rapidFireContributions].sort((a, b) => b.pointsCredited - a.pointsCredited)[0] : null;
  const rapidFireState = session.rapid_fire_config ? computeRapidFireState(rapidFireLog, session.rapid_fire_config, teams) : null;
  const finishers = rapidFireState ? computeRapidFireFinisher(rapidFireLog, rapidFireState, teams) : [];

  const sortedPlayerStats = [...playerStats]
    .filter(s => s.matchesPlayed > 0)
    .sort((a, b) => {
      if (sortKey === 'wins') return b.wins - a.wins || b.winPct - a.winPct;
      if (sortKey === 'winPct') return b.winPct - a.winPct || b.wins - a.wins;
      if (sortKey === 'pointDiff') return b.pointDiff - a.pointDiff;
      return b.matchesPlayed - a.matchesPlayed;
    });

  return (
    <>
    <main className="page">
      <div className="page-header-row">
        <Link href={`/session/${id}/team-championship/results`} className="text-link-btn">← Standings</Link>
      </div>
      <h1>Player Stats & Analytics</h1>

      <button
        className="btn-primary"
        style={{ width: '100%', minHeight: 48, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        onClick={handleShareAnalytics}
        disabled={sharingImage}
      >
        <WhatsAppIcon size={20} />
        {sharingImage ? 'Preparing image…' : 'Share Stats on WhatsApp'}
      </button>
      {imageShareError && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 12, marginBottom: 16 }}>{imageShareError}</p>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <Link
          href={`/session/${id}/team-championship/sessions-breakdown`}
          className="btn-secondary"
          style={{ width: '100%', textAlign: 'center', fontSize: 13, padding: '10px 8px', fontWeight: 700, borderColor: 'var(--primary)' }}
        >
          Session Points (1x/2x/3x) →
        </Link>
      </div>

      {overallMVP && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
          <Star size={28} color="#d4af37" fill="#d4af37" />
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Tournament MVP</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{overallMVP.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {overallMVP.wins}W – {overallMVP.losses}L · {(overallMVP.winPct * 100).toFixed(0)}% win rate · {overallMVP.pointDiff >= 0 ? '+' : ''}{overallMVP.pointDiff} point diff
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${teams.length === 2 ? '140px' : '200px'}, 1fr))`, gap: 10, marginBottom: 16 }}>
        {teams.map(t => {
          const mvp = teamMVPs.get(t.id);
          if (!mvp) return null;
          return (
            <div key={t.id} className="card" style={{ padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>{t.label ?? t.id} MVP</div>
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>{mvp.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{mvp.wins}W – {mvp.losses}L</div>
            </div>
          );
        })}
      </div>

      {ownPlayerName && (() => {
        const ownStats = playerStats.find(s => s.name === ownPlayerName);
        if (!ownStats || ownStats.matchesPlayed === 0) return null;
        const ownTeam = teams.find(t => t.id === ownStats.teamId);
        return (
          <div className="card" style={{ marginBottom: 16, padding: 16, borderColor: 'var(--primary)' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Your Stats</div>
            <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>{ownStats.name} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>({ownTeam?.label ?? ownStats.teamId})</span></div>
            <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 13 }}>
              <span><strong>{ownStats.wins}W – {ownStats.losses}L</strong></span>
              <span>{(ownStats.winPct * 100).toFixed(0)}% win rate</span>
              <span>{ownStats.pointDiff >= 0 ? '+' : ''}{ownStats.pointDiff} point diff</span>
              <span>{ownStats.matchesPlayed} matches</span>
            </div>
          </div>
        );
      })()}

      <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>Tournament Badges & Honors</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
        {ironMan && ironMan.matchesPlayed > 0 && (
          <BadgeHonorCard
            badgeId="iron_vanguard"
            title="Iron Vanguard"
            iconName="Dumbbell"
            tier={3}
            name={ironMan.name}
            detail={`${ironMan.matchesPlayed} matches played`}
            description="Demonstrated exceptional endurance by playing through grueling consecutive matches."
            sessionId={id}
          />
        )}
        {bestPointDiff && (
          <BadgeHonorCard
            badgeId="velocity_master"
            title="Velocity Master"
            iconName="Flame"
            tier={3}
            name={bestPointDiff.name}
            detail={`${bestPointDiff.pointDiff >= 0 ? '+' : ''}${bestPointDiff.pointDiff} net diff across ${bestPointDiff.matchesPlayed} matches`}
            description="Generated dominant scoring velocity and overwhelming point differential per game."
            sessionId={id}
          />
        )}
        {perfectRecords.length > 0 && (
          <BadgeHonorCard
            badgeId="unblemished_record"
            title="Unblemished Record"
            iconName="Sparkle"
            tier={4}
            name={perfectRecords.map(p => p.name).join(', ')}
            detail={`Undefeated — ${perfectRecords[0].wins}-0`}
            description="Went completely undefeated across all tournament matches played without a single loss."
            sessionId={id}
          />
        )}
        {silentAssassin && (
          <BadgeHonorCard
            badgeId="silent_assassin"
            title="Silent Assassin"
            iconName="Medal"
            tier={2}
            name={silentAssassin.name}
            detail={`${(silentAssassin.winPct * 100).toFixed(0)}% win rate in ${silentAssassin.matchesPlayed} matches`}
            description="Secured dominant victory percentages while maintaining cool, controlled execution."
            sessionId={id}
          />
        )}
        {bestDuo && (
          <BadgeHonorCard
            badgeId="golden_partnership"
            title="Golden Partnership"
            iconName="Handshake"
            tier={3}
            name={`${bestDuo.playerA} & ${bestDuo.playerB}`}
            detail={`${bestDuo.wins}-${bestDuo.losses} together`}
            description="Formed the top-performing double team in the tournament with flawless chemistry."
            sessionId={id}
          />
        )}
        {winStreakLeader && winStreakLeader.longestWinStreak >= 2 && (
          <BadgeHonorCard
            badgeId="hot_streak_5"
            title="Hot Streak"
            iconName="Flame"
            tier={2}
            name={winStreakLeader.name}
            detail={`${winStreakLeader.longestWinStreak} wins in a row`}
            description="Built an impressive consecutive winning streak during tournament play."
            sessionId={id}
          />
        )}
        {blowout && (
          <BadgeHonorCard
            badgeId="authoritative_finish"
            title="Authoritative Finish"
            iconName="Rocket"
            tier={2}
            name={`${blowout.teamA.join(' & ')} vs ${blowout.teamB.join(' & ')}`}
            detail={`${blowout.scoreA}-${blowout.scoreB} · Round ${blowout.roundNumber}`}
            description="Delivered a total blowout victory by closing out the match by 5+ points."
            sessionId={id}
          />
        )}
        {clutchPlayer && (
          <BadgeHonorCard
            badgeId="sudden_death_king"
            title="The Clutch Sovereign"
            iconName="Zap"
            tier={4}
            name={clutchPlayer.name}
            detail={`${(clutchPlayer.winPct * 100).toFixed(0)}% win rate under pressure`}
            description="Showed ultimate composure and ice-cold execution during high-stakes pressure rounds."
            sessionId={id}
          />
        )}
        {mostImproved && mostImproved.delta > 0 && (
          <BadgeHonorCard
            badgeId="late_game_maestro"
            title="Late-Game Maestro"
            iconName="Sparkles"
            tier={3}
            name={mostImproved.name}
            detail={`${(mostImproved.firstStageWinPct * 100).toFixed(0)}% → ${(mostImproved.lastStageWinPct * 100).toFixed(0)}% win rate`}
            description="Outperformed early session rounds with a dramatic late-game performance peak."
            sessionId={id}
          />
        )}
      </div>

      <h2>Player Leaderboard</h2>
      <div className="card" style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {([
          ['wins', 'Wins'],
          ['winPct', 'Win %'],
          ['pointDiff', 'Point Diff'],
          ['matchesPlayed', 'Matches'],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={sortKey === key ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 12, padding: '6px 10px' }}
            onClick={() => setSortKey(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
          <thead>
            <tr style={{ borderBottom: '3px solid var(--foreground)' }}>
              <th style={{ textAlign: 'left', padding: '12px 10px', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' }}>Player</th>
              <th style={{ textAlign: 'left', padding: '12px 10px', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)' }}>Team</th>
              <th style={{ textAlign: 'right', padding: '12px 10px', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>MP</th>
              <th style={{ textAlign: 'right', padding: '12px 10px', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>W</th>
              <th style={{ textAlign: 'right', padding: '12px 10px', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>L</th>
              <th style={{ textAlign: 'right', padding: '12px 10px', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Win%</th>
              <th style={{ textAlign: 'right', padding: '12px 10px', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>+/-</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayerStats.map((s, i) => {
              const team = teams.find(t => t.id === s.teamId);
              const isMVP = overallMVP?.name === s.name;
              return (
                <tr
                  key={s.name}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: isMVP ? 'rgba(212,175,55,0.12)' : i % 2 === 1 ? 'var(--surface-2, rgba(127,127,127,0.06))' : undefined,
                  }}
                >
                  <td style={{ padding: '12px 10px', fontWeight: isMVP ? 800 : 700 }}>
                    {isMVP && '★ '}{s.name}
                  </td>
                  <td style={{ padding: '12px 10px', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{team?.label ?? s.teamId}</td>
                  <td style={{ textAlign: 'right', padding: '12px 10px', fontWeight: 700 }}>{s.matchesPlayed}</td>
                  <td style={{ textAlign: 'right', padding: '12px 10px', fontWeight: 700 }}>{s.wins}</td>
                  <td style={{ textAlign: 'right', padding: '12px 10px', fontWeight: 700 }}>{s.losses}</td>
                  <td style={{ textAlign: 'right', padding: '12px 10px', fontWeight: 800 }}>{(s.winPct * 100).toFixed(0)}%</td>
                  <td style={{ textAlign: 'right', padding: '12px 10px', fontWeight: 800, color: s.pointDiff > 0 ? 'var(--success, #16a34a)' : s.pointDiff < 0 ? 'var(--danger)' : undefined }}>
                    {s.pointDiff >= 0 ? '+' : ''}{s.pointDiff}
                  </td>
                </tr>
              );
            })}
            {sortedPlayerStats.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>No matches scored yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rivalries.length > 0 && (
        <>
          <h2 style={{ marginTop: 24 }}>Head-to-Head Rivalries</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>
            Players who&apos;ve faced each other more than once — every individual matchup that occurs whenever the two teams meet.
          </p>
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)' }}>Matchup</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)' }}>Meetings</th>
                </tr>
              </thead>
              <tbody>
                {rivalries.map((r, i) => {
                  const isEven = r.aWins === r.bWins;
                  const leaderName = isEven ? null : r.aWins > r.bWins ? r.playerA : r.playerB;
                  return (
                    <tr key={`${r.playerA}-${r.playerB}`} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 1 ? 'var(--surface-2, rgba(127,127,127,0.06))' : undefined }}>
                      <td style={{ padding: '10px 8px', fontWeight: 700 }}>
                        <span style={{ fontWeight: leaderName === r.playerA ? 900 : 700 }}>{r.playerA}</span>
                        {' '}{r.aWins}–{r.bWins}{' '}
                        <span style={{ fontWeight: leaderName === r.playerB ? 900 : 700 }}>{r.playerB}</span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--muted)', fontWeight: 700 }}>{r.meetings}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Off-screen — captured for the WhatsApp image share, never shown on screen. */}
      <div style={{ position: 'fixed', left: -99999, top: 0 }} aria-hidden="true">
        <div ref={imageCaptureRef}>
          <AnalyticsImageTemplate
            session={session}
            teams={teams}
            overallMVP={overallMVP}
            teamMVPs={teamMVPs}
            topPlayers={sortedPlayerStats.slice(0, 8)}
          />
        </div>
      </div>
    </main>
    <SessionNav sessionId={id} format="team_championship" clubId={session?.club_id} />
    </>
  );
}

function BadgeHonorCard({
  badgeId,
  title,
  iconName,
  tier = 3,
  name,
  detail,
  description,
  sessionId,
}: {
  badgeId: string;
  title: string;
  iconName: string;
  tier?: 1 | 2 | 3 | 4;
  name: string;
  detail: string;
  description: string;
  sessionId: string;
}) {
  const shareText = encodeURIComponent(
    `🏆 *${name}* earned the *${title}* badge in tonight's Pickleball Tournament! 🚀\n\n"${description}" (${detail})\n\nCheck live standings & awards: https://pickleball-app-two.vercel.app/session/${sessionId}/team-championship/results`
  );

  return (
    <div
      className="card"
      style={{
        padding: 16,
        background: 'var(--card)',
        borderRadius: 14,
        border: '1.5px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <BadgeMedallion badge={{ id: badgeId, label: title, icon: iconName, tier, description }} size={48} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: 0.5 }}>
              {tier === 4 ? 'Platinum Honor' : tier === 3 ? 'Gold Honor' : tier === 2 ? 'Silver Honor' : 'Bronze Honor'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)' }}>{title}</div>
          </div>
        </div>

        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>{name}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>{detail}</div>
        <div style={{ fontSize: 12, color: 'var(--text)', opacity: 0.85, marginTop: 8, fontStyle: 'italic', lineHeight: 1.4 }}>
          &ldquo;{description}&rdquo;
        </div>
      </div>

      <a
        href={`https://api.whatsapp.com/send?text=${shareText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 700,
          padding: '8px 12px',
          borderRadius: 8,
          background: 'rgba(34, 197, 94, 0.1)',
          color: '#16a34a',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          textDecoration: 'none',
          marginTop: 6,
        }}
      >
        <WhatsAppIcon size={16} />
        Brag on WhatsApp
      </a>
    </div>
  );
}
