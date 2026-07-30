'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession, getRounds, type SessionRow, type RoundRow } from '@/lib/db';
import SessionNav from '@/components/SessionNav';
import Avatar from '@/components/Avatar';
import ShareBrandedHeader from '@/components/ShareBrandedHeader';
import GroupHeader from '@/components/GroupHeader';
import SessionDate from '@/components/SessionDate';
import NewSessionLink from '@/components/NewSessionLink';
import { ListOrdered, ArrowLeft, Trophy, Layers } from 'lucide-react';

interface PlayerSessionBreakdown {
  name: string;
  squad: string;
  s1Wins: number;
  s1Pts: number;
  s2Wins: number;
  s2Pts: number;
  s3Wins: number;
  s3Pts: number;
  totalWeightedPts: number;
}

export default function SessionBreakdownPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [playerBreakdown, setPlayerBreakdown] = useState<PlayerSessionBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [s, rounds] = await Promise.all([getSession(id), getRounds(id)]);
        setSession(s);

        if (!s || !s.squads || s.squads.length < 2) {
          setLoading(false);
          return;
        }

        const squad1 = s.squads[0];
        const squad2 = s.squads[1];

        const statsMap: Record<string, PlayerSessionBreakdown> = {};

        s.players.forEach(p => {
          const isSquad1 = squad1.players.includes(p);
          statsMap[p] = {
            name: p,
            squad: isSquad1 ? (squad1.label || 'Gold') : (squad2.label || 'Black'),
            s1Wins: 0,
            s1Pts: 0,
            s2Wins: 0,
            s2Pts: 0,
            s3Wins: 0,
            s3Pts: 0,
            totalWeightedPts: 0,
          };
        });

        rounds.forEach(r => {
          if (r.score_a === null || r.score_b === null) return;
          const aWon = r.score_a > r.score_b;
          const stageNum = r.round_number <= 5 ? 1 : r.round_number <= 10 ? 2 : 3;
          const weight = stageNum === 1 ? 1 : stageNum === 2 ? 2 : 3;

          const teamAWinners = aWon ? r.team_a : [];
          const teamBWinners = !aWon ? r.team_b : [];
          const winners = [...teamAWinners, ...teamBWinners];

          winners.forEach(p => {
            if (statsMap[p]) {
              if (stageNum === 1) {
                statsMap[p].s1Wins++;
                statsMap[p].s1Pts += 1;
              } else if (stageNum === 2) {
                statsMap[p].s2Wins++;
                statsMap[p].s2Pts += 2;
              } else if (stageNum === 3) {
                statsMap[p].s3Wins++;
                statsMap[p].s3Pts += 3;
              }
              statsMap[p].totalWeightedPts += weight;
            }
          });
        });

        const list = Object.values(statsMap).sort((a, b) => b.totalWeightedPts - a.totalWeightedPts);
        setPlayerBreakdown(list);
      } catch (err) {
        console.error('Failed to load session breakdown:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  return (
    <>
      <main className="page" style={{ paddingBottom: 100 }}>
        <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'between' }}>
          <Link href={`/session/${id}/team-championship/results`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={16} /> Back to Results
          </Link>
          <NewSessionLink />
        </div>

        <ShareBrandedHeader clubId={session?.club_id} />
        {session && <GroupHeader groupName={session.group_name} logoUrl1={session.logo_url_1} logoUrl2={session.logo_url_2} />}

        <div style={{ textAlign: 'center', marginTop: 12, marginBottom: 20 }}>
          <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 24, fontWeight: 800 }}>
            <Layers size={26} style={{ color: 'var(--primary)' }} /> Session-by-Session Player Points
          </h1>
          {session && <SessionDate createdAt={session.created_at} eventDate={session.event_date} venue={session.venue} />}
        </div>

        {/* Stage Points Multiplier Legend */}
        <div className="card" style={{ marginBottom: 20, padding: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px 0' }}>Stage Multipliers & Scoring Rules</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase' }}>Session 1 (Rounds 1–5)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#3b82f6' }}>1 Pt per Match Win</div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase' }}>Session 2 (Rounds 6–10)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>2 Pts per Match Win</div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>Session 3 (Rounds 11–15)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>3 Pts per Match Win</div>
            </div>
          </div>
        </div>

        {/* Detailed Player Session Table */}
        <div className="card space-y-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Individual Session Point Totals</h3>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Weighted Points Total</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13, borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <thead>
                <tr style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <th style={{ textAlign: 'center', width: 36 }}>#</th>
                  <th>Player</th>
                  <th>Squad</th>
                  <th style={{ textAlign: 'center', color: '#60a5fa' }}>Session 1 (1x)</th>
                  <th style={{ textAlign: 'center', color: '#fbbf24' }}>Session 2 (2x)</th>
                  <th style={{ textAlign: 'center', color: '#34d399' }}>Session 3 (3x)</th>
                  <th style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: 800 }}>Total Pts</th>
                </tr>
              </thead>
              <tbody>
                {playerBreakdown.map((p, idx) => (
                  <tr key={p.name} style={{ background: 'var(--row-bg, rgba(255,255,255,0.02))', borderRadius: 8 }}>
                    <td style={{ textAlign: 'center', fontWeight: 700, padding: '8px 4px' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={p.name} size={24} />
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 4px', fontSize: 12, opacity: 0.8 }}>{p.squad}</td>
                    <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                      <span style={{ fontWeight: 600 }}>{p.s1Wins}W</span> <span style={{ fontSize: 11, opacity: 0.7 }}>({p.s1Pts}pt)</span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                      <span style={{ fontWeight: 600 }}>{p.s2Wins}W</span> <span style={{ fontSize: 11, opacity: 0.7 }}>({p.s2Pts}pt)</span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                      <span style={{ fontWeight: 600 }}>{p.s3Wins}W</span> <span style={{ fontSize: 11, opacity: 0.7 }}>({p.s3Pts}pt)</span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', fontWeight: 900, fontSize: 14 }}>
                        {p.totalWeightedPts}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <SessionNav sessionId={id} format={session?.format} clubId={session?.club_id} />
    </>
  );
}
