export interface RosterRivalry {
  players: [string, string];
  record: [number, number];
  gamesTogether: number;
}

const MIN_GAMES_FOR_STORYLINE_RIVALRY = 3;
const MIN_STREAK_FOR_STORYLINE = 3;

// Template-based pregame brief — no LLM. Picks the hottest streak and the
// closest head-to-head among tonight's roster, each optional (omitted if
// nothing clears the bar). Deliberately just 1-2 lines, not a kitchen sink.
export function buildStorylines(
  roster: string[],
  streaksByName: Map<string, number>,
  rosterRivalries: RosterRivalry[]
): string[] {
  const lines: string[] = [];

  let hottestName: string | null = null;
  let hottestStreak = MIN_STREAK_FOR_STORYLINE - 1;
  for (const name of roster) {
    const streak = streaksByName.get(name) ?? 0;
    if (streak > hottestStreak) {
      hottestStreak = streak;
      hottestName = name;
    }
  }
  if (hottestName) {
    lines.push(`🔥 ${hottestName} is on a ${hottestStreak}-game win streak`);
  }

  const eligible = rosterRivalries.filter(r => r.gamesTogether >= MIN_GAMES_FOR_STORYLINE_RIVALRY);
  const closest = [...eligible].sort((a, b) => {
    const gapA = Math.abs(a.record[0] - a.record[1]);
    const gapB = Math.abs(b.record[0] - b.record[1]);
    if (gapA !== gapB) return gapA - gapB;
    return b.gamesTogether - a.gamesTogether;
  })[0];
  if (closest) {
    lines.push(`⚔️ Closest rivalry tonight: ${closest.players[0]} vs ${closest.players[1]} — ${closest.record[0]}-${closest.record[1]}`);
  }

  return lines;
}
