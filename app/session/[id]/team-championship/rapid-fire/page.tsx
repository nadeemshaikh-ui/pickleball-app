'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession, type SessionRow } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import SessionNav from '@/components/SessionNav';
import Avatar from '@/components/Avatar';
import ShareBrandedHeader from '@/components/ShareBrandedHeader';
import GroupHeader from '@/components/GroupHeader';
import SessionDate from '@/components/SessionDate';
import NewSessionLink from '@/components/NewSessionLink';
import { Flame, Trophy, Award, Zap, ArrowLeft, Layers, CheckCircle2 } from 'lucide-react';

interface RapidFirePlayerStat {
  name: string;
  squad: string;
  squadId: string;
  pointsScored: number;
  ralliesPlayed: number;
  efficiencyPct: number;
  isClutchHero: boolean;
}

interface ShiftLogEntry {
  shiftNumber: number;
  team1Pair: string;
  team2Pair: string;
  t1Pts: number;
  t2Pts: number;
  cumulativeT1: number;
  cumulativeT2: number;
  isOvertime: boolean;
}

export default function RapidFireAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [playerStats, setPlayerStats] = useState<RapidFirePlayerStat[]>([]);
  const [shiftLogs, setShiftLogs] = useState<ShiftLogEntry[]>([]);
  const [scoreTeam1, setScoreTeam1] = useState(0);
  const [scoreTeam2, setScoreTeam2] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const s = await getSession(id);
        setSession(s);

        if (!s || !s.squads || s.squads.length < 2) {
          setLoading(false);
          return;
        }

        const { data: logs, error } = await supabase
          .from('rapid_fire_log')
          .select('*')
          .eq('session_id', id)
          .order('event_order', { ascending: true });

        if (error || !logs) {
          setLoading(false);
          return;
        }

        const squad1 = s.squads[0];
        const squad2 = s.squads[1];

        let s1Count = 0;
        let s2Count = 0;

        const statsMap: Record<string, RapidFirePlayerStat> = {};

        s.players.forEach(p => {
          const isSquad1 = squad1.players.includes(p);
          const squadObj = isSquad1 ? squad1 : squad2;
          statsMap[p] = {
            name: p,
            squad: squadObj.label || (isSquad1 ? 'Gold' : 'Black'),
            squadId: squadObj.id,
            pointsScored: 0,
            ralliesPlayed: 0,
            efficiencyPct: 0,
            isClutchHero: ['Sumeet', 'Vinit', 'Nadeem', 'Viki', 'Amresh', 'Sid'].includes(p),
          };
        });

        // Group into shifts
        let currentPairKey = '';
        let currentGroup: any[] = [];
        const rawGroups: any[][] = [];

        logs.forEach(l => {
          if (l.scoring_team_id === 'team1') s1Count++;
          else if (l.scoring_team_id === 'team2') s2Count++;

          if (l.on_court_players) {
            l.on_court_players.forEach((p: string) => {
              if (statsMap[p]) {
                statsMap[p].ralliesPlayed++;
                if (squad1.players.includes(p) && l.scoring_team_id === 'team1') {
                  statsMap[p].pointsScored++;
                }
                if (squad2.players.includes(p) && l.scoring_team_id === 'team2') {
                  statsMap[p].pointsScored++;
                }
              }
            });
          }

          const pairKey = l.on_court_players ? l.on_court_players.join(',') : 'unknown';
          if (pairKey !== currentPairKey && currentGroup.length > 0) {
            rawGroups.push(currentGroup);
            currentGroup = [];
          }
          currentPairKey = pairKey;
          currentGroup.push(l);
        });
        if (currentGroup.length > 0) rawGroups.push(currentGroup);

        setScoreTeam1(s1Count);
        setScoreTeam2(s2Count);

        let cumT1 = 0;
        let cumT2 = 0;
        const parsedShifts: ShiftLogEntry[] = rawGroups.map((g, idx) => {
          const players = g[0].on_court_players || [];
          const t1Pair = players.slice(0, 2).join(' & ');
          const t2Pair = players.slice(2, 4).join(' & ');

          let t1P = 0;
          let t2P = 0;
          g.forEach((ev: any) => {
            if (ev.scoring_team_id === 'team1') t1P++;
            else if (ev.scoring_team_id === 'team2') t2P++;
          });

          cumT1 += t1P;
          cumT2 += t2P;

          return {
            shiftNumber: idx + 1,
            team1Pair: t1Pair,
            team2Pair: t2Pair,
            t1Pts: t1P,
            t2Pts: t2P,
            cumulativeT1: cumT1,
            cumulativeT2: cumT2,
            isOvertime: idx >= 20,
          };
        });

        setShiftLogs(parsedShifts);

        const list = Object.values(statsMap);
        list.forEach(ps => {
          ps.efficiencyPct = ps.ralliesPlayed > 0 ? (ps.pointsScored / ps.ralliesPlayed) * 100 : 0;
        });

        list.sort((a, b) => b.pointsScored - a.pointsScored);
        setPlayerStats(list);
      } catch (err) {
        console.error('Failed to load rapid fire data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const squad1Label = session?.squads?.[0]?.label || 'Home Team';
  const squad2Label = session?.squads?.[1]?.label || 'Challengers';
  const winnerLabel = scoreTeam2 > scoreTeam1 ? squad2Label : squad1Label;

  return (
    <>
      <main className="page" style={{ paddingBottom: 100 }}>
        <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href={`/session/${id}/team-championship/results`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={16} /> Back to Results
          </Link>
          <NewSessionLink />
        </div>

        <ShareBrandedHeader clubId={session?.club_id} />
        {session && <GroupHeader groupName={session.group_name} logoUrl1={session.logo_url_1} logoUrl2={session.logo_url_2} />}

        <div style={{ textAlign: 'center', marginTop: 12, marginBottom: 20 }}>
          <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 24, fontWeight: 800 }}>
            <Flame size={28} style={{ color: '#ef4444' }} /> Rapid Fire Finale Analysis
          </h1>
          {session && <SessionDate createdAt={session.created_at} eventDate={session.event_date} venue={session.venue} />}
        </div>

        {/* Hero Card (Only shown when points have actually been scored) */}
        {(scoreTeam1 > 0 || scoreTeam2 > 0) && (
          <div
            className="card text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 16,
              padding: '24px 16px',
              marginBottom: 24,
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.2)', color: '#f87171', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>
              <Trophy size={14} /> Rapid Fire Champions: {winnerLabel}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, margin: '16px 0' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.8 }}>{squad1Label}</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: scoreTeam1 > scoreTeam2 ? '#10b981' : 'var(--foreground)' }}>{scoreTeam1}</div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, opacity: 0.4 }}>VS</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.8 }}>{squad2Label}</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: scoreTeam2 > scoreTeam1 ? '#10b981' : 'var(--foreground)' }}>{scoreTeam2}</div>
              </div>
            </div>
          </div>
        )}

        {/* Overtime & Climax Story (Always visible as long as shifts are recorded) */}
        {shiftLogs.length > 0 && (
          <div className="card space-y-3" style={{ marginBottom: 24, padding: '20px 16px' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0, color: '#f59e0b' }}>
              <Zap size={18} /> Overtime Climax & Championship Sequence
            </h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 12px 0' }}>
              After intense rally rotation, the match reached the target threshold:
            </p>

            <div className="space-y-2">
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, borderLeft: '3px solid #10b981', fontSize: 13 }}>
                <strong>🏆 Championship Rotations:</strong> The final scoring sequence concluded after <strong>{shiftLogs.length} rotations</strong>, with <strong>{winnerLabel}</strong> securing the tournament point margin to clinch the title (<strong>{scoreTeam1} – {scoreTeam2}</strong>)!
              </div>
            </div>
          </div>
        )}

        {/* Player Stats Table */}
        <div className="card space-y-4" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Rapid Fire Player Performance</h3>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sorted by On-Court Points Scored</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13, borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <thead>
                <tr style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <th style={{ textAlign: 'center', width: 36 }}>#</th>
                  <th>Player</th>
                  <th>Squad</th>
                  <th style={{ textAlign: 'center', color: '#10b981', fontWeight: 700 }}>Points</th>
                  <th style={{ textAlign: 'center' }}>Rallies</th>
                  <th style={{ textAlign: 'center' }}>Efficiency</th>
                  <th style={{ textAlign: 'center' }}>Clutch</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map((p, idx) => (
                  <tr key={p.name} style={{ background: 'var(--row-bg, rgba(255,255,255,0.02))', borderRadius: 8 }}>
                    <td style={{ textAlign: 'center', fontWeight: 700, padding: '8px 4px' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={p.name} size={24} />
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 4px', fontSize: 12, opacity: 0.8 }}>{p.squad}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#10b981', padding: '8px 4px' }}>{p.pointsScored}</td>
                    <td style={{ textAlign: 'center', padding: '8px 4px', opacity: 0.8 }}>{p.ralliesPlayed}</td>
                    <td style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 600 }}>{p.efficiencyPct.toFixed(0)}%</td>
                    <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                      {p.isClutchHero ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: '#f59e0b', fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.15)', padding: '2px 6px', borderRadius: 4 }}>
                          ⚡ Hero
                        </span>
                      ) : (
                        <span style={{ opacity: 0.3 }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Complete Shift-by-Shift Match Log */}
        <div className="card space-y-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={18} style={{ color: 'var(--primary)' }} /> Shift-by-Shift Match Log (All 23 Rotations)
            </h3>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Pairing vs Pairing Scores</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13, borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <thead>
                <tr style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <th style={{ textAlign: 'center', width: 44 }}>Shift</th>
                  <th>{squad1Label} Pair</th>
                  <th>{squad2Label} Pair</th>
                  <th style={{ textAlign: 'center' }}>Shift Score</th>
                  <th style={{ textAlign: 'center', fontWeight: 800 }}>Running Total</th>
                </tr>
              </thead>
              <tbody>
                {shiftLogs.map(s => (
                  <tr
                    key={s.shiftNumber}
                    style={{
                      background: s.isOvertime ? 'rgba(245, 158, 11, 0.08)' : 'var(--row-bg, rgba(255,255,255,0.02))',
                      borderRadius: 8,
                      borderLeft: s.isOvertime ? '3px solid #f59e0b' : 'none',
                    }}
                  >
                    <td style={{ textAlign: 'center', fontWeight: 700, padding: '8px 4px' }}>
                      {s.isOvertime ? <span style={{ color: '#f59e0b', fontSize: 11 }}>⚡#{s.shiftNumber}</span> : `#${s.shiftNumber}`}
                    </td>
                    <td style={{ padding: '8px 4px', fontWeight: 600 }}>{s.team1Pair}</td>
                    <td style={{ padding: '8px 4px', fontWeight: 600 }}>{s.team2Pair}</td>
                    <td style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 700 }}>
                      <span style={{ color: s.t1Pts > s.t2Pts ? '#10b981' : 'inherit' }}>{s.t1Pts}</span> – <span style={{ color: s.t2Pts > s.t1Pts ? '#10b981' : 'inherit' }}>{s.t2Pts}</span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 900 }}>
                      <span style={{ color: 'var(--primary)' }}>{s.cumulativeT1} – {s.cumulativeT2}</span>
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
