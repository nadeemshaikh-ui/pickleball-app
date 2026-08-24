'use client';

import React, { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, Users, MapPin, Shield, DollarSign, ArrowLeft, CheckCircle2, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';

export default function MatchDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [match, setMatch] = useState<any>(null);
  const [rsvps, setRsvps] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const loadData = async () => {
      try {
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select('*')
          .eq('id', id)
          .single();

        if (matchError) throw matchError;
        setMatch(matchData);

        const { data: rsvpData, error: rsvpError } = await supabase
          .from('match_rsvps')
          .select('*')
          .eq('match_id', id);

        if (rsvpError) throw rsvpError;
        setRsvps(rsvpData || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load match.');
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Setup realtime subscription
    const channel = supabase
      .channel(`match_rsvps:match_id=eq.${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_rsvps', filter: `match_id=eq.${id}` }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleRSVP = async (status: 'in' | 'out') => {
    if (!user) return;
    setUpdating(true);
    try {
      const existing = rsvps.find((r) => r.player_id === user.id);
      if (existing) {
        await supabase
          .from('match_rsvps')
          .update({ status, waitlist_position: null })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('match_rsvps')
          .insert({ match_id: id, player_id: user.id, status });
      }
    } catch (err: any) {
      setError(err.message || 'RSVP action failed.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <main className="page text-center" style={{ padding: 40 }}>
        <p style={{ fontSize: 16, fontWeight: 700 }}>⚡ Loading Match Details...</p>
      </main>
    );
  }

  if (error || !match) {
    return (
      <main className="page" style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
        <div className="card" style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 20, color: '#dc2626' }}>
          <h3>Failed to load match</h3>
          <p>{error || 'Match details not found.'}</p>
          <Link href="/">Back to Dashboard</Link>
        </div>
      </main>
    );
  }

  const myRsvp = user ? rsvps.find((r) => r.player_id === user.id) : null;
  const confirmedPlayers = rsvps.filter((r) => r.status === 'in');
  const waitlistedPlayers = rsvps.filter((r) => r.status === 'waitlisted');
  const declinedPlayers = rsvps.filter((r) => r.status === 'out');

  return (
    <main className="page" style={{ padding: '24px 16px', maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header-row" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Back
        </Link>
        <a
          href={`/api/matches/${id}/sync`}
          download
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, textDecoration: 'none' }}
        >
          📅 Export to Calendar
        </a>
      </div>

      <div className="card" style={{ background: '#ffffff', borderRadius: 16, padding: '24px 20px', border: '1px solid #e2e8f0', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: 6 }}>
            {match.format} Match
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> {confirmedPlayers.length} / {match.max_players} Filled
          </span>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>
          {match.venue_details?.name || 'Match Session'}
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '16px 0', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
            <Calendar size={18} style={{ color: '#64748b' }} />
            <span><strong>Date & Time:</strong> {new Date(match.scheduled_time).toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
            <MapPin size={18} style={{ color: '#64748b' }} />
            <span><strong>Court details:</strong> {match.venue_details?.court_number || 'N/A'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
            <Shield size={18} style={{ color: '#64748b' }} />
            <span><strong>DUPR target:</strong> {match.dupr_min || 'Any'} – {match.dupr_max || 'Any'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
            <DollarSign size={18} style={{ color: '#64748b' }} />
            <span><strong>Booking cost:</strong> ₹{match.total_cost} ({match.cost_split_policy})</span>
          </div>
        </div>

        {/* Dynamic Cost-Split Allocation Details */}
        {match.total_cost > 0 && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 12, borderRadius: 8, fontSize: 12, color: '#64748b', marginBottom: 20 }}>
            💰 <strong>Cost split:</strong> ₹{(match.total_cost / Math.max(1, confirmedPlayers.length)).toFixed(0)} split among all confirmed attendees.
          </div>
        )}

        {/* 1-Tap RSVP interactive Panel */}
        {user && (
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Your Attendance Status</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleRSVP('in')}
                disabled={updating || myRsvp?.status === 'in'}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}
              >
                <CheckCircle2 size={16} /> I&apos;m In 🏓
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleRSVP('out')}
                disabled={updating || myRsvp?.status === 'out'}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}
              >
                <XCircle size={16} /> Can&apos;t Make It
              </button>
            </div>
            {myRsvp && (
              <p style={{ fontSize: 12, fontWeight: 700, color: myRsvp.status === 'in' ? '#059669' : '#dc2626', marginTop: 10, textAlign: 'center' }}>
                Your current status: {myRsvp.status.toUpperCase()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Confirmed Roster list */}
      <div className="card" style={{ background: '#ffffff', borderRadius: 16, padding: '20px 18px', border: '1px solid #e2e8f0', marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 900 }}>Confirmed Players ({confirmedPlayers.length})</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {confirmedPlayers.map((player: any) => (
            <div key={player.id} style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{player.player_id.slice(0, 8)}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: 4 }}>CONFIRMED</span>
            </div>
          ))}
          {confirmedPlayers.length === 0 && (
            <p style={{ fontSize: 13, color: '#64748b', textAlign: 'center', padding: '12px 0' }}>No players confirmed yet.</p>
          )}
        </div>
      </div>

      {/* Waitlist list */}
      {waitlistedPlayers.length > 0 && (
        <div className="card" style={{ background: '#ffffff', borderRadius: 16, padding: '20px 18px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 900 }}>Waitlist Queue ({waitlistedPlayers.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {waitlistedPlayers.map((player: any, idx: number) => (
              <div key={player.id} style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{player.player_id.slice(0, 8)}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#d97706' }}>Position #{idx + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
