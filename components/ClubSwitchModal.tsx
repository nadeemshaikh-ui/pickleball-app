'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentClub } from '@/lib/useCurrentClub';
import { listMyPendingJoinRequests, listMyPendingClubCreationRequests, type JoinRequestRow, type ClubRow, type ClubCreationRequestRow, type ClubMembership } from '@/lib/clubs';
import { Building2, X, Plus, Check, Bell, Users } from 'lucide-react';

interface ClubSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ClubSwitchModal({ isOpen, onClose }: ClubSwitchModalProps) {
  const router = useRouter();
  const { currentClub, currentClubId, setCurrentClubId, clubs, isCurrentClubAdmin } = useCurrentClub();
  const [pendingJoin, setPendingJoin] = useState<(JoinRequestRow & { club: ClubRow })[]>([]);
  const [pendingCreation, setPendingCreation] = useState<ClubCreationRequestRow[]>([]);

  useEffect(() => {
    if (isOpen) {
      listMyPendingJoinRequests().then(setPendingJoin).catch(() => setPendingJoin([]));
      listMyPendingClubCreationRequests().then(setPendingCreation).catch(() => setPendingCreation([]));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleSelectClub(clubId: string) {
    setCurrentClubId(clubId);
    onClose();
    router.replace(`/clubs/${clubId}`);
  }

  function handleGuestMode() {
    if (typeof window !== 'undefined') localStorage.removeItem('currentClubId');
    onClose();
    router.replace('/setup');
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--card-bg, #0f172a)',
          border: '1px solid var(--border, rgba(255,255,255,0.15))',
          borderRadius: 20,
          padding: 24,
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={20} style={{ color: '#2563eb' }} /> Select Active Club
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Active Club Banner */}
        {currentClub ? (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {currentClub.logo_url ? (
                <img src={currentClub.logo_url} alt="" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                  {currentClub.name[0]}
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#3b82f6', fontWeight: 800, letterSpacing: 0.5 }}>Currently Active</div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{currentClub.name}</div>
              </div>
            </div>
            {isCurrentClubAdmin && (
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '3px 8px', borderRadius: 6 }}>
                Admin
              </span>
            )}
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--muted)' }}>
            Playing in <strong>Guest / Quick Play Mode</strong> (stats isolated from club rankings).
          </div>
        )}

        {/* Joined Clubs List */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 800, letterSpacing: 0.5, marginBottom: 8 }}>
            My Joined Clubs ({clubs.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
            {clubs.map((m: ClubMembership) => {
              const isSelected = m.club_id === currentClubId;
              return (
                <button
                  key={m.club_id}
                  onClick={() => handleSelectClub(m.club_id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: isSelected ? 'rgba(37,99,235,0.12)' : 'var(--card, rgba(255,255,255,0.03))',
                    border: isSelected ? '1.5px solid #2563eb' : '1px solid var(--border)',
                    color: 'var(--foreground)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                      {m.club.name[0]}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{m.club.name}</span>
                  </div>
                  {isSelected && <Check size={16} style={{ color: '#2563eb' }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pending Requests */}
        {(pendingJoin.length > 0 || pendingCreation.length > 0) && (
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Bell size={12} /> Pending Approval
            </div>
            {pendingJoin.map(r => (
              <div key={r.id} style={{ fontSize: 12, color: 'var(--muted)' }}>
                • Request to join <strong>{r.club.name}</strong> is pending admin review.
              </div>
            ))}
            {pendingCreation.map(r => (
              <div key={r.id} style={{ fontSize: 12, color: 'var(--muted)' }}>
                • Request to create <strong>{r.requested_name}</strong> is pending review.
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => {
              onClose();
              router.push('/clubs');
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', fontSize: 13, fontWeight: 700 }}
          >
            <Plus size={16} /> Create or Join a Club
          </button>

          <button
            onClick={handleGuestMode}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', fontSize: 13 }}
          >
            <Users size={16} /> Switch to Guest / Quick Play Mode
          </button>
        </div>
      </div>
    </div>
  );
}
