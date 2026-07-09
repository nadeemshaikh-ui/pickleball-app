// Computes a "8:00–8:10 PM"-style clock range for a round, given an optional
// session start time ("20:00") and round duration. Returns null if either is
// missing — callers fall back to just showing the round number.
export function computeRoundTimeRange(
  startTime: string | null,
  durationMinutes: number | null,
  roundNumber: number
): string | null {
  if (!startTime || !durationMinutes) return null;
  const [h, m] = startTime.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;

  const startMinutesTotal = h * 60 + m + (roundNumber - 1) * durationMinutes;
  const endMinutesTotal = startMinutesTotal + durationMinutes;

  const fmt = (totalMinutes: number) => {
    const hh = Math.floor(totalMinutes / 60) % 24;
    const mm = totalMinutes % 60;
    const period = hh >= 12 ? 'PM' : 'AM';
    const hour12 = ((hh + 11) % 12) + 1;
    return `${hour12}:${String(mm).padStart(2, '0')} ${period}`;
  };

  return `${fmt(startMinutesTotal)}–${fmt(endMinutesTotal)}`;
}
