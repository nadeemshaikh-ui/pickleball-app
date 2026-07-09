import type { RoundRow } from './db';

export function formatScheduleAsText(
  rounds: RoundRow[],
  courtLabels: string[] = ['1', '2'],
  roundDurationMinutes: number | null = null
): string {
  const byRound = new Map<number, RoundRow[]>();
  for (const r of rounds) {
    const list = byRound.get(r.round_number) ?? [];
    list.push(r);
    byRound.set(r.round_number, list);
  }

  const lines: string[] = [];
  if (roundDurationMinutes) {
    lines.push(`Each round: ~${roundDurationMinutes} min`);
    lines.push('');
  }
  const sortedRoundNumbers = [...byRound.keys()].sort((a, b) => a - b);
  for (const roundNumber of sortedRoundNumbers) {
    const courts = byRound.get(roundNumber)!.sort((a, b) => a.court - b.court);
    const sameSitOut = courts.every(
      c => JSON.stringify([...c.sitting_out].sort()) === JSON.stringify([...courts[0].sitting_out].sort())
    );
    lines.push(`Round ${roundNumber}`);
    for (const c of courts) {
      lines.push(`Court ${courtLabels[c.court - 1]}: ${c.team_a.join(' & ')} vs ${c.team_b.join(' & ')}`);
      if (!sameSitOut && c.sitting_out.length > 0) {
        lines.push(`  Sitting: ${c.sitting_out.join(', ')}`);
      }
    }
    if (sameSitOut && courts[0].sitting_out.length > 0) {
      lines.push(`Sitting: ${courts[0].sitting_out.join(', ')}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}
