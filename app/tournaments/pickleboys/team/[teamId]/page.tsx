'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ShieldCheck, Trophy, Users, Lock, CheckCircle2, ArrowLeft, Share2, Calendar, Key, AlertTriangle } from 'lucide-react';
import { OFFICIAL_PICKLEBOYS_TEAMS } from '@/components/PickleboysRosterGrid';
import PickleboysSingleTeamLineupSelector from '@/components/PickleboysSingleTeamLineupSelector';

// OFFICIAL 4-DIGIT PASSCODES PER TEAM
const TEAM_PASSCODES: Record<string, string> = {
  A1: '1001',
  A2: '1002',
  A3: '1003',
  A4: '1004',
  B1: '2001',
  B2: '2002',
  B3: '2003',
  B4: '2004',
  MASTER: '9999'
};

// ALL 16 MATCHES
const ALL_16_MATCHES = [
  { id: 'm1', round: 1, court: 1, teamA: OFFICIAL_PICKLEBOYS_TEAMS[0], teamB: OFFICIAL_PICKLEBOYS_TEAMS[1] },
  { id: 'm2', round: 1, court: 2, teamA: OFFICIAL_PICKLEBOYS_TEAMS[2], teamB: OFFICIAL_PICKLEBOYS_TEAMS[3] },
  { id: 'm3', round: 1, court: 3, teamA: OFFICIAL_PICKLEBOYS_TEAMS[4], teamB: OFFICIAL_PICKLEBOYS_TEAMS[5] },
  { id: 'm4', round: 1, court: 4, teamA: OFFICIAL_PICKLEBOYS_TEAMS[6], teamB: OFFICIAL_PICKLEBOYS_TEAMS[7] },

  { id: 'm5', round: 2, court: 1, teamA: OFFICIAL_PICKLEBOYS_TEAMS[0], teamB: OFFICIAL_PICKLEBOYS_TEAMS[2] },
  { id: 'm6', round: 2, court: 2, teamA: OFFICIAL_PICKLEBOYS_TEAMS[1], teamB: OFFICIAL_PICKLEBOYS_TEAMS[3] },
  { id: 'm7', round: 2, court: 3, teamA: OFFICIAL_PICKLEBOYS_TEAMS[4], teamB: OFFICIAL_PICKLEBOYS_TEAMS[6] },
  { id: 'm8', round: 2, court: 4, teamA: OFFICIAL_PICKLEBOYS_TEAMS[5], teamB: OFFICIAL_PICKLEBOYS_TEAMS[7] },

  { id: 'm9', round: 3, court: 1, teamA: OFFICIAL_PICKLEBOYS_TEAMS[0], teamB: OFFICIAL_PICKLEBOYS_TEAMS[3] },
  { id: 'm10', round: 3, court: 2, teamA: OFFICIAL_PICKLEBOYS_TEAMS[1], teamB: OFFICIAL_PICKLEBOYS_TEAMS[2] },
  { id: 'm11', round: 3, court: 3, teamA: OFFICIAL_PICKLEBOYS_TEAMS[4], teamB: OFFICIAL_PICKLEBOYS_TEAMS[7] },
  { id: 'm12', round: 3, court: 4, teamA: OFFICIAL_PICKLEBOYS_TEAMS[5], teamB: OFFICIAL_PICKLEBOYS_TEAMS[6] },

  { id: 'm13', round: 4, court: 1, teamA: OFFICIAL_PICKLEBOYS_TEAMS[0], teamB: OFFICIAL_PICKLEBOYS_TEAMS[4] },
  { id: 'm14', round: 4, court: 2, teamA: OFFICIAL_PICKLEBOYS_TEAMS[1], teamB: OFFICIAL_PICKLEBOYS_TEAMS[5] },
  { id: 'm15', round: 4, court: 3, teamA: OFFICIAL_PICKLEBOYS_TEAMS[2], teamB: OFFICIAL_PICKLEBOYS_TEAMS[6] },
  { id: 'm16', round: 4, court: 4, teamA: OFFICIAL_PICKLEBOYS_TEAMS[3], teamB: OFFICIAL_PICKLEBOYS_TEAMS[7] },
];

export default function PickleboysTeamPortalPage() {
  const params = useParams();
  const rawTeamId = (params?.teamId as string) || 'A1';
  const teamId = rawTeamId.toUpperCase();

  const team = OFFICIAL_PICKLEBOYS_TEAMS.find(t => t.id === teamId) || OFFICIAL_PICKLEBOYS_TEAMS[0];
  const teamMatches = ALL_16_MATCHES.filter(m => m.teamA.id === team.id || m.teamB.id === team.id);

  const [savedLineups, setSavedLineups] = useState<Record<string, any>>({});
  const [activeMatchForLineup, setActiveMatchForLineup] = useState<typeof ALL_16_MATCHES[0] | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // TEAM PASSCODE LOCK STATE
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const expectedPin = TEAM_PASSCODES[team.id] || '1001';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const unlockedStorage = localStorage.getItem(`pickleboys_unlocked_team_${team.id}`);
      if (unlockedStorage === 'true') {
        setIsUnlocked(true);
      }

      const cached = localStorage.getItem('pickleboys_saved_lineups');
      if (cached) {
        try {
          setSavedLineups(JSON.parse(cached));
        } catch (e) {}
      }
    }
  }, [team.id]);

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (enteredPin.trim() === expectedPin || enteredPin.trim() === TEAM_PASSCODES.MASTER) {
      setIsUnlocked(true);
      setPinError(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`pickleboys_unlocked_team_${team.id}`, 'true');
      }
    } else {
      setPinError(true);
    }
  }

  function handleSaveSingleTeamLineup(matchId: string, teamLineup: any) {
    setSavedLineups(prev => {
      const existingMatchLineup = prev[matchId] || { line1: { teamA: [], teamB: [] }, line2: { teamA: [], teamB: [] }, line3: { teamA: [], teamB: [] }, line4: { teamA: [], teamB: [] } };

      const isTeamA = activeMatchForLineup?.teamA.id === team.id;
      const updatedMatchLineup = {
        line1: { teamA: isTeamA ? teamLineup.line1 : existingMatchLineup.line1.teamA, teamB: !isTeamA ? teamLineup.line1 : existingMatchLineup.line1.teamB },
        line2: { teamA: isTeamA ? teamLineup.line2 : existingMatchLineup.line2.teamA, teamB: !isTeamA ? teamLineup.line2 : existingMatchLineup.line2.teamB },
        line3: { teamA: isTeamA ? teamLineup.line3 : existingMatchLineup.line3.teamA, teamB: !isTeamA ? teamLineup.line3 : existingMatchLineup.line3.teamB },
        line4: { teamA: isTeamA ? teamLineup.line4 : existingMatchLineup.line4.teamA, teamB: !isTeamA ? teamLineup.line4 : existingMatchLineup.line4.teamB },
      };

      const updatedAll = { ...prev, [matchId]: updatedMatchLineup };
      if (typeof window !== 'undefined') {
        localStorage.setItem('pickleboys_saved_lineups', JSON.stringify(updatedAll));
      }
      return updatedAll;
    });
    setActiveMatchForLineup(null);
  }

  function handleShareTeamHub() {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  }

  // PASSCODE LOCK CHALLENGE SCREEN
  if (!isUnlocked) {
    return (
      <main className="page" style={{ paddingBottom: 120 }}>
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/tournaments/pickleboys"
            className="btn-secondary"
            style={{
              fontSize: 15,
              fontWeight: 900,
              padding: '10px 18px',
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '2px solid var(--border)',
              background: '#ffffff',
              color: 'var(--foreground)',
              boxShadow: '2px 2px 0 var(--border)',
              textDecoration: 'none'
            }}
          >
            <ArrowLeft size={18} /> ← Back to Tournament Hub
          </Link>
        </div>

        <div className="card" style={{ maxWidth: 450, margin: '40px auto', padding: 24, textAlign: 'center', background: '#ffffff', border: '3px solid var(--dark)', boxShadow: '6px 6px 0 var(--border)' }}>
          <div style={{ background: 'var(--dark)', width: 54, height: 54, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto', color: 'var(--gold)' }}>
            <Key size={28} />
          </div>

          <span style={{ background: 'var(--dark)', color: '#ffffff', padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 900 }}>
            TEAM PORTAL · {team.id}
          </span>
          <h2 style={{ fontSize: 24, fontWeight: 900, margin: '8px 0 4px 0' }}>
            {team.name} Passcode
          </h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginBottom: 16 }}>
            Enter your 4-digit Team Passcode to access roster & lineup manager. (Passcode: <strong>{expectedPin}</strong>)
          </p>

          <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              maxLength={4}
              value={enteredPin}
              onChange={e => setEnteredPin(e.target.value)}
              placeholder="Enter 4-Digit Passcode"
              style={{ padding: '12px', fontSize: 20, textAlign: 'center', fontWeight: 900, letterSpacing: '0.2em', border: '2px solid var(--border)', borderRadius: 4, background: '#f8fafc' }}
            />

            {pinError && (
              <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 800 }}>
                ❌ Incorrect Passcode. (Team {team.id} Passcode is {expectedPin})
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ minHeight: 48, fontSize: 15, fontWeight: 900 }}>
              🔓 Unlock Team Portal Access
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="page" style={{ paddingBottom: 120 }}>
      {/* Header Bar */}
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/tournaments/pickleboys"
          className="btn-secondary"
          style={{
            fontSize: 15,
            fontWeight: 900,
            padding: '10px 18px',
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            border: '2px solid var(--border)',
            background: '#ffffff',
            color: 'var(--foreground)',
            boxShadow: '2px 2px 0 var(--border)',
            textDecoration: 'none'
          }}
        >
          <ArrowLeft size={18} /> ← Back to Tournament Hub
        </Link>
      </div>

      {/* TEAM HERO BANNER */}
      <div className="card" style={{ padding: 22, background: '#ffffff', borderLeft: '6px solid var(--gold)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ background: 'var(--dark)', color: '#ffffff', padding: '3px 10px', borderRadius: 2, fontSize: 12, fontWeight: 900 }}>
              UNLOCKED TEAM PORTAL · POOL {team.group} ({team.id})
            </span>
            <h1 style={{ margin: '8px 0 4px 0', fontSize: 32, fontWeight: 900 }}>
              {team.name}
            </h1>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--muted)' }}>
              Captain: <strong>{team.captain}</strong> · 6 Squad Members · Passcode: <strong>{expectedPin}</strong>
            </div>
          </div>

          <button
            onClick={handleShareTeamHub}
            className="btn-primary"
            style={{ fontSize: 13, padding: '10px 16px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Share2 size={16} /> {copiedLink ? '✓ Team Portal Link Copied!' : 'Share WhatsApp Team Hub Link'}
          </button>
        </div>
      </div>

      {/* SQUAD ROSTER DIRECTORY */}
      <div className="card" style={{ padding: 20, marginBottom: 24, background: '#ffffff' }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: 20, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={22} style={{ color: 'var(--primary)' }} /> Squad Roster & Pool Allocations
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {team.roster.map((player, idx) => {
            const tagNum = idx === 0 ? '1' : idx === 1 ? '2' : idx === 2 ? '3' : idx === 3 ? 'G' : idx === 4 ? '5' : '6';
            const poolTag = `[${team.id}${tagNum}]`;

            return (
              <div key={idx} style={{ background: '#f8fafc', padding: '10px 12px', border: '2px solid var(--border)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 900, fontSize: 14, color: 'var(--foreground)' }}>
                  {player}
                </span>
                <span style={{ background: 'var(--dark)', color: '#ffffff', padding: '2px 6px', borderRadius: 2, fontSize: 11, fontWeight: 900 }}>
                  {poolTag}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* TEAM MATCHES & SINGLE TEAM BLIND LINEUP SELECTOR */}
      {!activeMatchForLineup ? (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={24} style={{ color: 'var(--primary)' }} /> {team.name} Match Schedule (4 Matches)
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {teamMatches.map(m => {
              const isTeamA = m.teamA.id === team.id;
              const opponent = isTeamA ? m.teamB : m.teamA;
              const matchLineup = savedLineups[m.id];
              const mySide = isTeamA ? matchLineup?.line1?.teamA : matchLineup?.line1?.teamB;
              const myLineupSaved = Array.isArray(mySide) && mySide.length > 0;

              return (
                <div key={m.id} className="card" style={{ padding: 20, background: '#ffffff', border: '3px solid var(--border)', boxShadow: '4px 4px 0 var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase' }}>
                      MATCH #{m.id.replace('m', '')} · ROUND {m.round} · COURT {m.court}
                    </span>

                    {myLineupSaved ? (
                      <span style={{ background: '#dcfce7', color: '#166534', border: '1px solid #166534', padding: '4px 10px', borderRadius: 2, fontSize: 12, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Lock size={14} /> {team.name} Lineup Locked
                      </span>
                    ) : (
                      <span style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #b45309', padding: '4px 10px', borderRadius: 2, fontSize: 12, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={14} /> Lineup Needed from Capt. {team.captain}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 20, fontWeight: 900, margin: '8px 0' }}>
                    {team.name} <span style={{ color: 'var(--muted)', fontSize: 16 }}>vs</span> {opponent.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
                    Opponent Captain: <strong>{opponent.captain}</strong> (Pool {opponent.group})
                  </div>

                  {/* Blind Double-Reveal Status Box */}
                  <div style={{ background: '#f8fafc', padding: 12, border: '2px solid var(--border)', borderRadius: 2, marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: 'var(--muted)' }}>
                      Double-Reveal Counter-Stacking Guard
                    </div>
                    {myLineupSaved ? (
                      <div style={{ fontSize: 13, color: '#b45309', fontWeight: 800, marginTop: 4 }}>
                        🔒 Your secret lineup is locked & hidden. It will be revealed once Captain {opponent.captain} ({opponent.name}) submits their lineup!
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, marginTop: 4 }}>
                        Set your line 1-4 players below for <strong>{team.name} ONLY</strong>.
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setActiveMatchForLineup(m)}
                    className="btn-primary"
                    style={{ width: '100%', marginTop: 16, fontSize: 15, minHeight: 46, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Lock size={18} /> {myLineupSaved ? `✏️ Edit ${team.name} Secret Lineup` : `🔒 Set & Submit ${team.name} Secret Lineup →`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* SINGLE TEAM DYNAMIC LINEUP PICKER CONSOLE */
        <div>
          <button onClick={() => setActiveMatchForLineup(null)} className="btn-secondary" style={{ marginBottom: 14, fontSize: 14, fontWeight: 800 }}>
            ← Back to Team Matches
          </button>

          <PickleboysSingleTeamLineupSelector
            teamId={team.id}
            teamName={team.name}
            captain={team.captain}
            roster={team.roster}
            opponentName={activeMatchForLineup.teamA.id === team.id ? activeMatchForLineup.teamB.name : activeMatchForLineup.teamA.name}
            opponentCaptain={activeMatchForLineup.teamA.id === team.id ? activeMatchForLineup.teamB.captain : activeMatchForLineup.teamA.captain}
            matchId={activeMatchForLineup.id}
            existingLineup={
              savedLineups[activeMatchForLineup.id]
                ? {
                    line1: activeMatchForLineup.teamA.id === team.id ? savedLineups[activeMatchForLineup.id].line1.teamA : savedLineups[activeMatchForLineup.id].line1.teamB,
                    line2: activeMatchForLineup.teamA.id === team.id ? savedLineups[activeMatchForLineup.id].line2.teamA : savedLineups[activeMatchForLineup.id].line2.teamB,
                    line3: activeMatchForLineup.teamA.id === team.id ? savedLineups[activeMatchForLineup.id].line3.teamA : savedLineups[activeMatchForLineup.id].line3.teamB,
                    line4: activeMatchForLineup.teamA.id === team.id ? savedLineups[activeMatchForLineup.id].line4.teamA : savedLineups[activeMatchForLineup.id].line4.teamB,
                  }
                : undefined
            }
            onSaveLineup={singleLineup => handleSaveSingleTeamLineup(activeMatchForLineup.id, singleLineup)}
          />
        </div>
      )}
    </main>
  );
}
