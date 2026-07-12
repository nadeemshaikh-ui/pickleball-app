'use client';

import { use, useEffect, useState } from 'react';
import { PartyPopper, TrendingDown, Crown, Frown, Egg } from 'lucide-react';
import { getSession, getRounds, updateRoundScore, insertRounds, markSessionCompleted, type RoundRow, type SessionRow } from '@/lib/db';
import { resolveChallengesForRound } from '@/lib/challenges';
import { computeCurrentStreaks, maybeSetStreakRecord } from '@/lib/streakRecords';
import { syncLadderChampion } from '@/lib/ladderStandings';
import { computeNextKingOfCourtRound } from '@/lib/kingOfCourt';
import SessionNav from '@/components/SessionNav';
import GroupHeader from '@/components/GroupHeader';
import { ChairIcon } from '@/components/icons';
import { formatLabel } from '@/lib/formatLabel';
import { detectUpset } from '@/lib/upset';
import { detectFlightChange } from '@/lib/flightChange';
import { listPlayers } from '@/lib/players';

export default function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, [string, string]>>({});
  const [savingCourtId, setSavingCourtId] = useState<string | null>(null);
  const [eloByName, setEloByName] = useState<Map<string, number>>(new Map());
  const [nicknameByName, setNicknameByName] = useState<Map<string, string>>(new Map());
  const [flightChanges, setFlightChanges] = useState<Record<string, RoundMessage[]>>({});
  const [kotcMovement, setKotcMovement] = useState<Record<number, string[]>>({});

  function firstIncompleteRound(r: RoundRow[]): number | undefined {
    return [...new Set(r.map(x => x.round_number))]
      .sort((a, b) => a - b)
      .find(rn => r.filter(x => x.round_number === rn).some(x => x.score_a === null));
  }

  async function reload() {
    const [s, r] = await Promise.all([getSession(id), getRounds(id)]);
    setSession(s);
    setRounds(r);
  }

  useEffect(() => {
    reload();
  }, [id]);

  // Scoped to the session's own club, not whatever club is "currently
  // active" in the switcher — a session's data always belongs to the club
  // it was created in, regardless of what the user has selected elsewhere.
  useEffect(() => {
    if (!session) return;
    listPlayers(session.club_id)
      .then(players => {
        setEloByName(new Map(players.map(p => [p.name, p.elo_rating])));
        setNicknameByName(new Map(players.filter(p => p.nickname).map(p => [p.name, p.nickname as string])));
      })
      .catch(() => setEloByName(new Map()));
  }, [session?.club_id]);

  // On-court display name — the full registered name (often first + last)
  // overflows the score box, and nobody needs the surname mid-match.
  function displayName(fullName: string): string {
    return nicknameByName.get(fullName) ?? fullName.split(' ')[0];
  }

  type RoundMessage = { kind: 'promoted' | 'relegated' | 'record-win' | 'record-loss'; text: string };
  const MESSAGE_ICONS = { promoted: PartyPopper, relegated: TrendingDown, 'record-win': Crown, 'record-loss': Frown } as const;

  // Flight-mismatch upset badge — only shown when all 4 players are
  // registered (unrated players would make the flight comparison meaningless).
  function upsetLabel(court: RoundRow): string | null {
    if (court.score_a === null || court.score_b === null) return null;
    const [a1, a2] = court.team_a;
    const [b1, b2] = court.team_b;
    const ratings = [a1, a2, b1, b2].map(n => eloByName.get(n));
    if (ratings.some(r => r === undefined)) return null;
    const [ra1, ra2, rb1, rb2] = ratings as number[];
    const aWon = court.score_a > court.score_b;
    const upset = aWon ? detectUpset([ra1, ra2], [rb1, rb2]) : detectUpset([rb1, rb2], [ra1, ra2]);
    return upset ? `${upset.winnerFlight} slays ${upset.loserFlight}` : null;
  }

  const roundNumbers = [...new Set(rounds.map(r => r.round_number))].sort((a, b) => a - b);
  const currentRoundNumber = firstIncompleteRound(rounds);

  function draftFor(court: RoundRow): [string, string] {
    return drafts[court.id] ?? [court.score_a?.toString() ?? '', court.score_b?.toString() ?? ''];
  }

  // Scores cap at 99 — 3+ digits is always a mis-tap, not a real pickleball score.
  function clampScore(raw: string): string {
    if (raw === '') return raw;
    const n = Number(raw);
    if (Number.isNaN(n)) return raw;
    return String(Math.min(99, Math.max(0, n)));
  }

  async function saveScore(court: RoundRow, a: string, b: string) {
    if (a === '' || b === '' || !session) return;
    setSavingCourtId(court.id);
    const beforeElo = eloByName;
    await updateRoundScore(court.id, Number(a), Number(b));
    resolveChallengesForRound(session.club_id, court.team_a, court.team_b, Number(a) > Number(b)).catch(err =>
      console.error('Failed to resolve challenges for round:', err)
    );
    const [updatedRounds, players] = await Promise.all([getRounds(id), listPlayers(session.club_id)]);
    setRounds(updatedRounds);
    // Refreshed after every save, not just once on page load — otherwise
    // both this and the upset badge below would compare against
    // increasingly stale ratings across a multi-round session.
    const freshElo = new Map(players.map(p => [p.name, p.elo_rating]));
    setEloByName(freshElo);

    const participants = [...court.team_a, ...court.team_b];
    const messages: RoundMessage[] = [];
    for (const name of participants) {
      const before = beforeElo.get(name);
      const after = freshElo.get(name);
      if (before === undefined || after === undefined) continue;
      const change = detectFlightChange(before, after);
      if (change) {
        messages.push(
          change.direction === 'promoted'
            ? { kind: 'promoted', text: `${name} promoted to ${change.flight}!` }
            : { kind: 'relegated', text: `${name} relegated to ${change.flight}` }
        );
      }
    }
    try {
      const streaks = await computeCurrentStreaks(session.club_id);
      for (const name of participants) {
        const streak = streaks.get(name);
        if (!streak) continue;
        const broken = await maybeSetStreakRecord(session.club_id, streak.type, name, streak.length);
        if (broken) {
          messages.push(
            broken.streakType === 'win'
              ? { kind: 'record-win', text: `NEW CLUB RECORD! ${name} just set a ${broken.recordLength}-game win streak.` }
              : { kind: 'record-loss', text: `${name} just set the club's longest losing streak (${broken.recordLength}).` }
          );
        }
      }
    } catch (err) {
      console.error('Failed to check streak records:', err);
    }

    // Rung movement itself is owned by the apply_ladder_after_score Postgres
    // trigger (fires on the updateRoundScore() UPDATE above, same
    // transaction) — this just picks up whatever it did to crown the
    // Ladder Champion badge holder. See lib/ladderStandings.ts for why this
    // isn't duplicated client-side.
    if (session.is_ladder) {
      syncLadderChampion(session.club_id).catch(err => console.error('Failed to sync ladder champion badge:', err));
    }

    if (messages.length > 0) setFlightChanges(prev => ({ ...prev, [court.id]: messages }));

    // King of the Court only ever has the rounds played so far in the DB —
    // round N+1 doesn't exist until round N is fully scored, so the generic
    // firstIncompleteRound() check below (which would see "no incomplete
    // rounds exist yet" and wrongly mark the session complete after round 1)
    // doesn't apply here. Generate the next round live instead, or complete
    // the session once round_count is reached.
    if (session?.format === 'king_of_court') {
      const roundJustCompleted = updatedRounds
        .filter(r => r.round_number === court.round_number)
        .every(c => c.score_a !== null && c.score_b !== null);
      if (roundJustCompleted) {
        if (court.round_number < session.round_count) {
          const scoredCourts = updatedRounds
            .filter(r => r.round_number === court.round_number)
            .sort((x, y) => x.court - y.court)
            .map(r => ({ court: r.court, teamA: r.team_a, teamB: r.team_b, scoreA: r.score_a as number, scoreB: r.score_b as number }));
          const labels = session.court_labels;
          const winnerOf = (c: (typeof scoredCourts)[number]) => (c.scoreA > c.scoreB ? c.teamA : c.teamB);
          const loserOf = (c: (typeof scoredCourts)[number]) => (c.scoreA > c.scoreB ? c.teamB : c.teamA);
          const movement: string[] = [];
          if (scoredCourts.length > 1) {
            movement.push(`Defending Court ${labels[0]}: ${winnerOf(scoredCourts[0]).join(' & ')}`);
            for (let i = 0; i < scoredCourts.length - 1; i++) {
              movement.push(`Moving up to Court ${labels[i]}: ${winnerOf(scoredCourts[i + 1]).join(' & ')}`);
              movement.push(`Moving down to Court ${labels[i + 1]}: ${loserOf(scoredCourts[i]).join(' & ')}`);
            }
          }
          setKotcMovement(prev => ({ ...prev, [court.round_number]: movement }));

          const nextCourts = computeNextKingOfCourtRound(
            scoredCourts,
            session.king_of_court_fixed_pairs ?? true,
            `${id}-r${court.round_number + 1}`
          );
          await insertRounds(id, [{ roundNumber: court.round_number + 1, courts: nextCourts, sittingOutPerCourt: nextCourts.map(() => []) }]);
          setRounds(await getRounds(id));
        } else {
          await markSessionCompleted(id);
        }
      }
      setSavingCourtId(null);
      return;
    }

    setSavingCourtId(null);
    if (firstIncompleteRound(updatedRounds) === undefined) {
      await markSessionCompleted(id);
    }
  }

  async function handleSaveCourt(court: RoundRow) {
    const [a, b] = draftFor(court);
    await saveScore(court, a, b);
  }

  return (
    <>
      <main className="page">
        {session && <GroupHeader groupName={session.group_name} logoUrl1={session.logo_url_1} logoUrl2={session.logo_url_2} />}
        <h1>Live Scoring</h1>
        <p style={{ color: 'var(--muted)', marginTop: 4 }}>
          Round {currentRoundNumber ?? session?.round_count ?? '—'} of {session?.round_count ?? '…'} — tap a score box to enter, it saves automatically
        </p>

        {roundNumbers.map(roundNumber => {
          const courts = rounds.filter(r => r.round_number === roundNumber).sort((a, b) => a.court - b.court);
          const isDone = courts.every(c => c.score_a !== null && c.score_b !== null);
          const isCurrent = roundNumber === currentRoundNumber;
          const sameSitOut =
            courts.length === 2 &&
            JSON.stringify([...courts[0].sitting_out].sort()) === JSON.stringify([...courts[1].sitting_out].sort());

          return (
            <div key={roundNumber} className={`round-card ${isCurrent ? 'is-current' : ''} ${isDone ? 'is-done' : ''}`}>
              <div className="round-card-header">
                <span className="round-label">Round {roundNumber}</span>
                <span className={`round-status-badge ${isDone ? '' : 'pending'}`}>
                  {isDone ? 'Done' : 'Pending'}
                </span>
              </div>

              {session?.format === 'king_of_court' && isDone && (kotcMovement[roundNumber] ?? []).length > 0 && (
                <div className="resting-badge" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <strong style={{ fontSize: 12 }}>Next round movement</strong>
                  {kotcMovement[roundNumber].map(m => (
                    <span key={m} style={{ fontSize: 12 }}>{m}</span>
                  ))}
                </div>
              )}

              {courts.map(court => {
                const [scoreA, scoreB] = draftFor(court);
                const aWins = court.score_a !== null && court.score_b !== null && court.score_a > court.score_b;
                const bWins = court.score_a !== null && court.score_b !== null && court.score_b > court.score_a;
                return (
                  <div key={court.id} className="match-box">
                    <span className="court-label-big">COURT {session?.court_labels?.[court.court - 1] ?? court.court}</span>
                    <div className="match-teams-row">
                      <div className={`team-box ${aWins ? 'winner' : ''}`}>
                        <div className="team-names">{court.team_a.map(displayName).join(' & ')}</div>
                        <input
                          className="score-input"
                          type="number"
                          inputMode="numeric"
                          max={99}
                          aria-label={`${court.team_a.join(' & ')} score, court ${court.court}, round ${roundNumber}`}
                          value={scoreA}
                          onChange={e => setDrafts(prev => ({ ...prev, [court.id]: [clampScore(e.target.value), draftFor(court)[1]] }))}
                          onBlur={() => handleSaveCourt(court)}
                        />
                      </div>
                      <span className="vs-pill">VS</span>
                      <div className={`team-box ${bWins ? 'winner' : ''}`}>
                        <div className="team-names">{court.team_b.map(displayName).join(' & ')}</div>
                        <input
                          className="score-input"
                          type="number"
                          inputMode="numeric"
                          max={99}
                          aria-label={`${court.team_b.join(' & ')} score, court ${court.court}, round ${roundNumber}`}
                          value={scoreB}
                          onChange={e => setDrafts(prev => ({ ...prev, [court.id]: [draftFor(court)[0], clampScore(e.target.value)] }))}
                          onBlur={() => handleSaveCourt(court)}
                        />
                      </div>
                      {savingCourtId === court.id && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Saving…</span>}
                    </div>
                    {upsetLabel(court) && (
                      <div className="resting-badge">
                        <Egg size={14} /> {upsetLabel(court)}
                      </div>
                    )}
                    {(flightChanges[court.id] ?? []).map(msg => {
                      const MsgIcon = MESSAGE_ICONS[msg.kind];
                      return (
                        <div key={msg.text} className="resting-badge">
                          <MsgIcon size={14} /> {msg.text}
                        </div>
                      );
                    })}
                    {!sameSitOut && court.sitting_out.length > 0 && (
                      <div className="resting-badge">
                        <span className="stat-icon"><ChairIcon size={20} /></span>
                        Resting: {court.sitting_out.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}

              {sameSitOut && courts[0]?.sitting_out.length > 0 && (
                <div className="resting-badge">
                  <span className="stat-icon"><ChairIcon size={20} /></span>
                  Resting: {courts[0].sitting_out.join(', ')}
                </div>
              )}
              {session && (
                <div className="meta-bar">
                  <span>ROUND {roundNumber}</span>
                  <span>COURT {session.court_labels.join('/')}</span>
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
      </main>
      <SessionNav sessionId={id} />
    </>
  );
}
