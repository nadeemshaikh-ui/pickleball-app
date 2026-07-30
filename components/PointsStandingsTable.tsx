'use client';

import { useState } from 'react';
import type { PlayerStats } from '@/lib/analytics';
import Avatar from './Avatar';
import { Activity } from 'lucide-react';

interface PointsStandingsTableProps {
  stats: PlayerStats[];
  showDetailsToggle?: boolean;
  highlightTop3?: boolean;
}

export default function PointsStandingsTable({
  stats,
  showDetailsToggle = true,
  highlightTop3 = true,
}: PointsStandingsTableProps) {
  const [viewMode, setViewMode] = useState<'overview' | 'points_detail'>('overview');

  if (!stats || stats.length === 0) {
    return (
      <div className="card text-center text-muted" style={{ padding: '2rem 1rem' }}>
        No match scores logged yet to calculate points statistics.
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      {/* Header controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={18} style={{ color: 'var(--primary)' }} />
            Points & Performance Breakdown
          </h3>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Points Won (PW), Points Lost (PL) & Point Differential (PD)
          </span>
        </div>

        {showDetailsToggle && (
          <div style={{ display: 'flex', background: 'var(--card-bg, #1e293b)', borderRadius: 8, padding: 2 }}>
            <button
              onClick={() => setViewMode('overview')}
              className="btn btn-sm"
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 6,
                background: viewMode === 'overview' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'overview' ? '#fff' : 'var(--muted)',
                border: 'none',
                fontWeight: 600,
              }}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode('points_detail')}
              className="btn btn-sm"
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 6,
                background: viewMode === 'points_detail' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'points_detail' ? '#fff' : 'var(--muted)',
                border: 'none',
                fontWeight: 600,
              }}
            >
              Detailed PW/PL
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', fontSize: 13, borderCollapse: 'separate', borderSpacing: '0 4px' }}>
          <thead>
            <tr style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              <th style={{ textAlign: 'center', width: 36 }}>#</th>
              <th>Player</th>
              <th style={{ textAlign: 'center' }}>GP</th>
              <th style={{ textAlign: 'center' }}>W-L</th>
              <th style={{ textAlign: 'center', color: '#10b981', fontWeight: 700 }}>PW</th>
              <th style={{ textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>PL</th>
              <th style={{ textAlign: 'center', fontWeight: 800 }}>PD</th>
              {viewMode === 'points_detail' && (
                <>
                  <th style={{ textAlign: 'center' }}>Avg PW</th>
                  <th style={{ textAlign: 'center' }}>Avg PL</th>
                  <th style={{ textAlign: 'center' }}>Efficiency</th>
                  <th style={{ textAlign: 'center' }}>Clutch W%</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {stats.map((p, idx) => {
              const rank = idx + 1;
              const isTop3 = highlightTop3 && rank <= 3;
              const pd = p.pointDiff ?? (p.pointsFor - p.pointsAgainst);
              const avgPW = p.avgPointsFor ?? (p.gamesPlayed > 0 ? p.pointsFor / p.gamesPlayed : 0);
              const avgPL = p.avgPointsAgainst ?? (p.gamesPlayed > 0 ? p.pointsAgainst / p.gamesPlayed : 0);
              const sharePct = p.pointSharePct ?? ((p.pointsFor + p.pointsAgainst) > 0 ? (p.pointsFor / (p.pointsFor + p.pointsAgainst)) * 100 : 0);
              const clutchW = p.clutchWins ?? 0;
              const clutchL = p.clutchLosses ?? 0;
              const clutchPct = p.clutchWinPct ?? (clutchW + clutchL > 0 ? clutchW / (clutchW + clutchL) : 0);

              const diffColor = pd > 0 ? '#10b981' : pd < 0 ? '#ef4444' : 'var(--muted)';
              const diffPrefix = pd > 0 ? '+' : '';

              return (
                <tr
                  key={p.name}
                  style={{
                    background: isTop3 ? 'rgba(234, 179, 8, 0.06)' : 'var(--row-bg, rgba(255,255,255,0.02))',
                    borderRadius: 8,
                  }}
                >
                  {/* Rank */}
                  <td style={{ textAlign: 'center', fontWeight: 700, padding: '8px 4px' }}>
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                  </td>

                  {/* Name + Avatar */}
                  <td style={{ padding: '8px 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={p.name} size={26} />
                      <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{p.name}</span>
                    </div>
                  </td>

                  {/* Games Played */}
                  <td style={{ textAlign: 'center', padding: '8px 4px', opacity: 0.8 }}>{p.gamesPlayed}</td>

                  {/* W-L */}
                  <td style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 600 }}>
                    <span style={{ color: '#10b981' }}>{p.wins}</span>-<span style={{ color: '#ef4444' }}>{p.losses}</span>
                  </td>

                  {/* Points Won (PW) */}
                  <td style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 700, color: '#10b981' }}>
                    {p.pointsFor}
                  </td>

                  {/* Points Lost (PL) */}
                  <td style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 700, color: '#ef4444' }}>
                    {p.pointsAgainst}
                  </td>

                  {/* Point Differential (PD) */}
                  <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: `${diffColor}18`,
                        color: diffColor,
                        fontWeight: 800,
                        fontSize: 12,
                      }}
                    >
                      {diffPrefix}{pd}
                    </span>
                  </td>

                  {/* Detailed columns */}
                  {viewMode === 'points_detail' && (
                    <>
                      {/* Avg PW */}
                      <td style={{ textAlign: 'center', padding: '8px 4px', opacity: 0.9 }}>
                        {avgPW.toFixed(1)}
                      </td>

                      {/* Avg PL */}
                      <td style={{ textAlign: 'center', padding: '8px 4px', opacity: 0.9 }}>
                        {avgPL.toFixed(1)}
                      </td>

                      {/* Point Share % / Efficiency */}
                      <td style={{ textAlign: 'center', padding: '8px 4px', minWidth: 90 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 700 }}>{sharePct.toFixed(0)}%</span>
                          <div style={{ width: 44, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(0, sharePct))}%`,
                                height: '100%',
                                background: sharePct >= 50 ? '#10b981' : '#ef4444',
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Clutch W% */}
                      <td style={{ textAlign: 'center', padding: '8px 4px', fontSize: 12 }}>
                        {clutchW + clutchL > 0 ? (
                          <span style={{ fontWeight: 600 }}>{(clutchPct * 100).toFixed(0)}%</span>
                        ) : (
                          <span style={{ opacity: 0.4 }}>-</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
