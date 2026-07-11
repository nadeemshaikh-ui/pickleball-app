'use client';

import { useState } from 'react';

const CARDS = [
  {
    icon: '🏟️',
    title: 'Start a session',
    body: 'Pick your courts, add players, choose a format — Scramble, Fixed Partners, Court Blocks, or King of the Court.',
  },
  {
    icon: '📱',
    title: 'Score as you play',
    body: 'Tap in scores live, or use voice entry — just say the score out loud between points.',
  },
  {
    icon: '📊',
    title: 'Check stats & league',
    body: 'Every game feeds your lifetime stats, streaks, and League standings — find it all under 🏆 League.',
  },
];

export default function TourStep({ onSkip, onDone }: { onSkip: () => void; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const card = CARDS[index];
  const isLast = index === CARDS.length - 1;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 40 }}>{card.icon}</div>
      <h2>{card.title}</h2>
      <p style={{ color: 'var(--muted)' }}>{card.body}</p>
      <button className="btn-primary" onClick={() => (isLast ? onDone() : setIndex(i => i + 1))}>
        {isLast ? "Let's go!" : 'Next'}
      </button>
      <button className="text-link-btn" onClick={onSkip}>
        Skip
      </button>
    </div>
  );
}
