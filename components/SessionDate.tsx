import { CalendarIcon } from './icons';

export default function SessionDate({ createdAt, eventDate, venue }: { createdAt: string; eventDate?: string | null; venue?: string | null }) {
  // Event date (when the tournament is actually played) takes priority
  // over created-at (when the organizer happened to set it up, which can
  // be days ahead of the real event) — falls back to created-at for every
  // session created before this field existed. eventDate is a bare
  // "YYYY-MM-DD" (no time/timezone) — parsed as local y/m/d, not via
  // `new Date(string)`, which reads a bare date as UTC midnight and can
  // roll back a day in negative-UTC-offset timezones.
  const dateValue = eventDate
    ? (() => {
        const [y, m, d] = eventDate.split('-').map(Number);
        return new Date(y, m - 1, d);
      })()
    : new Date(createdAt);
  const formatted = dateValue.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
      <CalendarIcon size={14} />
      <span>{formatted}{venue ? ` — ${venue}` : ''}</span>
    </div>
  );
}
