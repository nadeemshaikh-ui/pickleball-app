'use client';

import { TrophyIcon } from './icons';

const COLORS = ['#157a4c', '#ff7a1a', '#b8860b', '#2563eb', '#d64545'];

export default function Celebration({ winnerName, onDismiss }: { winnerName: string; onDismiss: () => void }) {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2 + Math.random() * 1.5,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="celebration-overlay" onClick={onDismiss} role="button" tabIndex={0} aria-label="Dismiss celebration">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      <div>
        <div className="celebration-trophy" aria-hidden="true">
          <TrophyIcon size={64} />
        </div>
        <div className="celebration-name">{winnerName} wins the session!</div>
        <div className="celebration-hint">Tap anywhere to see full results</div>
      </div>
    </div>
  );
}
