// Late Arrivals plan, Item 4 — the score-entry screen is the one moment
// someone's already holding their phone, so the "who's next" handoff rides
// on that screen instead of a broadcast channel nobody would see. Both
// functions here are pure/derived — no new schema, no stored state.

// Deterministic rotation, no schema change: whoever is on this court reads
// out the score next round, cycling by round number. If designated_scorers
// is set, the rotation is restricted to whichever of those players are
// actually on this court (independent concept — designated_scorers is a
// permission list, this just narrows who the rotation picks from). Falls
// back to the full 4 on-court players if none of them are a designated
// scorer, so this never names someone who isn't actually on the court.
export function pickCourtScorer(
  teamA: [string, string],
  teamB: [string, string],
  roundNumber: number,
  designatedScorers?: string[] | null
): string {
  const onCourt = [teamA[0], teamA[1], teamB[0], teamB[1]];
  const restricted = designatedScorers && designatedScorers.length > 0
    ? onCourt.filter(p => designatedScorers.includes(p))
    : [];
  const rotation = restricted.length > 0 ? restricted : onCourt;
  return rotation[roundNumber % rotation.length];
}

// Diffs a court's players against the same court in the immediately
// preceding round. `previousCourtPlayers: null` means there is no previous
// round for this court (e.g. round 1) — everyone on court is new.
export function newPlayersOnCourt(currentPlayers: string[], previousCourtPlayers: string[] | null): Set<string> {
  if (!previousCourtPlayers) return new Set(currentPlayers);
  const prevSet = new Set(previousCourtPlayers);
  return new Set(currentPlayers.filter(p => !prevSet.has(p)));
}
