type IconProps = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function ActivityIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  );
}

export function TargetIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

export function FlameIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 2c1.5 3 5 5 5 9.5A5 5 0 0 1 7 11.5C7 9 8 8 8 8s.5 2 2 2c1 0 1-1 1-1s-2-2-2-4c0-1.5 1-2.5 3-3Z" />
    </svg>
  );
}

export function BoltIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

export function HandshakeIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 11 8 6l4 3 4-3 5 5" />
      <path d="M8 6v6l4 4 2-2" />
      <path d="M16 9l-2 2 2 2" />
    </svg>
  );
}

export function TrendUpIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

export function StarIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)} fill="currentColor" stroke="none">
      <path d="M12 2l2.9 6.2 6.8.7-5 4.7 1.4 6.7L12 16.9 5.9 20.3l1.4-6.7-5-4.7 6.8-.7L12 2z" />
    </svg>
  );
}

export function TrophyIcon({ size = 64 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5a3 3 0 0 0 3 4" />
      <path d="M16 5h3a3 3 0 0 1-3 4" />
      <path d="M10 14v3h4v-3" />
      <path d="M8 20h8" />
      <path d="M9 20v-3h6v3" />
    </svg>
  );
}

export function BurstIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)} fill="currentColor" stroke="none">
      <path d="M12 1l1.8 5.6L19 3l-2.1 5.5L23 9l-5.5 2.1L23 15l-6-.6 2.1 5.5L14 16l-2 6-2-6-5.1 3.9L7 14l-6 .6L6.5 11 1 9l5.9-1.5L4.8 3l5.4 3.4L12 1z" />
    </svg>
  );
}

export function ChairIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 4v9a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4" />
      <path d="M6 13v7" />
      <path d="M18 13v7" />
      <path d="M8 20h8" />
    </svg>
  );
}

export function ShieldCheckIcon({ size = 24 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function WhatsAppIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5C10 9.8 9.5 8.4 9.3 7.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.1-.3-.2-.5-.3Z" />
      <path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.5-1.2l-.3-.2-3 1 1-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z" />
    </svg>
  );
}

export function CalendarIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}
