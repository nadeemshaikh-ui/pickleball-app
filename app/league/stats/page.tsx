'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Share2, PartyPopper, Zap, Trophy, Swords, FlaskConical } from 'lucide-react';
import {
  fetchLifetimeLeaderboard,
  fetchMvpCounts,
  fetchStreaks,
  fetchBestDuos,
  fetchRivalriesForPlayer,
  fetchClosestRivalries,
  MIN_GAMES_FOR_RANKING,
  type LifetimePlayerStats,
  type RankedDuo,
  type Rivalry,
} from '@/lib/leagueStats';
import { fetchStreakRecords, type StreakRecord } from '@/lib/streakRecords';
import { recordNewlyEarnedBadges } from '@/lib/badgeEvents';
import { fetchPendingChallenges, createChallenge, type Challenge } from '@/lib/challenges';
import ShareableBadgeCard from '@/components/ShareableBadgeCard';
import { fetchPersonalBests, fetchClubStreakBests, type PersonalBests, type StreakBest } from '@/lib/personalBests';
import { computeChemistryScore } from '@/lib/chemistry';
import { flightForRating } from '@/lib/flights';
import { computeBadges, BADGE_CATALOG, type Badge, type PlayerBadgeInput } from '@/lib/badges';
import { fetchLifetimeGameStats, type LifetimeGameStats } from '@/lib/lifetimeGameStats';
import { fetchLadderStandings } from '@/lib/ladderStandings';
import { fetchCurrentBadgeHolders, type BadgeHolder } from '@/lib/badgeHolders';
import { preloadPlayerPhotos } from '@/lib/playerPhotos';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';
import { listPlayers, getOwnPlayer, setEquippedBadge } from '@/lib/players';
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
  const [streakBests, setStreakBests] = useState<Map<string, StreakBest>>(new Map());
  const [equippedByName, setEquippedByName] = useState<Map<string, string | null>>(new Map());
  const [gameStatsByName, setGameStatsByName] = useState<Map<string, LifetimeGameStats>>(new Map());
  const [maxRivalryByName, setMaxRivalryByName] = useState<Map<string, number>>(new Map());
  const [ladderWinsByName, setLadderWinsByName] = useState<Map<string, number>>(new Map());
  const [badgeHolders, setBadgeHolders] = useState<Map<string, BadgeHolder>>(new Map());
  const [ownPlayerId, setOwnPlayerId] = useState<string | null>(null);
  const [ownPlayerName, setOwnPlayerName] = useState<string | null>(null);
  const [equipping, setEquipping] = useState(false);
  const [newlyEarned, setNewlyEarned] = useState<Badge[]>([]);
  const [pendingChallenges, setPendingChallenges] = useState<Challenge[]>([]);
  const [challenging, setChallenging] = useState<string | null>(null);
  const [ownPhotoUrl, setOwnPhotoUrl] = useState<string | null>(null);
  const [shareCardBadge, setShareCardBadge] = useState<Badge | null>(null);
  const [sharingBadge, setSharingBadge] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [nameFilter, setNameFilter] = useState('');

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
        const [lb, mvp, streakMap, players, duoList, records, bests, gameStats, rivalries, ladderStandings, holders, , user] = await Promise.all([
          fetchLifetimeLeaderboard(currentClubId!),
          fetchMvpCounts(currentClubId!),
          fetchStreaks(currentClubId!),
          listPlayers(currentClubId!),
          fetchBestDuos(currentClubId!),
          fetchStreakRecords(currentClubId!),
          fetchClubStreakBests(currentClubId!),
          fetchLifetimeGameStats(currentClubId!),
          fetchClosestRivalries(currentClubId!),
          fetchLadderStandings(currentClubId!),
          fetchCurrentBadgeHolders(currentClubId!),
          preloadPlayerPhotos(),
          getCurrentUser(),
        ]);
        setLifetime(lb);
        setStreakBests(bests);
        setMvpCounts(mvp);
        setStreaks(streakMap);
        setFlightByName(new Map(players.map(p => [p.name, flightForRating(p.elo_rating)])));
        setDuos(duoList);
        setStreakRecords(records);
        setEquippedByName(new Map(players.map(p => [p.name, p.equipped_badge_id])));
        setGameStatsByName(gameStats);
        setLadderWinsByName(new Map(ladderStandings.map(s => [s.player_name, s.wins])));
        setBadgeHolders(holders);

        const maxRivalry = new Map<string, number>();
        for (const r of rivalries) {
          maxRivalry.set(r.players[0], Math.max(maxRivalry.get(r.players[0]) ?? 0, r.gamesTogether));
          maxRivalry.set(r.players[1], Math.max(maxRivalry.get(r.players[1]) ?? 0, r.gamesTogether));
        }
        setMaxRivalryByName(maxRivalry);

        function extraBadgeInputs(name: string): Partial<PlayerBadgeInput> {
          const gs = gameStats.get(name);
          return {
            maxRivalryGames: maxRivalry.get(name) ?? 0,
            formatsPlayed: gs?.formats.size ?? 0,
            squadRivalryWins: gs?.squadRivalryWins ?? 0,
            maxWinMargin: gs?.maxMargin ?? 0,
            nailBiterGames: gs?.nailBiters ?? 0,
            hasShutout: (gs?.shutouts ?? 0) > 0,
            perfectSessions: gs?.perfectSessions ?? 0,
            nightSessions: gs?.nightSessions ?? 0,
            ladderWins: ladderStandings.find(s => s.player_name === name)?.wins ?? 0,
            isLadderChampion: holders.get('ladder_champion')?.holderName === name,
            isTheRealKing: holders.get('the_real_king')?.holderName === name,
          };
        }
        if (user) setIsAdmin(await isCurrentUserAdmin(currentClubId!));

        if (user) {
          const own = await getOwnPlayer(currentClubId!, user.id);
          if (own) {
            setOwnPlayerId(own.id);
            setOwnPlayerName(own.name);
            setOwnPhotoUrl(own.photo_url);
            fetchPendingChallenges(currentClubId!, own.name).then(setPendingChallenges).catch(() => setPendingChallenges([]));

            const ownStats = lb.find(p => p.name === own.name);
            if (ownStats) {
              const winStreakRecordHolder = records.find(r => r.streakType === 'win')?.holderName;
              const lossStreakRecordHolder = records.find(r => r.streakType === 'loss')?.holderName;
              const ownDuos = duoList.filter(d => d.players.includes(own.name));
              const eligible = duoList.filter(d => d.gamesPlayed >= POWER_DUO_MIN_GAMES);
              const top = eligible.length > 0 ? [...eligible].sort((a, b) => b.winPct - a.winPct)[0] : null;
              const ownBadges = computeBadges({
                gamesPlayed: ownStats.gamesPlayed,
                currentStreak: streakMap.get(own.name) ?? 0,
                mvpCount: mvp.get(own.name) ?? 0,
                flight: flightForRating(own.elo_rating),
                isWinStreakRecordHolder: winStreakRecordHolder === own.name,
                isLossStreakRecordHolder: lossStreakRecordHolder === own.name,
                duoCount: ownDuos.length,
                hasPowerDuo: ownDuos.some(d => d.gamesPlayed >= POWER_DUO_MIN_GAMES && d.winPct >= POWER_DUO_MIN_WIN_RATE),
                isClubTopDuo: top !== null && top.players.includes(own.name),
                ...extraBadgeInputs(own.name),
              });
              const newIds = await recordNewlyEarnedBadges(currentClubId!, own.name, ownBadges.map(b => b.id));
              if (newIds.length > 0) setNewlyEarned(ownBadges.filter(b => newIds.includes(b.id)));
            }
          }
        }
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

  async function handleChallenge(opponentName: string) {
    if (!currentClubId || !ownPlayerName) return;
    setChallenging(opponentName);
    try {
      await createChallenge(currentClubId, ownPlayerName, opponentName);
      const refreshed = await fetchPendingChallenges(currentClubId, ownPlayerName);
      setPendingChallenges(refreshed);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to send challenge.');
    } finally {
      setChallenging(null);
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

  const sorted = lifetime.filter(p => p.name.toLowerCase().includes(nameFilter.trim().toLowerCase()));
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
            <Share2 size={16} />
          </button>
        )}
      </div>

      {newlyEarned.length > 0 && (
        <div
          className="card"
          style={{ background: 'var(--surface-2, var(--card-bg))', border: '2px solid var(--text-accent, gold)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <PartyPopper size={20} />
          <div style={{ flex: 1 }}>
            <strong>New badge{newlyEarned.length > 1 ? 's' : ''} unlocked!</strong>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {newlyEarned.map(b => (
                <span key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                  <BadgeMedallion badge={b} size={22} /> {b.label}
                </span>
              ))}
            </div>
          </div>
          <button className="text-link-btn" onClick={() => setNewlyEarned([])}>Dismiss</button>
        </div>
      )}

      {pendingChallenges.length > 0 && (
        <div className="card" style={{ marginBottom: 12, fontSize: 13 }}>
          <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Zap size={14} /> Pending challenges</strong>
          {pendingChallenges.map(c => (
            <p key={c.id} style={{ margin: '4px 0 0', color: 'var(--muted)' }}>
              {c.challengerName === ownPlayerName ? `You challenged ${c.opponentName}` : `${c.challengerName} challenged you`} — resolves next time you're on opposite teams
            </p>
          ))}
        </div>
      )}

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

      <input
        value={nameFilter}
        onChange={e => setNameFilter(e.target.value)}
        placeholder="Search players…"
        aria-label="Search players"
        style={{ width: '100%', minHeight: 40, padding: '8px 12px', fontSize: 15, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12 }}
      />

      <div ref={statsCaptureRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.length === 0 && <p className="card" style={{ color: 'var(--muted)', fontSize: 14 }}>No games played yet.</p>}
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
                maxRivalryGames: maxRivalryByName.get(p.name) ?? 0,
                formatsPlayed: gameStatsByName.get(p.name)?.formats.size ?? 0,
                squadRivalryWins: gameStatsByName.get(p.name)?.squadRivalryWins ?? 0,
                maxWinMargin: gameStatsByName.get(p.name)?.maxMargin ?? 0,
                nailBiterGames: gameStatsByName.get(p.name)?.nailBiters ?? 0,
                hasShutout: (gameStatsByName.get(p.name)?.shutouts ?? 0) > 0,
                perfectSessions: gameStatsByName.get(p.name)?.perfectSessions ?? 0,
                nightSessions: gameStatsByName.get(p.name)?.nightSessions ?? 0,
                ladderWins: ladderWinsByName.get(p.name) ?? 0,
                isLadderChampion: badgeHolders.get('ladder_champion')?.holderName === p.name,
                isTheRealKing: badgeHolders.get('the_real_king')?.holderName === p.name,
              });
              const isExpanded = expandedName === p.name;
              const explicitEquipped = equippedByName.get(p.name);
              const fallbackTitle = [...badges].sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0))[0] ?? null;
              const equippedBadge = explicitEquipped
                ? BADGE_CATALOG.find(b => b.id === explicitEquipped) ?? null
                : fallbackTitle;
              const isSelf = p.name === ownPlayerName;
              return (
                <Fragment key={p.name}>
                  <div className="card" style={{ cursor: 'pointer' }} onClick={() => handleToggleExpand(p.name)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, width: 20, color: p.provisional ? 'var(--muted)' : undefined }}>{p.provisional ? '–' : i + 1}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                        <Avatar name={p.name} size={22} />
                        {p.name}
                        {equippedBadge && (
                          <span
                            title={equippedBadge.description}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px 1px 2px' }}
                          >
                            <BadgeMedallion badge={equippedBadge} size={14} /> {equippedBadge.label}
                          </span>
                        )}
                        {p.provisional && (
                          <span
                            title={`Fewer than ${MIN_GAMES_FOR_RANKING} games — score not reliable yet`}
                            style={{ fontSize: 10, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}
                          >
                            provisional
                          </span>
                        )}
                        {isSelf && badges.length > 0 && (
                          <select
                            aria-label="Equip a title"
                            value={explicitEquipped ?? ''}
                            disabled={equipping}
                            onClick={e => e.stopPropagation()}
                            onChange={async e => {
                              e.stopPropagation();
                              if (!ownPlayerId) return;
                              const value = e.target.value || null;
                              setEquipping(true);
                              try {
                                await setEquippedBadge(ownPlayerId, value);
                                setEquippedByName(prev => new Map(prev).set(p.name, value));
                              } catch (err) {
                                setLoadError(err instanceof Error ? err.message : 'Failed to equip title.');
                              } finally {
                                setEquipping(false);
                              }
                            }}
                            style={{ fontSize: 10, maxWidth: 130 }}
                          >
                            <option value="">Auto (highest tier)</option>
                            {badges.map(b => (
                              <option key={b.id} value={b.id}>{b.label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
                        gap: 8,
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: '1px solid var(--border)',
                        fontSize: 13,
                      }}
                    >
                      <div><div style={{ color: 'var(--muted)', fontSize: 10 }}>W-L</div>{p.wins}-{p.losses}</div>
                      <div><div style={{ color: 'var(--muted)', fontSize: 10 }}>Win%</div><span style={{ color: p.provisional ? 'var(--muted)' : undefined }}>{(p.winPct * 100).toFixed(0)}%</span></div>
                      <div><div style={{ color: 'var(--muted)', fontSize: 10 }}>Games</div>{p.gamesPlayed}</div>
                      <div><div style={{ color: 'var(--muted)', fontSize: 10 }}>For/Ag</div>{p.pointsFor}/{p.pointsAgainst}</div>
                      <div><div style={{ color: 'var(--muted)', fontSize: 10 }}>MVP</div>{mvpCounts.get(p.name) ?? 0}</div>
                      <div><div style={{ color: 'var(--muted)', fontSize: 10 }}>Flight</div>{flightByName.get(p.name) ?? '—'}</div>
                      <div><div style={{ color: 'var(--muted)', fontSize: 10 }}>Best streak</div>{streakBests.get(p.name)?.longestWinStreak ?? 0}</div>
                      <div><div style={{ color: 'var(--muted)', fontSize: 10 }}>Worst streak</div>{streakBests.get(p.name)?.longestLossStreak ?? 0}</div>
                    </div>

                    {badges.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                        {badges.slice(0, 3).map(b =>
                          isSelf ? (
                            <button
                              key={b.id}
                              aria-label={`Share ${b.label} badge`}
                              onClick={e => {
                                e.stopPropagation();
                                setShareCardBadge(b);
                              }}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                            >
                              <BadgeMedallion badge={b} />
                            </button>
                          ) : (
                            <BadgeMedallion key={b.id} badge={b} />
                          )
                        )}
                        {badges.length > 3 && (
                          <Link href="/league/badges" style={{ fontSize: 11, color: 'var(--muted)' }} onClick={e => e.stopPropagation()}>
                            +{badges.length - 3} more
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="card" style={{ marginTop: -4, background: 'var(--background)' }}>
                        {expandedLoading ? (
                          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                            {expandedBests && expandedBests.biggestMargin !== null && (
                              <div>
                                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Trophy size={14} /> Personal Bests</strong>
                                <p style={{ margin: '4px 0 0' }}>
                                  Biggest win: {expandedBests.biggestMarginOwnScore}-{expandedBests.biggestMarginOppScore} vs{' '}
                                  {expandedBests.biggestMarginOpponents} (margin of {expandedBests.biggestMargin})
                                </p>
                                <p style={{ margin: '2px 0 0' }}>Longest-ever win streak: {expandedBests.longestStreak}</p>
                              </div>
                            )}

                            <div>
                              <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Swords size={14} /> Head-to-Head</strong>
                              {expandedRivalries.length === 0 && <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>No games logged against anyone yet.</p>}
                              {expandedRivalries.slice(0, 10).map(r => (
                                <p key={r.players.join('|')} style={{ margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                                  vs {r.players[1]} — {r.record[0]}-{r.record[1]} ({r.gamesTogether} games)
                                  {isSelf && (
                                    <button
                                      className="text-link-btn"
                                      style={{ fontSize: 11 }}
                                      disabled={challenging === r.players[1] || pendingChallenges.some(c => c.opponentName === r.players[1] || c.challengerName === r.players[1])}
                                      onClick={e => {
                                        e.stopPropagation();
                                        handleChallenge(r.players[1]);
                                      }}
                                    >
                                      {pendingChallenges.some(c => c.opponentName === r.players[1] || c.challengerName === r.players[1])
                                        ? 'Challenge pending'
                                        : <><Zap size={11} /> Challenge</>}
                                    </button>
                                  )}
                                </p>
                              ))}
                            </div>

                            <div>
                              <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FlaskConical size={14} /> Team Chemistry</strong>
                              {chemistryFor(p.name).length === 0 && <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>Not enough games with any one partner yet.</p>}
                              {chemistryFor(p.name).slice(0, 5).map(c => (
                                <p key={c.partner} style={{ margin: '2px 0 0' }}>
                                  with {c.partner}: {c.score > 0 ? '+' : ''}{(c.score * 100).toFixed(0)}% vs solo form
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </Fragment>
              );
            })}
      </div>

      {shareCardBadge && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={() => setShareCardBadge(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }} onClick={e => e.stopPropagation()}>
            <div ref={shareCardRef}>
              <ShareableBadgeCard badge={shareCardBadge} playerName={ownPlayerName ?? ''} photoUrl={ownPhotoUrl} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-primary"
                disabled={sharingBadge}
                onClick={async () => {
                  if (!shareCardRef.current) return;
                  setSharingBadge(true);
                  try {
                    const result = await shareElementAsImage(shareCardRef.current, `badge-${shareCardBadge.id}.png`);
                    if (result === 'shared') setShareCardBadge(null);
                  } catch {
                    // user cancelled the share sheet — leave the card open
                  } finally {
                    setSharingBadge(false);
                  }
                }}
              >
                {sharingBadge ? 'Preparing…' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Share2 size={14} /> Share</span>}
              </button>
              <button className="btn-secondary" onClick={() => setShareCardBadge(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
