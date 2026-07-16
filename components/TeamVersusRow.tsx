interface TeamVersusRowProps {
  label: string;
  logoUrl: string | null;
  score?: number;
  color?: string;
}

const DEFAULT_COLOR = 'var(--primary)';

// Extracted from SquadVersusHero's private SquadSide — generalized so
// tournament Fixtures/Bracket components can reuse the same "logo + label +
// score" treatment without being limited to a fixed gold/black pair.
export default function TeamVersusRow({ label, logoUrl, score, color = DEFAULT_COLOR }: TeamVersusRowProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          width={72}
          height={72}
          crossOrigin="anonymous"
          style={{ borderRadius: '50%', objectFit: 'cover', border: `3px solid ${color}` }}
        />
      ) : (
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 800,
            fontSize: 22,
          }}
        >
          {label.charAt(0).toUpperCase()}
        </div>
      )}
      <div
        style={{
          fontWeight: 800,
          fontSize: 15,
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
      >
        {label}
      </div>
      {score !== undefined && <div style={{ fontWeight: 900, fontSize: 28 }}>{score}</div>}
    </div>
  );
}
