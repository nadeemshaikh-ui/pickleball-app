'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  fetchLifetimeLeaderboard,
  fetchMvpCounts,
  fetchStreaks,
  fetchBestDuos,
  fetchRivalriesForPlayer,
  MIN_GAMES_FOR_RANKING,
  type LifetimePlayerStats,
  type RankedDuo,
  type Rivalry,
} from '@/lib/leagueStats';
import { fetchStreakRecords, type StreakRecord } from '@/lib/streakRecords';
import { fetchPersonalBests, type PersonalBests } from '@/lib/personalBests';
import { computeChemistryScore } from '@/lib/chemistry';
import { flightForRating } from '@/lib/flights';
import { computeBadges } from '@/lib/badges';
import { preloadPlayerPhotos } from '@/lib/playerPhotos';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';
import { listPlayers } from '@/lib/players';
import { shareElementAsImage } from '@/lib/shareImage';
import { useCurrentClub } from '@/lib/useCurrentClub';
import Avatar from '@/components/Avatar';
import BadgeMedallion from '@/components/BadgeMedallion';

const POWER_DUO_MIN_GAMES = 10;
const POWER_DUO_MIN_WIN_RATE = 0.7;

type SortKey = 'rank' | 'wins' | 'winPct' | 'gamesPlayed' | 'pointsFor' | 'mvp';

export default function LeagueStatsPage() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [lifetime, setLifetime] = useState<LifetimePlayerStats[]>([]);
  const [mvpCounts, setMvpCounts] = useState<Map<string, number>>(new Map());
  const [streaks, setStreaks] = useState<Map<string, number>>(new Map());
  const [flightByName, setFlightByName] = useState<Map<string, string>>(new Map());
  const [duos, setDuos] = useState<RankedDuo[]>([]);
  const [streakRecords, setStreakRecords] = useState<StreakRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('rank');

  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [expandedRivalries, setExpandedRivalries] = useState<Rivalry[]>([]);
  const [expandedBests, setExpandedBests] = useState<PersonalBests | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [imageShareError, setImageShareError] = useState<string | null>(null);
  const statsCaptureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (clubLoading) return;
    if (!currentClubId) {
      setLoading(false);
      return;
    }
    async function init() {
      try {
        const [lb, mvp, streakMap, players, duoList, records, , user] = await Promise.all([
          fetchLifetimeLeaderboard(currentClubId!),
          fetchMvpCounts(currentClubId!),
          fetchStreaks(currentClubId!),
          listPlayers(currentClubId!),
          fetchBestDuos(currentClubId!),
          fetchStreakRecords(currentClubId!),
          preloadPlayerPhotos(),
          getCurrentUser(),
        ]);
        setLifetime(lb);
        setMvpCounts(mvp);
        setStreaks(streakMap);
        setFlightByName(new Map(players.map(p => [p.name, flightForRating(p.elo_rating)])));
        setDuos(duoList);
        setStreakRecords(records);
        if (user) setIsAdmin(await isCurrentUserAdmin(currentClubId!));
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load lifetime stats.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [currentClubId, clubLoading]);

  async function handleToggleExpand(name: string) {
    if (expandedName === name) {
      setExpandedName(null);
      return;
    }
    if (!currentClubId) return;
    setExpandedName(name);
    setExpandedLoading(true);
    try {
      const [rivalries, bests] = await Promise.all([fetchRivalriesForPlayer(currentClubId, name), fetchPersonalBests(currentClubId, name)]);
      setExpandedRivalries(rivalries);
      setExpandedBests(bests);
    } catch {
      setExpandedRivalries([]);
      setExpandedBests(null);
    } finally {
      setExpandedLoading(false);
    }
  }

  function chemistryFor(name: string) {
    const totalsByName = new Map(lifetime.map(p => [p.name, { wins: p.wins, gamesPlayed: p.gamesPlayed }]));
    const myTotals = totalsByName.get(name);
    if (!myTotals) return [];
    return duos
      .filter(d => d.players.includes(name))
      .map(d => {
        const partner = d.players[0] === name ? d.players[1] : d.players[0];
        const partnerTotals = totalsByName.get(partner);
        if (!partnerTotals) return null;
        const score = computeChemistryScore({ wins: d.wins, gamesPlayed: d.gamesPlayed }, myTotals, partnerTotals);
        return score === null ? null : { partner, score };
      })
      .filter((x): x is { partner: string; score: number } => x !== null)
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  }

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId) return <main className="page"><p>Join or create a club first — see <a href="/clubs">Clubs</a>.</p></main>;
  if (loadError) return <main className="page"><p style={{ color: 'var(--danger)' }}>{loadError}</p></main>;

  const winStreakRecordHolder = streakRecords.find(r => r.streakType === 'win')?.holderName;
  const lossStreakRecordHolder = streakRecords.find(r => r.streakType === 'loss')?.holderName;

  const eligibleDuos = duos.filter(d => d.gamesPlayed >= POWER_DUO_MIN_GAMES);
  const topDuo = eligibleDuos.length > 0 ? [...eligibleDuos].sort((a, b) => b.winPct - a.winPct)[0] : null;

  const sorted = [...lifetime];
  if (sortKey === 'wins') sorted.sort((a, b) => b.wins - a.wins);
  else if (sortKey === 'winPct') sorted.sort((a, b) => b.winPct - a.winPct);
  else if (sortKey === 'gamesPlayed') sorted.sort((a, b) => b.gamesPlayed - a.gamesPlayed);
  else if (sortKey === 'pointsFor') sorted.sort((a, b) => b.pointsFor - a.pointsFor);
  else if (sortKey === 'mvp') sorted.sort((a, b) => (mvpCounts.get(b.name) ?? 0) - (mvpCounts.get(a.name) ?? 0));
  // 'rank' keeps the incoming Wilson-score order from fetchLifetimeLeaderboard

  async function handleShareStats() {
    if (!statsCaptureRef.current) return;
    setImageShareError(null);
    try {
      const result = await shareElementAsImage(statsCaptureRef.current, 'lifetime-stats.png');
      if (result === 'downloaded') {
        setImageShareError('Image downloaded — attach it to WhatsApp manually (direct share isn\'t supported on this browser).');
      }
    } catch (e) {
      setImageShareError(e instanceof Error ? e.message : 'Failed to share image.');
    }
  }

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href="/league" className="text-link-btn">← League</Link>
        {isAdmin && (
          <button className="icon-btn" aria-label="Share lifetime stats image on WhatsApp" onClick={handleShareStats}>
            📤
          </button>
        )}
      </div>

      <h1>Lifetime Stats</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', padding: '0 8px', marginTop: 4 }}>
        Min {MIN_GAMES_FOR_RANKING} games to be ranked. Default order is confidence-adjusted (Wilson score) — accounts
        for sample size, not just raw win%.
      </p>
      {imageShareError && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 13, marginTop: 8 }}>{imageShareError}</p>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, marginBottom: 12 }}>
        {([
          ['rank', 'Ranked'],
          ['wins', 'Wins'],
          ['winPct', 'Win %'],
          ['gamesPlayed', 'Games'],
          ['pointsFor', 'Points'],
          ['mvp', 'MVP'],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            className={sortKey === key ? 'btn-primary' : 'btn-secondary'}
            style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }}
            onClick={() => setSortKey(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflowX: 'auto' }} ref={statsCaptureRef}>
        {sorted.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No games played yet.</p>}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingBottom: 8 }}>#</th>
              <th style={{ textAlign: 'left', paddingBottom: 8 }}>Player</th>
              <th style={{ paddingBottom: 8 }}>W</th>
              <th style={{ paddingBottom: 8 }}>L</th>
              <th style={{ paddingBottom: 8 }}>Win%</th>
              <th style={{ paddingBottom: 8 }}>Games</th>
              <th style={{ paddingBottom: 8 }}>For</th>
              <th style={{ paddingBottom: 8 }}>Ag</th>
              <th style={{ paddingBottom: 8 }}>MVP</th>
              <th style={{ paddingBottom: 8 }}>Flight</th>
              <th style={{ paddingBottom: 8, textAlign: 'left' }}>Badges</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const flight = flightByName.get(p.name) ?? 'Bronze';
              const playerDuos = duos.filter(d => d.players.includes(p.name));
              const badges = computeBadges({
                gamesPlayed: p.gamesPlayed,
                currentStreak: streaks.get(p.name) ?? 0,
                mvpCount: mvpCounts.get(p.name) ?? 0,
                flight,
                isWinStreakRecordHolder: winStreakRecordHolder === p.name,
                isLossStreakRecordHolder: lossStreakRecordHolder === p.name,
                duoCount: playerDuos.length,
                hasPowerDuo: playerDuos.some(d => d.gamesPlayed >= POWER_DUO_MIN_GAMES && d.winPct >= POWER_DUO_MIN_WIN_RATE),
                isClubTopDuo: topDuo !== null && topDuo.players.includes(p.name),
              });
              const isExpanded = expandedName === p.name;
              return (
                <Fragment key={p.name}>
                  <tr
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => handleToggleExpand(p.name)}
                  >
                    <td style={{ padding: '8px 0', color: p.provisional ? 'var(--muted)' : undefined }}>{p.provisional ? '–' : i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={p.name} size={22} />
                        {p.name}
                        {p.provisional && (
                          <span
                            title={`Fewer than ${MIN_GAMES_FOR_RANKING} games — score not reliable yet`}
                            style={{ fontSize: 10, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}
                          >
                            provisional
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{p.wins}</td>
                    <td style={{ textAlign: 'center' }}>{p.losses}</td>
                    <td style={{ textAlign: 'center', color: p.provisional ? 'var(--muted)' : undefined }}>{(p.winPct * 100).toFixed(0)}%</td>
                    <td style={{ textAlign: 'center' }}>{p.gamesPlayed}</td>
                    <td style={{ textAlign: 'center' }}>{p.pointsFor}</td>
                    <td style={{ textAlign: 'center' }}>{p.pointsAgainst}</td>
                    <td style={{ textAlign: 'center' }}>{mvpCounts.get(p.name) ?? 0}</td>
                    <td style={{ textAlign: 'center' }}>{flightByName.get(p.name) ?? '—'}</td>
                    <td>
                      {badges.length === 0 ? (
                        '—'
                      ) : (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {badges.map(b => (
                            <BadgeMedallion key={b.id} badge={b} />
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={11} style={{ background: 'var(--background)', padding: 12 }}>
                        {expandedLoading ? (
                          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                            {expandedBests && expandedBests.biggestMargin !== null && (
                              <div>
                                <strong>🏆 Personal Bests</strong>
                                <p style={{ margin: '4px 0 0' }}>
                                  Biggest win: {expandedBests.biggestMarginOwnScore}-{expandedBests.biggestMarginOppScore} vs{' '}
                                  {expandedBests.biggestMarginOpponents} (margin of {expandedBests.biggestMargin})
                                </p>
                                <p style={{ margin: '2px 0 0' }}>Longest-ever win streak: {expandedBests.longestStreak}</p>
                              </div>
                            )}

                            <div>
                              <strong>⚔️ Head-to-Head</strong>
                              {expandedRivalries.length === 0 && <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>No games logged against anyone yet.</p>}
                              {expandedRivalries.slice(0, 10).map(r => (
                                <p key={r.players.join('|')} style={{ margin: '2px 0 0' }}>
                                  vs {r.players[1]} — {r.record[0]}-{r.record[1]} ({r.gamesTogether} games)
                                </p>
                              ))}
                            </div>

                            <div>
                              <strong>🧪 Team Chemistry</strong>
                              {chemistryFor(p.name).length === 0 && <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>Not enough games with any one partner yet.</p>}
                              {chemistryFor(p.name).slice(0, 5).map(c => (
                                <p key={c.partner} style={{ margin: '2px 0 0' }}>
                                  with {c.partner}: {c.score > 0 ? '+' : ''}{(c.score * 100).toFixed(0)}% vs solo form
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

    </main>
  );
}
