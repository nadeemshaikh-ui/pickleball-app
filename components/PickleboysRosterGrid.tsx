'use client';

import React from 'react';
import { Star, ShieldCheck, Users, Trophy } from 'lucide-react';

export interface TeamRosterItem {
  id: string;
  name: string;
  captain: string;
  group: 'A' | 'B';
  roster: string[];
}

export const OFFICIAL_PICKLEBOYS_TEAMS: TeamRosterItem[] = [
  // Group A
  { id: 'A1', name: "Rao's Paltan", captain: 'Tarang', group: 'A', roster: ['Tarang (Captain)', 'Aum (Pool 1)', 'Devang (Pool 1)', 'Pooja (Pool G)', 'veer (Pool 2)', 'Saurabh Rathi (Pool 2)'] },
  { id: 'A2', name: 'Dabang Dinkers', captain: 'Rohan D.', group: 'A', roster: ['Rohan D. (Captain)', 'Nirbhay (Pool 1)', 'Justin (Pool 1)', 'Romi (Pool G)', 'Sarthak L (Pool 2)', 'Kunal Demba (Pool 2)'] },
  { id: 'A3', name: 'Munchilicious', captain: 'Himanshu', group: 'A', roster: ['Himanshu (Captain)', 'Ravi (Pool 1)', 'Alok (Pool 1)', 'Divya (Pool G)', 'Gulshan (Pool 2)', 'Aditya Desai (Pool 2)'] },
  { id: 'A4', name: 'Pickleboys', captain: 'Arsh', group: 'A', roster: ['Arsh (Captain)', 'Ishaan (Pool 1)', 'Azim (Pool 1)', 'Karishma (Pool G)', 'Ayush (Pool 2)', 'Harshil (Pool 2)'] },
  // Group B
  { id: 'B1', name: 'The Dink Floyd', captain: 'Amit Sir', group: 'B', roster: ['Amit Sir (Captain)', 'Rewanth (Pool 1)', 'Deepak G (Pool 1)', 'Shivangi (Pool G)', 'Rushabh (Pool 2)', 'Kunal shah (Pool 2)'] },
  { id: 'B2', name: 'Airavat', captain: 'Udipt', group: 'B', roster: ['Udipt (Captain)', 'Shivam Singh (Pool 1)', 'Aman (Pool 1)', 'Erin (Pool G)', 'Narry (Pool 2)', 'Rahul W (Pool 2)'] },
  { id: 'B3', name: 'Pickleboss', captain: 'Rajesh M.', group: 'B', roster: ['Rajesh M. (Captain)', 'Karan S (Pool 1)', 'Amresh (Pool 1)', 'Anjali (Pool G)', 'Faisal Khan (Pool 2)', 'Keyur (Pool 2)'] },
  { id: 'B4', name: "Leo's SIX", captain: 'Aakash', group: 'B', roster: ['Aakash (Captain)', 'Dev (Pool 1)', 'Nadeem (Pool 1)', 'Kavita (Pool G)', 'Hitesh bhai (Pool 2)', 'Kaustubh (Pool 2)'] },
];

export default function PickleboysRosterGrid() {
  const groupA = OFFICIAL_PICKLEBOYS_TEAMS.filter(t => t.group === 'A');
  const groupB = OFFICIAL_PICKLEBOYS_TEAMS.filter(t => t.group === 'B');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Spacious Main Title Card */}
      <div className="card" style={{ padding: 24, border: '4px solid var(--border)', boxShadow: '6px 6px 0 var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Pickleboys Official Sunday Championship
        </div>
        <h2 style={{ margin: '6px 0 0 0', display: 'flex', alignItems: 'center', gap: 10, fontSize: 28, fontWeight: 900 }}>
          <Users size={30} style={{ color: 'var(--primary)' }} /> 8 Teams & Player Formations
        </h2>
        <p style={{ margin: '6px 0 0 0', fontSize: 16, color: 'var(--muted)', lineHeight: 1.6, fontWeight: 600 }}>
          48 Total Players · 6 Squad Members per Team (1 Captain, 2 Pool 1, 1 Pool G, 2 Pool 2)
        </p>
      </div>

      {/* GROUP A DIRECTORY */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Trophy size={24} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: 24, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.03em', margin: 0 }}>
            Group A Squad Directory
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {groupA.map(t => (
            <div key={t.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: 24, border: '3px solid var(--border)', boxShadow: '6px 6px 0 var(--border)' }}>
              {/* Team Title Banner */}
              <div style={{ borderBottom: '3px solid var(--border)', paddingBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, background: 'var(--dark)', color: '#ffffff', padding: '6px 12px', borderRadius: 2 }}>
                    SEED {t.id}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--foreground)', border: '2px solid var(--border)', padding: '6px 12px', borderRadius: 2, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={18} /> Capt. {t.captain}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--foreground)' }}>{t.name}</h3>
              </div>

              {/* 6 Players Roster List */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.04em' }}>
                  Team Formation (6 Players)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {t.roster.map((player, idx) => {
                    const isCaptain = idx === 0;
                    return (
                      <div
                        key={player}
                        style={{
                          fontSize: 16,
                          fontWeight: isCaptain ? 900 : 700,
                          color: isCaptain ? 'var(--primary)' : 'var(--foreground)',
                          background: isCaptain ? '#fef3c7' : '#ffffff',
                          border: '2px solid var(--border)',
                          padding: '12px 16px',
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: '2px 2px 0 var(--border)'
                        }}
                      >
                        <span>{player}</span>
                        {isCaptain && <Star size={18} style={{ color: '#b45309', fill: '#b45309' }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GROUP B DIRECTORY */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Trophy size={24} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: 24, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.03em', margin: 0 }}>
            Group B Squad Directory
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {groupB.map(t => (
            <div key={t.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: 24, border: '3px solid var(--border)', boxShadow: '6px 6px 0 var(--border)' }}>
              {/* Team Title Banner */}
              <div style={{ borderBottom: '3px solid var(--border)', paddingBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, background: 'var(--dark)', color: '#ffffff', padding: '6px 12px', borderRadius: 2 }}>
                    SEED {t.id}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--foreground)', border: '2px solid var(--border)', padding: '6px 12px', borderRadius: 2, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={18} /> Capt. {t.captain}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--foreground)' }}>{t.name}</h3>
              </div>

              {/* 6 Players Roster List */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.04em' }}>
                  Team Formation (6 Players)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {t.roster.map((player, idx) => {
                    const isCaptain = idx === 0;
                    return (
                      <div
                        key={player}
                        style={{
                          fontSize: 16,
                          fontWeight: isCaptain ? 900 : 700,
                          color: isCaptain ? 'var(--primary)' : 'var(--foreground)',
                          background: isCaptain ? '#fef3c7' : '#ffffff',
                          border: '2px solid var(--border)',
                          padding: '12px 16px',
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: '2px 2px 0 var(--border)'
                        }}
                      >
                        <span>{player}</span>
                        {isCaptain && <Star size={16} style={{ color: '#b45309', fill: '#b45309' }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
