import TeamVersusRow from './TeamVersusRow';

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
// inventing its own squad-score treatment. Composes TeamVersusRow (also used
// by the tournament Fixtures list) rather than a private copy.
export default function SquadVersusHero({ goldLabel, blackLabel, goldLogoUrl, blackLogoUrl, goldScore, blackScore }: SquadVersusHeroProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '14px 8px' }}>
      <TeamVersusRow label={goldLabel} logoUrl={goldLogoUrl} score={goldScore} color="#d4af37" />
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
      <TeamVersusRow label={blackLabel} logoUrl={blackLogoUrl} score={blackScore} color="#1a1a1a" />
    </div>
  );
}
