import { Trophy, Zap } from 'lucide-react';
import type { RoundRow, SessionRow } from '@/lib/db';
import { computeSquadTotals, type PlayerStats } from '@/lib/analytics';
import { findBiggestBlowout } from '@/lib/gameStats';

export default function RecapImageTemplate({
  session,
  leaderboard,
  rounds,
  club,
}: {
  session: SessionRow;
  leaderboard: PlayerStats[];
  rounds: RoundRow[];
  club?: { name: string; logo_url: string | null } | null;
}) {
  const top3 = leaderboard.slice(0, 3);
  const blowout = findBiggestBlowout(rounds);
  const blowoutMargin = blowout ? Math.abs(blowout.score_a! - blowout.score_b!) : null;
  const blowoutWinner = blowout && blowout.score_a! > blowout.score_b! ? blowout.team_a : blowout?.team_b;

  const rankColor = (i: number) => (i === 0 ? '#e5c100' : i === 1 ? '#c0c0c0' : '#b06a3a');
  const squadTotals = session.format === 'squad_rivalry' && session.squads ? computeSquadTotals(rounds, session.squads) : null;

  return (
    <div style={{ width: 1080, background: '#e5fa00', padding: 32, fontFamily: 'var(--font-body), Arial, sans-serif' }}>
      <div style={{ background: '#121a2f', color: '#e5fa00', padding: '24px 32px', border: '3px solid #121a2f' }}>
        {club && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            {club.logo_url && (
              <img src={club.logo_url} alt="" width={48} height={48} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5fa00' }} />
            )}
            <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 28, fontWeight: 800, letterSpacing: 0.5 }}>
              {club.name.toUpperCase()}
            </div>
          </div>
        )}
        {session.group_name && (
          <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 44, lineHeight: 1 }}>
            {session.group_name.toUpperCase()}
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 64, lineHeight: 1.1, marginTop: 8 }}>
          SESSION RECAP
        </div>
        <div style={{ fontSize: 22, marginTop: 12, color: 'white' }}>
          {new Date(session.created_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {squadTotals && (
        <div style={{ background: '#ffffff', border: '3px solid #121a2f', borderTop: 'none', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <SquadResult label={session.squad_gold_label || 'Gold'} logoUrl={session.squad_gold_logo_url} score={squadTotals.gold} color="#d4af37" />
          <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 36, color: '#121a2f' }}>VS</div>
          <SquadResult label={session.squad_black_label || 'Black'} logoUrl={session.squad_black_logo_url} score={squadTotals.black} color="#121a2f" />
        </div>
      )}

      <div style={{ background: '#ffffff', border: '3px solid #121a2f', borderTop: 'none', padding: 32 }}>
        <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 30, color: '#121a2f', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Trophy size={28} /> PODIUM
        </div>
        {top3.map((p, i) => (
          <div
            key={p.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '12px 0',
              borderBottom: i < top3.length - 1 ? '2px solid #eee' : 'none',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: rankColor(i),
                color: '#121a2f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display), sans-serif',
                fontSize: 22,
              }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1, fontSize: 26, fontWeight: 700, color: '#121a2f' }}>{p.name}</div>
            <div style={{ fontSize: 22, color: '#555' }}>
              {p.wins}W {p.losses}L
            </div>
          </div>
        ))}

        {blowout && blowoutWinner && (
          <div style={{ marginTop: 24, fontSize: 22, color: '#121a2f', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={20} /> Biggest win margin: <strong>{blowoutWinner.join(' & ')}</strong> by {blowoutMargin} points
          </div>
        )}
      </div>

      <div
        style={{
          background: '#121a2f',
          color: '#e5fa00',
          textAlign: 'center',
          padding: '16px 20px',
          fontFamily: 'var(--font-display), sans-serif',
          fontSize: 26,
          border: '3px solid #121a2f',
          borderTop: 'none',
        }}
      >
        GAME ON. HAVE FUN.
      </div>
    </div>
  );
}

function SquadResult({ label, logoUrl, score, color }: { label: string; logoUrl: string | null; score: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 200 }}>
      {logoUrl ? (
        <img src={logoUrl} alt="" width={72} height={72} style={{ borderRadius: '50%', objectFit: 'cover', border: `4px solid ${color}` }} />
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
            color: '#ffffff',
            fontFamily: 'var(--font-display), sans-serif',
            fontSize: 30,
          }}
        >
          {label.charAt(0).toUpperCase()}
        </div>
      )}
      <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 22, color: '#121a2f', textAlign: 'center' }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 40, color: '#121a2f' }}>{score}</div>
    </div>
  );
}
