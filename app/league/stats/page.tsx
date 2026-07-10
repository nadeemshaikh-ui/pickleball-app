'use client';

import { Fragment, useEffect, useState } from 'react';
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
import { fetchPersonalBests, type PersonalBests } from '@/lib/personalBests';
import { computeChemistryScore } from '@/lib/chemistry';
import { flightForRating } from '@/lib/flights';
import { computeBadges } from '@/lib/badges';
import { preloadPlayerPhotos } from '@/lib/playerPhotos';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';
import { listPlayers } from '@/lib/players';
import { shareToWhatsApp } from '@/lib/whatsapp';
import { useCurrentClub } from '@/lib/useCurrentClub';
import Avatar from '@/components/Avatar';

type SortKey = 'rank' | 'wins' | 'winPct' | 'gamesPlayed' | 'pointsFor' | 'mvp';

export default function LeagueStatsPage() {
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [lifetime, setLifetime] = useState<LifetimePlayerStats[]>([]);
  const [mvpCounts, setMvpCounts] = useState<Map<string, number>>(new Map());
  const [streaks, setStreaks] = useState<Map<string, number>>(new Map());
  const [flightByName, setFlightByName] = useState<Map<string, string>>(new Map());
  const [duos, setDuos] = useState<RankedDuo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('rank');

  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [expandedRivalries, setExpandedRivalries] = useState<Rivalry[]>([]);
  const [expandedBests, setExpandedBests] = useState<PersonalBests | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);

  useEffect(() => {
    if (clubLoading) return;
    if (!currentClubId) {
      setLoading(false);
      return;
    }
    async function init() {
      try {
        const [lb, mvp, streakMap, players, duoList, , user] = await Promise.all([
          fetchLifetimeLeaderboard(currentClubId!),
          fetchMvpCounts(currentClubId!),
          fetchStreaks(currentClubId!),
          listPlayers(currentClubId!),
          fetchBestDuos(currentClubId!),
          preloadPlayerPhotos(),
          getCurrentUser(),
        ]);
        setLifetime(lb);
        setMvpCounts(mvp);
        setStreaks(streakMap);
        setFlightByName(new Map(players.map(p => [p.name, flightForRating(p.elo_rating)])));
        setDuos(duoList);
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

  const rankedLifetime = lifetime.filter(p => !p.provisional);
  const provisionalLifetime = lifetime.filter(p => p.provisional);

  const sorted = [...rankedLifetime];
  if (sortKey === 'wins') sorted.sort((a, b) => b.wins - a.wins);
  else if (sortKey === 'winPct') sorted.sort((a, b) => b.winPct - a.winPct);
  else if (sortKey === 'gamesPlayed') sorted.sort((a, b) => b.gamesPlayed - a.gamesPlayed);
  else if (sortKey === 'pointsFor') sorted.sort((a, b) => b.pointsFor - a.pointsFor);
  else if (sortKey === 'mvp') sorted.sort((a, b) => (mvpCounts.get(b.name) ?? 0) - (mvpCounts.get(a.name) ?? 0));
  // 'rank' keeps the incoming Wilson-score order from fetchLifetimeLeaderboard

  function shareText(): string {
    const lines = ['📊 Lifetime League Stats', ''];
    sorted.slice(0, 15).forEach((p, i) => {
      lines.push(`${i + 1}. ${p.name} — ${p.wins}W-${p.losses}L (${(p.winPct * 100).toFixed(0)}%), ${p.gamesPlayed} games`);
    });
    return lines.join('\n');
  }

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href="/league" className="text-link-btn">← League</Link>
        {isAdmin && (
          <button className="icon-btn" aria-label="Share lifetime stats on WhatsApp" onClick={() => shareToWhatsApp(shareText())}>
            📤
          </button>
        )}
      </div>

      <h1>Lifetime Stats</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', padding: '0 8px', marginTop: 4 }}>
        Min {MIN_GAMES_FOR_RANKING} games to be ranked. Default order is confidence-adjusted (Wilson score) — accounts
        for sample size, not just raw win%.
      </p>

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

      <div className="card" style={{ overflowX: 'auto' }}>
        {sorted.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Nobody's hit {MIN_GAMES_FOR_RANKING} games yet.</p>}
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
              const badges = computeBadges({
                gamesPlayed: p.gamesPlayed,
                currentStreak: streaks.get(p.name) ?? 0,
                mvpCount: mvpCounts.get(p.name) ?? 0,
                flight,
              });
              const isExpanded = expandedName === p.name;
              return (
                <Fragment key={p.name}>
                  <tr
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => handleToggleExpand(p.name)}
                  >
                    <td style={{ padding: '8px 0' }}>{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={p.name} size={22} />
                        {p.name}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{p.wins}</td>
                    <td style={{ textAlign: 'center' }}>{p.losses}</td>
                    <td style={{ textAlign: 'center' }}>{(p.winPct * 100).toFixed(0)}%</td>
                    <td style={{ textAlign: 'center' }}>{p.gamesPlayed}</td>
                    <td style={{ textAlign: 'center' }}>{p.pointsFor}</td>
                    <td style={{ textAlign: 'center' }}>{p.pointsAgainst}</td>
                    <td style={{ textAlign: 'center' }}>{mvpCounts.get(p.name) ?? 0}</td>
                    <td style={{ textAlign: 'center' }}>{flightByName.get(p.name) ?? '—'}</td>
                    <td title={badges.map(b => b.label).join(', ')}>{badges.map(b => b.emoji).join(' ') || '—'}</td>
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

      {provisionalLifetime.length > 0 && (
        <>
          <h2>Still Building a Record</h2>
          <p style={{ fontSize: 11, color: 'var(--muted)', padding: '0 8px', marginBottom: 4 }}>
            Fewer than {MIN_GAMES_FOR_RANKING} games — shown here, not yet ranked.
          </p>
          <div className="card">
            {provisionalLifetime.map(p => (
              <div key={p.name} className="leaderboard-row">
                <Avatar name={p.name} size={24} />
                <span className="leaderboard-name">{p.name}</span>
                <span className="leaderboard-stats">
                  {p.wins}W-{p.losses}L · {p.gamesPlayed} games
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
