'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Home, Calendar, Users, MapPin, Shield, DollarSign } from 'lucide-react';
import Link from 'next/link';

export default function CreateMatchPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    format: 'doubles',
    venueName: '',
    courtNumber: '',
    address: '',
    duprMin: '3.00',
    duprMax: '4.50',
    costSplitPolicy: 'even_split',
    totalCost: '0.00',
    maxPlayers: 4,
    broadcastTarget: 'all_members',
    scheduledTime: '',
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const handleCreate = async () => {
    if (!user) {
      setError('You must be logged in to create a match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase.from('matches').insert({
        creator_id: user.id,
        format: formData.format,
        venue_details: {
          name: formData.venueName,
          court_number: formData.courtNumber,
          address: formData.address,
        },
        dupr_min: parseFloat(formData.duprMin) || null,
        dupr_max: parseFloat(formData.duprMax) || null,
        cost_split_policy: formData.costSplitPolicy,
        total_cost: parseFloat(formData.totalCost) || 0.00,
        max_players: parseInt(formData.maxPlayers.toString()) || 4,
        broadcast_target: formData.broadcastTarget,
        scheduled_time: new Date(formData.scheduledTime).toISOString(),
      }).select().single();

      if (insertError) throw insertError;
      
      // Auto-join the creator as 'in'
      await supabase.from('match_rsvps').insert({
        match_id: data.id,
        player_id: user.id,
        status: 'in',
      });

      router.push(`/matches/${data.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create match.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page" style={{ padding: '24px 16px', maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header-row" style={{ marginBottom: 20 }}>
        <Link href="/" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Home size={14} /> Home
        </Link>
      </div>

      <div className="card" style={{ background: '#ffffff', borderRadius: 16, padding: '24px 20px', border: '1px solid #e2e8f0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6, color: '#0f172a' }}>Create Match</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Configure session format, location, DUPR skill target, and cost splits.</p>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Step Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
                background: step === s ? '#0f172a' : '#f1f5f9',
                color: step === s ? '#e5fa00' : '#64748b'
              }}>
                {s}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: step === s ? '#0f172a' : '#94a3b8' }}>
                {s === 1 && 'Details'}
                {s === 2 && 'DUPR & Cost'}
                {s === 3 && 'Publish'}
              </span>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>Format</label>
              <select
                value={formData.format}
                onChange={(e) => setFormData({ ...formData, format: e.target.value, maxPlayers: e.target.value === 'singles' ? 2 : 4 })}
                style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
              >
                <option value="singles">Singles (2 Players)</option>
                <option value="doubles">Doubles (4 Players)</option>
                <option value="open_play">Open Play (5-12 Players)</option>
              </select>
            </div>

            {formData.format === 'open_play' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>Max Players</label>
                <input
                  type="number"
                  value={formData.maxPlayers}
                  onChange={(e) => setFormData({ ...formData, maxPlayers: parseInt(e.target.value) || 8 })}
                  style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>Venue Name</label>
              <input
                type="text"
                placeholder="e.g. Oshiwara Turf"
                value={formData.venueName}
                onChange={(e) => setFormData({ ...formData, venueName: e.target.value })}
                style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>Court Number</label>
                <input
                  type="text"
                  placeholder="e.g. Court 3"
                  value={formData.courtNumber}
                  onChange={(e) => setFormData({ ...formData, courtNumber: e.target.value })}
                  style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.scheduledTime}
                  onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                  style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>Min DUPR</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.duprMin}
                  onChange={(e) => setFormData({ ...formData, duprMin: e.target.value })}
                  style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>Max DUPR</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.duprMax}
                  onChange={(e) => setFormData({ ...formData, duprMax: e.target.value })}
                  style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>Cost Allocation Policy</label>
              <select
                value={formData.costSplitPolicy}
                onChange={(e) => setFormData({ ...formData, costSplitPolicy: e.target.value })}
                style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
              >
                <option value="even_split">Even Split amongst Confirmed Roster</option>
                <option value="creator_pays">Creator Pays Full Cost</option>
                <option value="individual_payment">Direct Cost Split request</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>Total Court Cost (INR)</label>
              <input
                type="number"
                placeholder="Total booking cost"
                value={formData.totalCost}
                onChange={(e) => setFormData({ ...formData, totalCost: e.target.value })}
                style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: '#0f172a' }}>Review Match Invitation Summary</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#475569' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Users size={16} /> <strong>Format:</strong> {formData.format} ({formData.maxPlayers} max players)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MapPin size={16} /> <strong>Venue:</strong> {formData.venueName} - {formData.courtNumber}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Calendar size={16} /> <strong>Scheduled At:</strong> {formData.scheduledTime ? new Date(formData.scheduledTime).toLocaleString() : 'Not Set'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={16} /> <strong>DUPR Target:</strong> {formData.duprMin} – {formData.duprMax}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><DollarSign size={16} /> <strong>Cost Policy:</strong> {formData.costSplitPolicy} (₹{formData.totalCost})</div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>Broadcast Scope</label>
              <select
                value={formData.broadcastTarget}
                onChange={(e) => setFormData({ ...formData, broadcastTarget: e.target.value })}
                style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
              >
                <option value="all_members">Broadcast invite to All Members</option>
                <option value="invite_only">Invite manually / Restricted roster</option>
              </select>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, pt: 16, borderTop: '1px solid #f1f5f9' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            style={{ padding: '10px 18px', fontSize: 13, fontWeight: 700 }}
          >
            Back
          </button>

          {step < 3 ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              style={{ padding: '10px 18px', fontSize: 13, fontWeight: 700 }}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={loading || !formData.scheduledTime}
              style={{ padding: '10px 18px', fontSize: 13, fontWeight: 700 }}
            >
              {loading ? 'Creating...' : 'Create & Publish Match'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
