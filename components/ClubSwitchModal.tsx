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
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 20,
          padding: 24,
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          color: '#0f172a',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={20} style={{ color: '#2563eb' }} /> Select Active Club
          </h3>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Active Club Banner */}
        {currentClub ? (
          <div
            style={{
              background: '#f0f9ff',
              border: '1.5px solid #bae6fd',
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {currentClub.logo_url ? (
                <img src={currentClub.logo_url} alt="" width={42} height={42} style={{ borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
              ) : (
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>
                  {currentClub.name[0]}
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#0284c7', fontWeight: 800, letterSpacing: 0.5 }}>Currently Active</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{currentClub.name}</div>
              </div>
            </div>
            {isCurrentClubAdmin && (
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#047857', background: '#d1fae5', padding: '4px 10px', borderRadius: 6 }}>
                Admin
              </span>
            )}
          </div>
        ) : (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '12px 16px', marginBottom: 18, fontSize: 13, color: '#475569' }}>
            Playing in <strong style={{ color: '#0f172a' }}>Guest / Quick Play Mode</strong> (stats isolated from club rankings).
          </div>
        )}

        {/* Joined Clubs List */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 800, letterSpacing: 0.5, marginBottom: 10 }}>
            My Joined Clubs ({clubs.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
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
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: isSelected ? '#eff6ff' : '#f8fafc',
                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    color: '#0f172a',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: isSelected ? '#2563eb' : '#cbd5e1', color: isSelected ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>
                      {m.club.name[0]}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{m.club.name}</span>
                  </div>
                  {isSelected && <Check size={18} style={{ color: '#2563eb', strokeWidth: 3 }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pending Requests */}
        {(pendingJoin.length > 0 || pendingCreation.length > 0) && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bell size={14} /> Pending Approval
            </div>
            {pendingJoin.map(r => (
              <div key={r.id} style={{ fontSize: 13, color: '#78350f' }}>
                • Request to join <strong>{r.club.name}</strong> is pending admin review.
              </div>
            ))}
            {pendingCreation.map(r => (
              <div key={r.id} style={{ fontSize: 13, color: '#78350f' }}>
                • Request to create <strong>{r.requested_name}</strong> is pending review.
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => {
              onClose();
              router.push('/clubs');
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', fontSize: 14, fontWeight: 800, background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}
          >
            <Plus size={18} /> Create or Join a Club
          </button>

          <button
            onClick={handleGuestMode}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', fontSize: 14, fontWeight: 700, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 12, cursor: 'pointer' }}
          >
            <Users size={18} /> Switch to Guest / Quick Play Mode
          </button>
        </div>
      </div>
    </div>
  );
}
