interface SquadVersusHeroProps {
  goldLabel: string;
  blackLabel: string;
  goldLogoUrl: string | null;
  blackLogoUrl: string | null;
  goldScore?: number;
  blackScore?: number;
}

// The shared left-squad / VS / right-squad layout — used on Results,
// Leaderboard, live Play scoring, and the shareable recap image, so a
// Squad Rivalry session reads the same everywhere instead of each screen
// inventing its own squad-score treatment.
export default function SquadVersusHero({ goldLabel, blackLabel, goldLogoUrl, blackLogoUrl, goldScore, blackScore }: SquadVersusHeroProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '14px 8px' }}>
      <SquadSide label={goldLabel} logoUrl={goldLogoUrl} score={goldScore} color="#d4af37" />
      <div
        style={{
          fontWeight: 900,
          fontSize: 20,
          letterSpacing: 1,
          color: 'var(--muted)',
          flexShrink: 0,
          width: 40,
          textAlign: 'center',
        }}
      >
        VS
      </div>
      <SquadSide label={blackLabel} logoUrl={blackLogoUrl} score={blackScore} color="#1a1a1a" />
    </div>
  );
}

function SquadSide({
  label,
  logoUrl,
  score,
  color,
}: {
  label: string;
  logoUrl: string | null;
  score?: number;
  color: string;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          width={56}
          height={56}
          style={{ borderRadius: '50%', objectFit: 'cover', border: `3px solid ${color}` }}
        />
      ) : (
        <div
          style={{
            width: 56,
            height: 56,
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
      <div style={{ fontWeight: 800, fontSize: 15, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
        {label}
      </div>
      {score !== undefined && <div style={{ fontWeight: 900, fontSize: 28 }}>{score}</div>}
    </div>
  );
}
