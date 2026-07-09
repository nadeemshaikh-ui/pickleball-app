import type { RoundRow } from './db';

export function formatScheduleAsText(rounds: RoundRow[]): string {
  const byRound = new Map<number, RoundRow[]>();
  for (const r of rounds) {
    const list = byRound.get(r.round_number) ?? [];
    list.push(r);
    byRound.set(r.round_number, list);
  }

  const lines: string[] = [];
  const sortedRoundNumbers = [...byRound.keys()].sort((a, b) => a - b);
  for (const roundNumber of sortedRoundNumbers) {
    const courts = byRound.get(roundNumber)!.sort((a, b) => a.court - b.court);
    lines.push(`Round ${roundNumber}`);
    for (const c of courts) {
      lines.push(`Court ${c.court}: ${c.team_a.join(' & ')} vs ${c.team_b.join(' & ')}`);
    }
    lines.push(`Sitting: ${courts[0].sitting_out.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}
