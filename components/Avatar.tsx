import { initials, avatarColor } from '@/lib/avatar';
import { getPlayerPhoto } from '@/lib/playerPhotos';

export default function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const photoUrl = typeof window !== 'undefined' ? getPlayerPhoto(name) : null;

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flex: '0 0 auto',
        }}
        aria-hidden="true"
      />
    );
  }

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
