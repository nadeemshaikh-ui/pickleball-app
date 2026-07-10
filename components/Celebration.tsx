'use client';

import { TrophyIcon } from './icons';
import type { Badge } from '@/lib/badges';

const COLORS = ['#157a4c', '#ff7a1a', '#b8860b', '#2563eb', '#d64545'];

export interface CelebrationProps {
  winnerName: string;
  onDismiss: () => void;
  badges?: Badge[];
  streak?: number;
  mvpCount?: number;
}

export default function Celebration({ winnerName, onDismiss, badges = [], streak = 0, mvpCount = 0 }: CelebrationProps) {
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
        {(badges.length > 0 || streak >= 3 || mvpCount > 0) && (
          <div style={{ marginTop: 12, fontSize: 14, color: 'white', textAlign: 'center' }}>
            {streak >= 3 && <div>🔥 {streak}-game win streak</div>}
            {mvpCount > 0 && <div>⭐ MVP {mvpCount}x this month</div>}
            {badges.length > 0 && (
              <div style={{ marginTop: 4 }} title={badges.map(b => b.label).join(', ')}>
                {badges.map(b => b.emoji).join(' ')}
              </div>
            )}
          </div>
        )}
        <div className="celebration-hint">Tap anywhere to see full results</div>
      </div>
    </div>
  );
}
