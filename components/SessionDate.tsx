import { CalendarIcon } from './icons';

export default function SessionDate({ createdAt, venue }: { createdAt: string; venue?: string | null }) {
  const formatted = new Date(createdAt).toLocaleDateString(undefined, {
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
