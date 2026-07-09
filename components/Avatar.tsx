import { initials, avatarColor } from '@/lib/avatar';

export default function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: avatarColor(name),
        color: 'white',
        fontSize: size * 0.4,
        fontWeight: 800,
        flex: '0 0 auto',
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
