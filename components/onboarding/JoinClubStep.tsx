'use client';

import { useState } from 'react';
import { joinClubByCode, searchClubsByName, requestToJoinClub, type ClubRow } from '@/lib/clubs';

interface JoinClubStepProps {
  onJoined: (clubId: string) => void;
  onRequestSent: () => void;
}

export default function JoinClubStep({ onJoined, onRequestSent }: JoinClubStepProps) {
  const [code, setCode] = useState('');
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClubRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [requestedClubName, setRequestedClubName] = useState<string | null>(null);

  async function handleJoinByCode() {
    if (!code.trim()) return;
    setCodeSubmitting(true);
    setCodeError(null);
    try {
      const club = await joinClubByCode(code);
      onJoined(club.id);
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : 'Failed to join.');
      setCodeSubmitting(false);
    }
  }

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await searchClubsByName(value));
    } finally {
      setSearching(false);
    }
  }

  async function handleRequest(club: ClubRow) {
    await requestToJoinClub(club.id);
    setRequestedClubName(club.name);
  }

  if (requestedClubName) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2>Request sent to {requestedClubName}</h2>
        <p style={{ color: 'var(--muted)' }}>We&apos;ll let you in once the admin approves you.</p>
        <button className="btn-primary" onClick={onRequestSent}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Have a join code?</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. ABC123"
          aria-label="Join code"
          style={{ flex: 1, minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8, textTransform: 'uppercase' }}
        />
        <button className="btn-primary" onClick={handleJoinByCode} disabled={codeSubmitting || !code.trim()} style={{ minHeight: 44, padding: '0 16px' }}>
          {codeSubmitting ? 'Joining…' : 'Join'}
        </button>
      </div>
      {codeError && <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{codeError}</p>}

      <h2>Or find a club by name</h2>
      <input
        value={query}
        onChange={e => handleSearch(e.target.value)}
        placeholder="Search club name…"
        aria-label="Search clubs"
        style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
      />
      {searching && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Searching…</p>}
      {results.map(c => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, fontWeight: 700 }}>{c.name}</span>
          <button className="btn-secondary" style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }} onClick={() => handleRequest(c)}>
            Request to Join
          </button>
        </div>
      ))}
    </div>
  );
}
