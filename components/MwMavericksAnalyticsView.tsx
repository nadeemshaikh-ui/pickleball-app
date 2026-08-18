'use client';

import React, { useState, useMemo } from 'react';
import { Trophy, User, Users, BarChart2, Target, Zap, AlertTriangle, ListOrdered, Sparkles, Search, CheckSquare, Square, Filter, X, CheckCircle2, Award, Calendar, Clock, TrendingUp, Activity, ArrowUpDown } from 'lucide-react';

interface MatchRow {
  id?: string;
  session_id?: string;
  round_number: number;
  court: number;
  team_a: string[];
  team_b: string[];
  score_a: number | null;
  score_b: number | null;
  created_at?: string;
}

interface MwMavericksAnalyticsViewProps {
  rounds: MatchRow[];
  mwPlayers: string[];
  svkmPlayers: string[];
  mwScore: number;
  svkmScore: number;
  clubId?: string;
}

interface PlayerStat {
  canonicalName: string;
  displayName: string;
  registeredName: string;
  squad: 'MW Mavericks' | 'SVKM Challengers' | 'Monday-Wednesday Member';
  sessionsPlayedCount: number;
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  pf: number;
  pa: number;
  pd: number;
  avgPf: number;
  avgPa: number;
  pointSharePct: number;
  streakText: string;
  recentForm: ('W' | 'L')[];
  courtStats: Record<number, { played: number; wins: number; losses: number; winRate: number }>;
  clutchPlayed: number;
  clutchWins: number;
  clutchWinRate: number;
  blowoutWins: number;
  blowoutLosses: number;
  tournamentsWithDates: { name: string; dateStr: string }[];
  partners: Record<string, { played: number; wins: number; losses: number; pf: number; pa: number; pd: number }>;
  opponents: Record<string, { played: number; wins: number; losses: number; pf: number; pa: number; pd: number }>;
  matchHistory: {
    roundNumber: number;
    court: number;
    partner: string;
    opponents: string[];
    myScore: number;
    oppScore: number;
    won: boolean;
    tournament: string;
    dateStr: string;
  }[];
}

interface DuoStat {
  pair: string;
  squad: string;
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  pd: number;
}

const PLAYER_NAME_ALIASES: Record<string, string> = {
  'nadim shaikh': 'Nadeem',
  'nadeem': 'Nadeem',
  'blaze': 'Nadeem',
  'sumiit shettyy': 'Sumit',
  'sumit': 'Sumit',
  'sumeet': 'Sumit',
  'sushe': 'Sumit',
  'mbs': 'MBS (Miten)',
  'miten shah': 'MBS (Miten)',
  'miten': 'MBS (Miten)',
  'hemal': 'Hemal',
  'hemal shah': 'Hemal',
  'hetal': 'Hemal',
  'karan': 'Karan',
  'karan mastakar': 'Karan',
  'tushar': 'Tushar',
  'tushar shah': 'Tushar',
  'rahul': 'Rahul',
  'rahul maniar': 'Rahul',
  '12': '12',
  'hiten': 'Hiten',
  'hiten thakker': 'Hiten',
  'gopal': 'Gopal',
  'gopal parwal': 'Gopal',
  'amresh sahay': 'Amresh Sahay',
  'amresh': 'Amresh Sahay',
  'ambresh': 'Ambresh',
  'saurabh': 'Saurabh',
  'saurabh gandhi': 'Saurabh',
  'deep': 'Deep',
  'deep chhatlani': 'Deep',
  'sagar': 'Sagar',
  'sagar choksi': 'Sagar',
  'vicky': 'Vicky',
  'viki': 'Vicky',
  'viki rajani': 'Vicky',
  'sid': 'Siddharth',
  'siddharth': 'Siddharth',
  'siddharth gupta': 'Siddharth',
  'vinit': 'Vinit',
  'vinit shanghvi': 'Vinit',
  'aryan': 'Aryan',
  'aryan khanna': 'Aryan',
  'ankit': 'Ankit',
  'mrugesh': 'Mrugesh',
  'chirag': 'Chirag',
  'gaurav': 'Gaurav',
  'tejash': 'Tejash',
  'tejas': 'Tejash',
  'anish': 'Anish',
  'dd': 'DD',
  'harsh': 'Harsh',
  'ketan': 'Ketan',
  'neel': 'Neel',
  'rahil': 'Rahil',
  'smit': 'Smit',
  'kris': 'Kris'
};

const DISQUALIFIED_PLACEHOLDERS = new Set<string>([
  'airavat', 'pickleboss', 'pickleboys', 'leos six', 'leo six', 'pickle boss', 'pickle boys', 'mw mavericks squad', 'svkm challengers squad'
]);

function isPlaceholderName(name: string): boolean {
  if (!name) return true;
  return DISQUALIFIED_PLACEHOLDERS.has(name.trim().toLowerCase());
}

function normalizePlayerName(name: string): string {
  if (!name) return 'Unknown';
  const clean = name.trim().toLowerCase();
  if (PLAYER_NAME_ALIASES[clean]) {
    return PLAYER_NAME_ALIASES[clean];
  }
  return name.trim();
}

function getTournamentMeta(sessionId?: string): { name: string; dateStr: string } {
  if (sessionId === 'mw_mavericks_season_2_2026') {
    return { name: 'MW Mavericks Season II', dateStr: 'Aug 12, 2026' };
  }
  if (sessionId === 'pb_sunday_2026') {
    return { name: 'MW Mavericks Season I', dateStr: 'Aug 9, 2026' };
  }
  return { name: 'Home Team vs Challengers', dateStr: 'Jul 29, 2026' };
}

export default function MwMavericksAnalyticsView({
  rounds,
  mwPlayers,
  svkmPlayers,
  mwScore,
  svkmScore,
  clubId
}: MwMavericksAnalyticsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'players' | 'diagnostic' | 'duos' | 'h2h' | 'matches'>('players');
  const [selectedDiagnosticPlayer, setSelectedDiagnosticPlayer] = useState<string>('Nadeem');
  const [matchTypeFilter, setMatchTypeFilter] = useState<'all' | 'clutch' | 'blowout' | 'high_scoring'>('all');
  const [h2hPlayerA, setH2hPlayerA] = useState<string>('Nadeem');
  const [h2hPlayerB, setH2hPlayerB] = useState<string>('MRUGESH');

  // PLAYER DETAIL MODAL STATE
  const [modalPlayerName, setModalPlayerName] = useState<string | null>(null);

  // MULTI-SELECT PLAYER FILTER STATE
  const [playerSearchTerm, setPlayerSearchTerm] = useState<string>('');
  const [selectedPlayerFilter, setSelectedPlayerFilter] = useState<Set<string>>(new Set());

  // LEADERBOARD SORT & TOP PLAYERS FILTER STATE
  const [sortField, setSortField] = useState<'winRate' | 'played' | 'wins' | 'pd' | 'avgPf' | 'clutchWinRate' | 'sessionsPlayedCount' | 'name'>('winRate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [topPlayersOnly, setTopPlayersOnly] = useState<boolean>(false);

  const isOfficialMavericks = clubId === 'd5b57890-3787-41bb-bf23-38bc95345011';

  // Master Roster of registered club members (isolated from Mavericks unless on Mavericks club page)
  const masterMwClubRoster = useMemo(() => {
    const rawList = isOfficialMavericks
      ? [
          'Nadeem', 'nadim shaikh', 'Sumit', 'sumiit shettyy',
          ...mwPlayers,
          '12', 'AMBRESH', 'AMIT', 'ANISH', 'ANKIT', 'CHIRAG', 'DD', 'GAURAV', 'GOPAL',
          'HARSH', 'HEMAL', 'HITEN', 'KARAN', 'KETAN', 'MBS', 'MRUGESH', 'NEEL', 'RAHIL',
          'SAGAR', 'SAURABH', 'SMIT', 'TEJAS', 'TEJASH', 'TUSHAR', 'VICKY',
          'Tushar Shah', 'Rahul Maniar', 'HEMAL SHAH', 'karan mastakar', 'Hiten Thakker',
          'Gopal Parwal', 'Ankit', 'Amresh Sahay', 'Miten Shah', 'Saurabh Gandhi',
          'Deep Chhatlani', 'Sagar Choksi', 'Vinit Shanghvi', 'Viki Rajani', 'Siddharth Gupta'
        ]
      : [...mwPlayers];

    const canonicalSet = new Set<string>();
    rawList.forEach(item => {
      const norm = normalizePlayerName(item);
      if (!isPlaceholderName(norm)) {
        canonicalSet.add(norm);
      }
    });
    return Array.from(canonicalSet).sort();
  }, [mwPlayers, isOfficialMavericks]);

  // Compute Advanced Player Statistics
  const { playerList, playerStatsMap, duoList } = useMemo(() => {
    const pMap = new Map<string, PlayerStat>();
    const sessionTracker = new Map<string, Set<string>>();

    const getSquad = (normName: string): 'MW Mavericks' | 'SVKM Challengers' | 'Monday-Wednesday Member' => {
      if (mwPlayers.map(normalizePlayerName).includes(normName)) return 'MW Mavericks';
      return 'Monday-Wednesday Member';
    };

    const initPlayer = (normName: string) => {
      if (isPlaceholderName(normName)) return;
      if (!isOfficialMavericks && !masterMwClubRoster.includes(normName)) return;
      if (!pMap.has(normName)) {
        pMap.set(normName, {
          canonicalName: normName,
          displayName: normName,
          registeredName: normName,
          squad: getSquad(normName),
          sessionsPlayedCount: 0,
          played: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          pf: 0,
          pa: 0,
          pd: 0,
          avgPf: 0,
          avgPa: 0,
          pointSharePct: 0,
          streakText: 'N/A',
          recentForm: [],
          courtStats: {},
          clutchPlayed: 0,
          clutchWins: 0,
          clutchWinRate: 0,
          blowoutWins: 0,
          blowoutLosses: 0,
          tournamentsWithDates: [],
          partners: {},
          opponents: {},
          matchHistory: []
        });
      }
    };

    masterMwClubRoster.forEach(p => initPlayer(p));
    const duoMap = new Map<string, DuoStat>();

    rounds.forEach(r => {
      const sa = r.score_a !== null && r.score_a !== undefined ? Number(r.score_a) : null;
      const sb = r.score_b !== null && r.score_b !== undefined ? Number(r.score_b) : null;
      if (sa === null || sb === null || (sa === 0 && sb === 0)) return;

      const { name: tournamentName, dateStr } = getTournamentMeta(r.session_id);
      const sessionId = r.session_id || 'mw_mavericks_season_2_2026';
      const courtNum = Number(r.court);

      const aWon = sa > sb;
      const bWon = sb > sa;
      const diff = Math.abs(sa - sb);
      const isClutch = diff <= 2;
      const isBlowout = diff >= 6;

      const teamA = (r.team_a || []).map(normalizePlayerName).filter(p => !isPlaceholderName(p));
      const teamB = (r.team_b || []).map(normalizePlayerName).filter(p => !isPlaceholderName(p));

      // Team A Players
      teamA.forEach(p => {
        initPlayer(p);
        const stat = pMap.get(p);
        if (!stat) return;

        stat.played += 1;
        stat.pf += sa;
        stat.pa += sb;
        stat.pd += sa - sb;

        if (!sessionTracker.has(p)) sessionTracker.set(p, new Set());
        sessionTracker.get(p)!.add(sessionId);

        if (!stat.courtStats[courtNum]) stat.courtStats[courtNum] = { played: 0, wins: 0, losses: 0, winRate: 0 };
        const cs = stat.courtStats[courtNum];
        cs.played += 1;

        if (!stat.tournamentsWithDates.some(t => t.name === tournamentName)) {
          stat.tournamentsWithDates.push({ name: tournamentName, dateStr });
        }

        if (isClutch) stat.clutchPlayed += 1;

        if (aWon) {
          stat.wins += 1;
          cs.wins += 1;
          if (isClutch) stat.clutchWins += 1;
          if (isBlowout) stat.blowoutWins += 1;
        } else if (bWon) {
          stat.losses += 1;
          cs.losses += 1;
          if (isBlowout) stat.blowoutLosses += 1;
        }

        const partner = teamA.find(other => other !== p) || 'Rotation / Single';
        stat.matchHistory.push({
          roundNumber: Number(r.round_number),
          court: courtNum,
          partner,
          opponents: teamB,
          myScore: sa,
          oppScore: sb,
          won: aWon,
          tournament: tournamentName,
          dateStr
        });
      });

      // Team B Players
      teamB.forEach(p => {
        initPlayer(p);
        const stat = pMap.get(p);
        if (!stat) return;

        stat.played += 1;
        stat.pf += sb;
        stat.pa += sa;
        stat.pd += sb - sa;

        if (!sessionTracker.has(p)) sessionTracker.set(p, new Set());
        sessionTracker.get(p)!.add(sessionId);

        if (!stat.courtStats[courtNum]) stat.courtStats[courtNum] = { played: 0, wins: 0, losses: 0, winRate: 0 };
        const cs = stat.courtStats[courtNum];
        cs.played += 1;

        if (!stat.tournamentsWithDates.some(t => t.name === tournamentName)) {
          stat.tournamentsWithDates.push({ name: tournamentName, dateStr });
        }

        if (isClutch) stat.clutchPlayed += 1;

        if (bWon) {
          stat.wins += 1;
          cs.wins += 1;
          if (isClutch) stat.clutchWins += 1;
          if (isBlowout) stat.blowoutWins += 1;
        } else if (aWon) {
          stat.losses += 1;
          cs.losses += 1;
          if (isBlowout) stat.blowoutLosses += 1;
        }

        const partner = teamB.find(other => other !== p) || 'Rotation / Single';
        stat.matchHistory.push({
          roundNumber: Number(r.round_number),
          court: courtNum,
          partner,
          opponents: teamA,
          myScore: sb,
          oppScore: sa,
          won: bWon,
          tournament: tournamentName,
          dateStr
        });
      });

      // Update Duo Synergy
      function recordPair(team: string[], won: boolean, pf: number, pa: number) {
        if (team.length === 2) {
          const [p1, p2] = team;
          if (isPlaceholderName(p1) || isPlaceholderName(p2)) return;
          [[p1, p2], [p2, p1]].forEach(([self, partner]) => {
            const ps = pMap.get(self);
            if (ps) {
              if (!ps.partners[partner]) ps.partners[partner] = { played: 0, wins: 0, losses: 0, pf: 0, pa: 0, pd: 0 };
              const prt = ps.partners[partner];
              prt.played += 1;
              if (won) prt.wins += 1; else prt.losses += 1;
              prt.pf += pf;
              prt.pa += pa;
              prt.pd += (pf - pa);
            }
          });
        }
      }

      function recordOpps(teamSelf: string[], teamOpp: string[], won: boolean, pf: number, pa: number) {
        teamSelf.forEach(self => {
          if (isPlaceholderName(self)) return;
          const ps = pMap.get(self);
          if (ps) {
            teamOpp.forEach(opp => {
              if (isPlaceholderName(opp)) return;
              if (!ps.opponents[opp]) ps.opponents[opp] = { played: 0, wins: 0, losses: 0, pf: 0, pa: 0, pd: 0 };
              const o = ps.opponents[opp];
              o.played += 1;
              if (won) o.wins += 1; else o.losses += 1;
              o.pf += pf;
              o.pa += pa;
              o.pd += (pf - pa);
            });
          }
        });
      }

      recordPair(teamA, aWon, sa, sb);
      recordPair(teamB, bWon, sb, sa);
      recordOpps(teamA, teamB, aWon, sa, sb);
      recordOpps(teamB, teamA, bWon, sb, sa);

      if (teamA.length === 2 && !isPlaceholderName(teamA[0]) && !isPlaceholderName(teamA[1])) {
        const duoKey = [...teamA].sort().join(' & ');
        if (!duoMap.has(duoKey)) {
          duoMap.set(duoKey, { pair: duoKey, squad: getSquad(teamA[0]), played: 0, wins: 0, losses: 0, winRate: 0, pd: 0 });
        }
        const duo = duoMap.get(duoKey)!;
        duo.played += 1;
        duo.pd += sa - sb;
        if (aWon) duo.wins += 1; else if (bWon) duo.losses += 1;
      }

      if (teamB.length === 2 && !isPlaceholderName(teamB[0]) && !isPlaceholderName(teamB[1])) {
        const duoKey = [...teamB].sort().join(' & ');
        if (!duoMap.has(duoKey)) {
          duoMap.set(duoKey, { pair: duoKey, squad: getSquad(teamB[0]), played: 0, wins: 0, losses: 0, winRate: 0, pd: 0 });
        }
        const duo = duoMap.get(duoKey)!;
        duo.played += 1;
        duo.pd += sb - sa;
        if (bWon) duo.wins += 1; else if (aWon) duo.losses += 1;
      }
    });

    const pList: PlayerStat[] = Array.from(pMap.values()).map(p => {
      const sSet = sessionTracker.get(p.canonicalName);
      const totalMatchPoints = p.pf + p.pa;
      const pointShare = totalMatchPoints > 0 ? Math.round((p.pf / totalMatchPoints) * 1000) / 10 : 0;

      // Compute Recent 5 Form & Streaks
      const historyReversed = [...p.matchHistory].reverse();
      const recent5 = historyReversed.slice(0, 5).map(m => m.won ? 'W' : 'L');

      let currentStreakVal = 0;
      let currentStreakType: 'W' | 'L' | null = null;
      for (const m of historyReversed) {
        const res = m.won ? 'W' : 'L';
        if (currentStreakType === null) {
          currentStreakType = res;
          currentStreakVal = 1;
        } else if (currentStreakType === res) {
          currentStreakVal += 1;
        } else {
          break;
        }
      }

      const streakTxt = currentStreakVal > 0
        ? (currentStreakType === 'W' ? `🔥 ${currentStreakVal} Win Streak` : `❄️ ${currentStreakVal} Loss Streak`)
        : 'Registered Roster Member';

      // Court Win Rates
      Object.keys(p.courtStats).forEach(cKey => {
        const courtId = Number(cKey);
        const cs = p.courtStats[courtId];
        cs.winRate = cs.played > 0 ? Math.round((cs.wins / cs.played) * 100) : 0;
      });

      return {
        ...p,
        sessionsPlayedCount: sSet ? sSet.size : (p.played > 0 ? 1 : 0),
        winRate: p.played > 0 ? Math.round((p.wins / p.played) * 100) : 0,
        avgPf: p.played > 0 ? Math.round((p.pf / p.played) * 10) / 10 : 0,
        avgPa: p.played > 0 ? Math.round((p.pa / p.played) * 10) / 10 : 0,
        pointSharePct: pointShare,
        streakText: streakTxt,
        recentForm: recent5,
        clutchWinRate: p.clutchPlayed > 0 ? Math.round((p.clutchWins / p.clutchPlayed) * 100) : 0,
      };
    }).sort((a, b) => {
      if (b.played === 0 && a.played > 0) return -1;
      if (a.played === 0 && b.played > 0) return 1;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.pd - a.pd;
    });

    const dList: DuoStat[] = Array.from(duoMap.values()).map(d => ({
      ...d,
      winRate: d.played > 0 ? Math.round((d.wins / d.played) * 100) : 0
    })).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pd - a.pd;
    });

    return { playerList: pList, playerStatsMap: pMap, duoList: dList };
  }, [rounds, masterMwClubRoster, mwPlayers]);

  const togglePlayerFilter = (pName: string) => {
    setSelectedPlayerFilter(prev => {
      const next = new Set(prev);
      if (next.has(pName)) next.delete(pName);
      else next.add(pName);
      return next;
    });
  };

  const clearPlayerFilter = () => {
    setSelectedPlayerFilter(new Set());
    setTopPlayersOnly(false);
  };
  const selectAllFilteredPlayers = () => setSelectedPlayerFilter(new Set(searchedPlayers));

  const selectTopPlayers = () => {
    const topNames = new Set(
      playerList
        .filter(p => p.winRate >= 50 && p.played >= 5)
        .map(p => p.canonicalName)
    );
    setSelectedPlayerFilter(topNames);
  };

  const selectTop10 = () => {
    const top10Names = new Set(
      [...playerList]
        .sort((a, b) => b.winRate - a.winRate || b.played - a.played)
        .slice(0, 10)
        .map(p => p.canonicalName)
    );
    setSelectedPlayerFilter(top10Names);
  };

  const searchedPlayers = useMemo(() => {
    if (!playerSearchTerm.trim()) return masterMwClubRoster;
    const term = playerSearchTerm.toLowerCase().trim();
    return masterMwClubRoster.filter(p => p.toLowerCase().includes(term));
  }, [masterMwClubRoster, playerSearchTerm]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  const filteredPlayersTable = useMemo(() => {
    let list = playerList;
    if (topPlayersOnly) {
      list = list.filter(p => p.winRate >= 50 && p.played >= 5);
    }
    if (selectedPlayerFilter.size > 0) {
      list = list.filter(p => selectedPlayerFilter.has(p.canonicalName));
    }

    return [...list].sort((a, b) => {
      if (sortField === 'name') {
        const nameA = a.canonicalName.toLowerCase();
        const nameB = b.canonicalName.toLowerCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }

      const valA = Number((a as any)[sortField] ?? 0);
      const valB = Number((b as any)[sortField] ?? 0);

      if (valA === valB) {
        if (b.played !== a.played) return b.played - a.played;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.pd - a.pd;
      }

      return sortOrder === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
  }, [playerList, selectedPlayerFilter, topPlayersOnly, sortField, sortOrder]);

  const filteredDuosTable = useMemo(() => {
    if (selectedPlayerFilter.size === 0) return duoList;
    return duoList.filter(d => {
      const parts = d.pair.split(' & ').map(normalizePlayerName);
      return parts.some(p => selectedPlayerFilter.has(p));
    });
  }, [duoList, selectedPlayerFilter]);

  const filteredMatchesList = useMemo(() => {
    return rounds.filter(r => {
      const sa = r.score_a;
      const sb = r.score_b;
      const isScored = sa !== null && sb !== null && (sa > 0 || sb > 0);
      if (!isScored) return false;

      const teamA = (r.team_a || []).map(normalizePlayerName).filter(p => !isPlaceholderName(p));
      const teamB = (r.team_b || []).map(normalizePlayerName).filter(p => !isPlaceholderName(p));

      // If not Mavericks, filter out matches that do not contain any of our registered club members
      if (!isOfficialMavericks) {
        const teamAHasClubMember = teamA.some(p => masterMwClubRoster.includes(p));
        const teamBHasClubMember = teamB.some(p => masterMwClubRoster.includes(p));
        if (!teamAHasClubMember && !teamBHasClubMember) return false;
      }

      if (selectedPlayerFilter.size > 0) {
        const teamAHas = teamA.some(p => selectedPlayerFilter.has(p));
        const teamBHas = teamB.some(p => selectedPlayerFilter.has(p));
        if (!teamAHas && !teamBHas) return false;
      }

      const diff = Math.abs((sa ?? 0) - (sb ?? 0));
      const combined = (sa ?? 0) + (sb ?? 0);
      if (matchTypeFilter === 'clutch') return diff <= 2;
      if (matchTypeFilter === 'blowout') return diff >= 6;
      if (matchTypeFilter === 'high_scoring') return combined >= 28;

      return true;
    });
  }, [rounds, selectedPlayerFilter, matchTypeFilter, isOfficialMavericks, masterMwClubRoster]);

  const activeDiagPlayer = playerStatsMap.get(normalizePlayerName(selectedDiagnosticPlayer)) || playerList[0];

  let bestPartnerName = 'None';
  let bestPartnerRecord = 'N/A';
  let maxPartnerWinRate = -1;
  if (activeDiagPlayer) {
    Object.entries(activeDiagPlayer.partners).forEach(([part, data]) => {
      const wr = data.played > 0 ? (data.wins / data.played) : 0;
      if (wr > maxPartnerWinRate || (wr === maxPartnerWinRate && data.pd > 0)) {
        maxPartnerWinRate = wr;
        bestPartnerName = part;
        bestPartnerRecord = `${data.wins}W – ${data.losses}L (${Math.round(wr * 100)}% Win Rate, ${data.pd >= 0 ? '+' + data.pd : data.pd} PD)`;
      }
    });
  }

  let toughestOpponentName = 'None';
  let toughestOpponentRecord = 'N/A';
  let minOppWinRate = 999;
  if (activeDiagPlayer) {
    Object.entries(activeDiagPlayer.opponents).forEach(([opp, data]) => {
      const myWinRate = data.played > 0 ? (data.wins / data.played) : 1;
      if (data.played >= 2 && myWinRate < minOppWinRate) {
        minOppWinRate = myWinRate;
        toughestOpponentName = opp;
        toughestOpponentRecord = `${data.wins}W – ${data.losses}L against ${opp} (${data.pd >= 0 ? '+' + data.pd : data.pd} PD)`;
      }
    });
  }

  function generateCoachingTip(p: PlayerStat): string {
    if (p.played === 0) {
      return `🎾 Official Monday-Wednesday Club Roster Member: Registered and ready for the next scheduled match round!`;
    }
    if (p.winRate >= 70) {
      return `🌟 Dominant Master: Elite ${p.winRate}% win rate across ${p.played} matches! Keep pressuring early serves and guiding your partner on defensive drops.`;
    }
    if (p.clutchPlayed > 0 && p.clutchWinRate < 40) {
      return `⚡ Target Focus: You have a ${p.clutchWinRate}% win rate in tight 2-point games (${p.clutchWins}/${p.clutchPlayed}). Focus on soft kitchen unforced error reduction when score is tied late.`;
    }
    if (p.avgPa > 13.0) {
      return `🛡️ Defensive Adjustment: Conceding ${p.avgPa} pts/match. Focus on baseline resets and avoiding high pop-up returns.`;
    }
    if (p.pd < 0) {
      return `📈 Momentum Builder: Current Point Diff is ${p.pd}. Work on early-game serve depth to secure early leads in match rotations.`;
    }
    return `🎯 Solid Competitor: Great foundation with ${p.wins} wins across ${p.sessionsPlayedCount} session(s). Practice communication with new partners to maximize synergy score.`;
  }

  const modalPlayerObj = modalPlayerName ? playerStatsMap.get(normalizePlayerName(modalPlayerName)) : null;

  const cellStyle: React.CSSProperties = {
    padding: '16px 14px',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    lineHeight: 1.2
  };

  const headerStyle: React.CSSProperties = {
    padding: '16px 14px',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    fontWeight: 800,
    fontSize: 14,
    color: '#64748b'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* GLOBAL MULTI-SELECT PLAYER FILTER TOOLBAR */}
      <div style={{ background: '#ffffff', border: '2px solid #0f172a', borderRadius: 18, padding: 20, boxShadow: '0 4px 16px rgba(15,23,42,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={18} style={{ color: '#0f172a' }} />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
              Filter By Specific {isOfficialMavericks ? 'Monday-Wednesday' : 'Club'} Players ({selectedPlayerFilter.size === 0 ? `Showing All ${masterMwClubRoster.length}` : `${selectedPlayerFilter.size} Selected`})
            </h3>
          </div>
          {selectedPlayerFilter.size > 0 && (
            <button
              onClick={clearPlayerFilter}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13, fontWeight: 800, borderRadius: 8, background: '#fee2e2', color: '#991b1b', border: 'none', cursor: 'pointer' }}
            >
              <X size={14} /> Clear Selection
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b' }} />
            <input
              type="text"
              placeholder={`Search player (e.g. ${isOfficialMavericks ? 'Nadeem, Sumit, Mrugesh' : 'Name'}...)`}
              value={playerSearchTerm}
              onChange={e => setPlayerSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 12px 10px 36px', fontSize: 14, fontWeight: 700, borderRadius: 10, border: '1px solid #cbd5e1' }}
            />
          </div>
          <button
            onClick={selectTopPlayers}
            style={{ padding: '10px 14px', fontSize: 13, fontWeight: 800, borderRadius: 10, background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Trophy size={14} /> ⭐ Top Players (Win % ≥ 50%)
          </button>
          <button
            onClick={selectTop10}
            style={{ padding: '10px 14px', fontSize: 13, fontWeight: 800, borderRadius: 10, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Award size={14} /> 👑 Top 10 Ranked
          </button>
          <button
            onClick={selectAllFilteredPlayers}
            style={{ padding: '10px 14px', fontSize: 13, fontWeight: 800, borderRadius: 10, background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Select All
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 130, overflowY: 'auto', padding: 4 }}>
          {searchedPlayers.map(pName => {
            const isSelected = selectedPlayerFilter.has(pName);
            return (
              <button
                key={pName}
                type="button"
                onClick={() => togglePlayerFilter(pName)}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 800,
                  borderRadius: 9999,
                  border: isSelected ? '2px solid #0f172a' : '1px solid #cbd5e1',
                  background: isSelected ? '#0f172a' : '#f8fafc',
                  color: isSelected ? '#e5fa00' : '#0f172a',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                <span>{pName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation Sub Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveSubTab('players')}
          className={activeSubTab === 'players' ? 'btn-primary' : 'btn-secondary'}
          style={{ flex: 1, minWidth: 140, minHeight: 46, fontSize: 14, fontWeight: 900, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <User size={16} />
          <span>Player Leaderboard ({filteredPlayersTable.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('diagnostic')}
          className={activeSubTab === 'diagnostic' ? 'btn-primary' : 'btn-secondary'}
          style={{ flex: 1, minWidth: 140, minHeight: 46, fontSize: 14, fontWeight: 900, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Target size={16} />
          <span>My Performance Guide</span>
        </button>
        <button
          onClick={() => setActiveSubTab('duos')}
          className={activeSubTab === 'duos' ? 'btn-primary' : 'btn-secondary'}
          style={{ flex: 1, minWidth: 140, minHeight: 46, fontSize: 14, fontWeight: 900, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Users size={16} />
          <span>Duo Synergy ({filteredDuosTable.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('h2h')}
          className={activeSubTab === 'h2h' ? 'btn-primary' : 'btn-secondary'}
          style={{ flex: 1, minWidth: 140, minHeight: 46, fontSize: 14, fontWeight: 900, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Sparkles size={16} />
          <span>H2H Rivalry</span>
        </button>
        <button
          onClick={() => setActiveSubTab('matches')}
          className={activeSubTab === 'matches' ? 'btn-primary' : 'btn-secondary'}
          style={{ flex: 1, minWidth: 140, minHeight: 46, fontSize: 14, fontWeight: 900, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <ListOrdered size={16} />
          <span>Match History ({filteredMatchesList.length})</span>
        </button>
      </div>

      {/* TAB 1: INDIVIDUAL PLAYER RANKINGS */}
      {activeSubTab === 'players' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                {isOfficialMavericks ? 'Monday-Wednesday Club' : 'Club'} Player Analytics Leaderboard ({filteredPlayersTable.length} Players)
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                💡 Click on any column header or sort pill below to order players. Click a player name to open their profile card.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b' }}>Order:</span>
              <button
                onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 900,
                  borderRadius: 8,
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  color: '#0f172a'
                }}
              >
                {sortOrder === 'desc' ? '⬇ High to Low' : '⬆ Low to High'}
              </button>
            </div>
          </div>

          {/* QUICK SORT PILLS TOOLBAR */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setTopPlayersOnly(prev => !prev)}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 900,
                borderRadius: 9999,
                border: topPlayersOnly ? '2px solid #16a34a' : '1px solid #cbd5e1',
                background: topPlayersOnly ? '#dcfce7' : '#ffffff',
                color: topPlayersOnly ? '#15803d' : '#0f172a',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Trophy size={14} style={{ color: topPlayersOnly ? '#15803d' : '#eab308' }} />
              <span>⭐ Top Players Only (Win % ≥ 50%)</span>
              {topPlayersOnly && <CheckCircle2 size={14} />}
            </button>

            <span style={{ fontSize: 12, fontWeight: 900, color: '#64748b', margin: '0 4px' }}>|</span>

            <span style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowUpDown size={14} /> Sort By:
            </span>

            {[
              { field: 'winRate', label: '🏆 Win Rate %', key: 'winRate' },
              { field: 'played', label: '🎾 Most Matches Played', key: 'played' },
              { field: 'wins', label: '🥇 Most Wins', key: 'wins' },
              { field: 'pd', label: '🔥 Point Diff (+/-)', key: 'pd' },
              { field: 'sessionsPlayedCount', label: '📅 Sessions Attended', key: 'sessionsPlayedCount' },
              { field: 'clutchWinRate', label: '⚡ Clutch W%', key: 'clutchWinRate' },
              { field: 'avgPf', label: '📊 Avg Points Scored', key: 'avgPf' },
              { field: 'name', label: '🔤 Name (A-Z)', key: 'name' },
            ].map(pill => {
              const active = sortField === pill.field;
              return (
                <button
                  key={pill.key}
                  onClick={() => handleSort(pill.field as any)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 800,
                    borderRadius: 9999,
                    border: active ? '2px solid #0f172a' : '1px solid #cbd5e1',
                    background: active ? '#0f172a' : '#ffffff',
                    color: active ? '#e5fa00' : '#0f172a',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span>{pill.label}</span>
                  {active && <span>{sortOrder === 'desc' ? '↓' : '↑'}</span>}
                </button>
              );
            })}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: 15, textAlign: 'left', color: '#0f172a' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ ...headerStyle, width: 60 }}>Rank</th>
                  <th
                    onClick={() => handleSort('name')}
                    style={{ ...headerStyle, width: 180, cursor: 'pointer', userSelect: 'none' }}
                  >
                    Player Name {sortField === 'name' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th style={{ ...headerStyle, textAlign: 'center', width: 100 }}>Form</th>
                  <th
                    onClick={() => handleSort('sessionsPlayedCount')}
                    style={{ ...headerStyle, textAlign: 'center', width: 90, cursor: 'pointer', userSelect: 'none' }}
                  >
                    Sessions {sortField === 'sessionsPlayedCount' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th
                    onClick={() => handleSort('played')}
                    style={{ ...headerStyle, textAlign: 'center', width: 80, cursor: 'pointer', userSelect: 'none' }}
                  >
                    Played {sortField === 'played' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th
                    onClick={() => handleSort('wins')}
                    style={{ ...headerStyle, textAlign: 'center', width: 90, cursor: 'pointer', userSelect: 'none' }}
                  >
                    W – L {sortField === 'wins' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th
                    onClick={() => handleSort('winRate')}
                    style={{ ...headerStyle, textAlign: 'center', width: 90, cursor: 'pointer', userSelect: 'none' }}
                  >
                    Win % {sortField === 'winRate' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th
                    onClick={() => handleSort('avgPf')}
                    style={{ ...headerStyle, textAlign: 'center', width: 100, cursor: 'pointer', userSelect: 'none' }}
                  >
                    Avg PF/PA {sortField === 'avgPf' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th
                    onClick={() => handleSort('clutchWinRate')}
                    style={{ ...headerStyle, textAlign: 'center', width: 90, cursor: 'pointer', userSelect: 'none' }}
                  >
                    Clutch W% {sortField === 'clutchWinRate' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th
                    onClick={() => handleSort('pd')}
                    style={{ ...headerStyle, textAlign: 'center', width: 80, cursor: 'pointer', userSelect: 'none' }}
                  >
                    PD {sortField === 'pd' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayersTable.map((p, idx) => (
                  <tr
                    key={p.canonicalName}
                    onClick={() => setModalPlayerName(p.canonicalName)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s ease' }}
                    className="hover:bg-slate-50"
                  >
                    <td style={{ ...cellStyle, fontWeight: 900, fontSize: 16 }}>#{idx + 1}</td>
                    <td style={{ ...cellStyle, fontWeight: 800, fontSize: 16, color: '#2563eb', textDecoration: 'underline' }}>
                      {p.canonicalName}
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'center' }}>
                      {p.recentForm.length > 0 ? (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          {p.recentForm.map((f, fi) => (
                            <span
                              key={fi}
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 4,
                                background: f === 'W' ? '#dcfce7' : '#fee2e2',
                                color: f === 'W' ? '#15803d' : '#b91c1c',
                                fontSize: 11,
                                fontWeight: 900,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Roster</span>
                      )}
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 800 }}>
                      <span style={{ padding: '4px 10px', borderRadius: 8, background: '#eff6ff', color: '#1d4ed8', fontSize: 13 }}>
                        {p.sessionsPlayedCount}
                      </span>
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }}>{p.played}</td>
                    <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 800 }}>{p.wins} – {p.losses}</td>
                    <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 900, color: p.winRate >= 50 ? '#059669' : '#dc2626' }}>{p.winRate}%</td>
                    <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }}>{p.avgPf} / {p.avgPa}</td>
                    <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 800 }}>{p.clutchWinRate}%</td>
                    <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 900, color: p.pd >= 0 ? '#059669' : '#dc2626' }}>
                      {p.pd >= 0 ? `+${p.pd}` : p.pd}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MY PERFORMANCE DIAGNOSTIC */}
      {activeSubTab === 'diagnostic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: '#0f172a', color: '#ffffff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 4px 16px rgba(15,23,42,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#e5fa00', textTransform: 'uppercase', letterSpacing: 1 }}>
                  PERSONAL PLAYER PERFORMANCE DIAGNOSTIC
                </span>
                <h2 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 900 }}>Select Your Name To Inspect Performance</h2>
              </div>
              <select
                value={selectedDiagnosticPlayer}
                onChange={e => setSelectedDiagnosticPlayer(e.target.value)}
                style={{ padding: '12px 18px', fontSize: 16, fontWeight: 900, borderRadius: 12, background: '#ffffff', color: '#0f172a', border: '2px solid #e5fa00', cursor: 'pointer', minWidth: 200 }}
              >
                {masterMwClubRoster.map(pName => {
                  const p = playerStatsMap.get(normalizePlayerName(pName));
                  return (
                    <option key={pName} value={pName}>
                      {pName} {p ? `(${p.wins}W – ${p.losses}L, ${p.winRate}%)` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {activeDiagPlayer && (
            <div style={{ background: '#ffffff', border: '2px solid #0f172a', borderRadius: 20, padding: 24, boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#0f172a' }}>{activeDiagPlayer.canonicalName}</h3>
                    <span style={{ background: '#f1f5f9', color: '#0f172a', padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800 }}>
                      {activeDiagPlayer.squad}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b', fontWeight: 600 }}>
                    Overall Rank #{playerList.findIndex(p => p.canonicalName === activeDiagPlayer.canonicalName) + 1} of {playerList.length} Players
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 12, textAlign: 'right' }}>
                  <div style={{ background: '#f8fafc', padding: '10px 16px', borderRadius: 12, border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Win Rate</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: activeDiagPlayer.winRate >= 50 ? '#059669' : '#dc2626' }}>
                      {activeDiagPlayer.winRate}%
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 16px', borderRadius: 12, border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Point Diff</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: activeDiagPlayer.pd >= 0 ? '#059669' : '#dc2626' }}>
                      {activeDiagPlayer.pd >= 0 ? `+${activeDiagPlayer.pd}` : activeDiagPlayer.pd}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Sessions & Games</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
                    {activeDiagPlayer.sessionsPlayedCount} Sessions · {activeDiagPlayer.played} Games
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{activeDiagPlayer.wins} Wins – {activeDiagPlayer.losses} Losses</div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Scoring Averages</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
                    {activeDiagPlayer.avgPf} PF / {activeDiagPlayer.avgPa} PA
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Avg Points Scored vs Conceded</div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Clutch Thrillers</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
                    {activeDiagPlayer.clutchWins} W – {activeDiagPlayer.clutchPlayed - activeDiagPlayer.clutchWins} L ({activeDiagPlayer.clutchWinRate}%)
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Matches decided by ≤ 2 points</div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Blowout Ratio</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
                    {activeDiagPlayer.blowoutWins} Sweeps / {activeDiagPlayer.blowoutLosses} Defeats
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Matches decided by ≥ 6 points</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 14, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#047857', fontWeight: 900, fontSize: 15, marginBottom: 8 }}>
                    <CheckCircle2 size={18} />
                    <span>BEST PARTNER SYNERGY</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#065f46' }}>{bestPartnerName}</div>
                  <div style={{ fontSize: 13, color: '#047857', marginTop: 4, fontWeight: 700 }}>{bestPartnerRecord}</div>
                </div>

                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b91c1c', fontWeight: 900, fontSize: 15, marginBottom: 8 }}>
                    <AlertTriangle size={18} />
                    <span>TOUGHEST OPPONENT (NEMESIS)</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#991b1b' }}>{toughestOpponentName}</div>
                  <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 4, fontWeight: 700 }}>{toughestOpponentRecord}</div>
                </div>
              </div>

              <div style={{ background: '#0f172a', color: '#ffffff', borderRadius: 14, padding: 20, borderLeft: '6px solid #e5fa00' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e5fa00', fontWeight: 900, fontSize: 15, marginBottom: 6 }}>
                  <Zap size={18} />
                  <span>ACTIONABLE PERFORMANCE & IMPROVEMENT RECOMMENDATION</span>
                </div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.5, color: '#f8fafc' }}>
                  {generateCoachingTip(activeDiagPlayer)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DUO SYNERGY */}
      {activeSubTab === 'duos' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
          <h3 style={{ margin: '0 0 18px 0', fontSize: 22, fontWeight: 900, color: '#0f172a' }}>Doubles Duo Pairings Synergy ({filteredDuosTable.length})</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse', fontSize: 15, textAlign: 'left', color: '#0f172a' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ ...headerStyle, width: 70 }}>Rank</th>
                  <th style={{ ...headerStyle, width: 240 }}>Doubles Pair</th>
                  <th style={{ ...headerStyle, width: 160 }}>Squad</th>
                  <th style={{ ...headerStyle, textAlign: 'center', width: 90 }}>Played</th>
                  <th style={{ ...headerStyle, textAlign: 'center', width: 90 }}>W – L</th>
                  <th style={{ ...headerStyle, textAlign: 'center', width: 100 }}>Win Rate</th>
                  <th style={{ ...headerStyle, textAlign: 'center', width: 80 }}>PD</th>
                </tr>
              </thead>
              <tbody>
                {filteredDuosTable.map((d, idx) => (
                  <tr key={d.pair} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...cellStyle, fontWeight: 900, fontSize: 16 }}>#{idx + 1}</td>
                    <td style={{ ...cellStyle, fontWeight: 800, fontSize: 16 }}>{d.pair}</td>
                    <td style={{ ...cellStyle }}>
                      <span style={{ fontSize: 13, fontWeight: 800, padding: '6px 12px', borderRadius: 6, background: '#f1f5f9', color: '#0f172a' }}>
                        {d.squad}
                      </span>
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }}>{d.played}</td>
                    <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 800 }}>{d.wins} – {d.losses}</td>
                    <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 900, color: d.winRate >= 50 ? '#059669' : '#dc2626' }}>{d.winRate}%</td>
                    <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 900, color: d.pd >= 0 ? '#059669' : '#dc2626' }}>
                      {d.pd >= 0 ? `+${d.pd}` : d.pd}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: H2H RIVALRY */}
      {activeSubTab === 'h2h' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 22, fontWeight: 900, color: '#0f172a' }}>Head-to-Head (H2H) Rivalry Inspector</h3>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#64748b', fontWeight: 600 }}>
            Compare head-to-head match records between any two players in Monday-Wednesday Club.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 6 }}>Player A</label>
              <select
                value={h2hPlayerA}
                onChange={e => setH2hPlayerA(e.target.value)}
                style={{ width: '100%', padding: '12px', fontSize: 15, fontWeight: 800, borderRadius: 10, border: '1px solid #cbd5e1' }}
              >
                {masterMwClubRoster.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 6 }}>Player B</label>
              <select
                value={h2hPlayerB}
                onChange={e => setH2hPlayerB(e.target.value)}
                style={{ width: '100%', padding: '12px', fontSize: 15, fontWeight: 800, borderRadius: 10, border: '1px solid #cbd5e1' }}
              >
                {masterMwClubRoster.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {(() => {
            const statA = playerStatsMap.get(normalizePlayerName(h2hPlayerA));
            const oppData = statA?.opponents[normalizePlayerName(h2hPlayerB)];
            const winsA = oppData?.wins ?? 0;
            const winsB = oppData?.losses ?? 0;
            const total = oppData?.played ?? 0;
            const pdA = oppData?.pd ?? 0;

            return (
              <div style={{ background: '#f8fafc', border: '2px solid #0f172a', borderRadius: 16, padding: 24, textAlign: 'center' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>{h2hPlayerA}</div>
                    <div style={{ fontSize: 36, fontWeight: 900, color: winsA >= winsB ? '#059669' : '#dc2626', marginTop: 4 }}>
                      {winsA}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 700 }}>Wins</div>
                  </div>

                  <div style={{ padding: '0 16px' }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: '#64748b', background: '#e2e8f0', padding: '6px 16px', borderRadius: 9999 }}>
                      {total} MATCHES
                    </span>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#64748b', marginTop: 8 }}>
                      Point Diff: {pdA >= 0 ? `+${pdA}` : pdA}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>{h2hPlayerB}</div>
                    <div style={{ fontSize: 36, fontWeight: 900, color: winsB >= winsA ? '#059669' : '#dc2626', marginTop: 4 }}>
                      {winsB}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 700 }}>Wins</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 5: MATCH-WISE DETAILED ANALYSIS */}
      {activeSubTab === 'matches' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a' }}>Match-Wise Breakdown ({filteredMatchesList.length} Matches)</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setMatchTypeFilter('all')}
                style={{ padding: '8px 14px', fontSize: 13, fontWeight: 800, borderRadius: 8, border: '1px solid #cbd5e1', background: matchTypeFilter === 'all' ? '#0f172a' : '#ffffff', color: matchTypeFilter === 'all' ? '#ffffff' : '#0f172a', cursor: 'pointer' }}
              >
                All Matches
              </button>
              <button
                onClick={() => setMatchTypeFilter('clutch')}
                style={{ padding: '8px 14px', fontSize: 13, fontWeight: 800, borderRadius: 8, border: '1px solid #cbd5e1', background: matchTypeFilter === 'clutch' ? '#0f172a' : '#ffffff', color: matchTypeFilter === 'clutch' ? '#ffffff' : '#0f172a', cursor: 'pointer' }}
              >
                Clutch Thrillers (≤2 pts)
              </button>
              <button
                onClick={() => setMatchTypeFilter('blowout')}
                style={{ padding: '8px 14px', fontSize: 13, fontWeight: 800, borderRadius: 8, border: '1px solid #cbd5e1', background: matchTypeFilter === 'blowout' ? '#0f172a' : '#ffffff', color: matchTypeFilter === 'blowout' ? '#ffffff' : '#0f172a', cursor: 'pointer' }}
              >
                Blowouts (≥6 pts)
              </button>
              <button
                onClick={() => setMatchTypeFilter('high_scoring')}
                style={{ padding: '8px 14px', fontSize: 13, fontWeight: 800, borderRadius: 8, border: '1px solid #cbd5e1', background: matchTypeFilter === 'high_scoring' ? '#0f172a' : '#ffffff', color: matchTypeFilter === 'high_scoring' ? '#ffffff' : '#0f172a', cursor: 'pointer' }}
              >
                High Scoring Battles
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 960, borderCollapse: 'collapse', fontSize: 15, textAlign: 'left', color: '#0f172a' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ ...headerStyle, width: 140 }}>Tournament & Date</th>
                  <th style={{ ...headerStyle, width: 100 }}>Match</th>
                  <th style={{ ...headerStyle, width: 220 }}>Team A</th>
                  <th style={{ ...headerStyle, textAlign: 'center', width: 100 }}>Score</th>
                  <th style={{ ...headerStyle, width: 220 }}>Team B</th>
                  <th style={{ ...headerStyle, textAlign: 'center', width: 140 }}>Intensity Tag</th>
                </tr>
              </thead>
              <tbody>
                {filteredMatchesList.map((r, i) => {
                  const sa = r.score_a ?? 0;
                  const sb = r.score_b ?? 0;
                  const diff = Math.abs(sa - sb);
                  const combined = sa + sb;

                  const { name: tourneyName, dateStr } = getTournamentMeta(r.session_id);

                  let tag = 'Normal Match';
                  let tagBg = '#f1f5f9';
                  let tagColor = '#0f172a';

                  if (diff <= 2) {
                    tag = '⚡ Clutch Finish';
                    tagBg = '#fef3c7';
                    tagColor = '#92400e';
                  } else if (diff >= 6) {
                    tag = '🛡️ Blowout Sweep';
                    tagBg = '#fee2e2';
                    tagColor = '#991b1b';
                  } else if (combined >= 28) {
                    tag = '💥 High Voltage';
                    tagBg = '#ecfdf5';
                    tagColor = '#065f46';
                  }

                  const teamA = (r.team_a || []).map(normalizePlayerName).filter(p => !isPlaceholderName(p));
                  const teamB = (r.team_b || []).map(normalizePlayerName).filter(p => !isPlaceholderName(p));

                  return (
                    <tr key={`${r.id || i}_${r.round_number}_${r.court}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ ...cellStyle }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>{tourneyName}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Calendar size={11} /> {dateStr}
                        </div>
                      </td>
                      <td style={{ ...cellStyle, fontWeight: 800 }}>R{r.round_number} · Court {r.court}</td>
                      <td style={{ ...cellStyle, fontWeight: 800, color: sa > sb ? '#059669' : '#0f172a' }}>
                        {teamA.join(' & ')}
                      </td>
                      <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 900, fontSize: 17 }}>
                        {sa} – {sb}
                      </td>
                      <td style={{ ...cellStyle, fontWeight: 800, color: sb > sa ? '#059669' : '#0f172a' }}>
                        {teamB.join(' & ')}
                      </td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, padding: '6px 12px', borderRadius: 8, background: tagBg, color: tagColor }}>
                          {tag}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CLICKABLE ADVANCED PLAYER DETAIL MODAL */}
      {modalPlayerObj && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 24, width: '100%', maxWidth: 820, maxHeight: '90vh', overflowY: 'auto', border: '2px solid #0f172a', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', padding: 24, position: 'relative' }}>
            <button
              onClick={() => setModalPlayerName(null)}
              style={{ position: 'absolute', right: 20, top: 20, width: 36, height: 36, borderRadius: '50%', background: '#f1f5f9', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a' }}
            >
              <X size={20} />
            </button>

            {/* Header Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: '#0f172a', color: '#e5fa00', fontSize: 26, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {modalPlayerObj.canonicalName.substring(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#0f172a' }}>{modalPlayerObj.canonicalName}</h2>
                  <span style={{ background: '#0f172a', color: '#e5fa00', padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 900 }}>
                    {modalPlayerObj.streakText}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ background: '#f1f5f9', color: '#0f172a', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800 }}>
                    {modalPlayerObj.squad}
                  </span>
                  <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                    Overall Rank #{playerList.findIndex(p => p.canonicalName === modalPlayerObj.canonicalName) + 1} of {playerList.length} Players
                  </span>
                </div>
              </div>
            </div>

            {/* Tournament Mentions & Dates Badges */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trophy size={14} /> Tournaments & Play Dates ({modalPlayerObj.tournamentsWithDates.length})
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {modalPlayerObj.tournamentsWithDates.length > 0 ? (
                  modalPlayerObj.tournamentsWithDates.map(t => (
                    <span key={t.name} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '6px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Award size={14} /> {t.name} <span style={{ opacity: 0.7, fontWeight: 700 }}>({t.dateStr})</span>
                    </span>
                  ))
                ) : (
                  <span style={{ background: '#f1f5f9', color: '#475569', padding: '6px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 800 }}>
                    Monday-Wednesday Club Registered Roster Member
                  </span>
                )}
              </div>
            </div>

            {/* Core Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Sessions</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{modalPlayerObj.sessionsPlayedCount}</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Games</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{modalPlayerObj.played}</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>W – L</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{modalPlayerObj.wins} – {modalPlayerObj.losses}</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Win %</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: modalPlayerObj.winRate >= 50 ? '#059669' : '#dc2626', marginTop: 2 }}>{modalPlayerObj.winRate}%</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Point Share</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{modalPlayerObj.pointSharePct}%</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Point Diff</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: modalPlayerObj.pd >= 0 ? '#059669' : '#dc2626', marginTop: 2 }}>{modalPlayerObj.pd >= 0 ? `+${modalPlayerObj.pd}` : modalPlayerObj.pd}</div>
              </div>
            </div>

            {/* Tactical & Partnership Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TrendingUp size={16} /> Scoring & Court Breakdown
                </div>
                <div style={{ fontSize: 13, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div><strong>Avg Points For:</strong> {modalPlayerObj.avgPf} pts / match</div>
                  <div><strong>Avg Points Conceded:</strong> {modalPlayerObj.avgPa} pts / match</div>
                  <div><strong>Clutch Record:</strong> {modalPlayerObj.clutchWins}W – {modalPlayerObj.clutchPlayed - modalPlayerObj.clutchWins}L ({modalPlayerObj.clutchWinRate}%)</div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={16} /> Recent Form Trend
                </div>
                {modalPlayerObj.recentForm.length > 0 ? (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {modalPlayerObj.recentForm.map((f, i) => (
                      <span key={i} style={{ width: 28, height: 28, borderRadius: 6, background: f === 'W' ? '#dcfce7' : '#fee2e2', color: f === 'W' ? '#15803d' : '#b91c1c', fontSize: 13, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        {f}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>Registered for next match round</div>
                )}
              </div>
            </div>

            {/* Match History Table with Tournament Name and Date */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                Complete Match History with Tournament & Dates ({modalPlayerObj.matchHistory.length} Matches)
              </h4>
              {modalPlayerObj.matchHistory.length > 0 ? (
                <div style={{ overflowX: 'auto', maxHeight: 260 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#0f172a' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Tournament & Date</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Match</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Partner</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Opponents</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Score</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalPlayerObj.matchHistory.map((m, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>{m.tournament}</div>
                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Calendar size={11} /> {m.dateStr}
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 800 }}>R{m.roundNumber} · Court {m.court}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 700 }}>{m.partner}</td>
                          <td style={{ padding: '8px 10px' }}>{m.opponents.join(' & ')}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800 }}>{m.myScore} – {m.oppScore}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 900, background: m.won ? '#dcfce7' : '#fee2e2', color: m.won ? '#15803d' : '#b91c1c' }}>
                              {m.won ? 'WIN' : 'LOSS'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 16, textAlign: 'center', color: '#64748b', fontSize: 14, fontWeight: 700 }}>
                  Official Monday-Wednesday Club Registered Roster Member (Awaiting Next Match Round).
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
