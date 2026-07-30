'use client';

import { useState } from 'react';
import { joinClubByCode, searchClubsByName, type ClubRow } from '@/lib/clubs';
import GoogleSignInButton from '@/components/GoogleSignInButton';

interface JoinClubStepProps {
  onJoined: (clubId: string) => void;
  // Fires when the user picks "Request to Join" — the request itself isn't
  // submitted here. The parent wizard collects a profile first (a pending
  // requester isn't a club member yet, so there's no players row to attach
  // one to), then submits the request with the profile attached.
  onRequestStart?: (club: ClubRow) => void;
}

export default function JoinClubStep({ onJoined, onRequestStart }: JoinClubStepProps) {
  const [code, setCode] = useState('');
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClubRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

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

  function handleRequest(club: ClubRow) {
    setRequestedIds(prev => new Set(prev).add(club.id));
    onRequestStart?.(club);
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
      {codeError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ color: 'var(--danger)', fontWeight: 600, margin: 0 }}>{codeError}</p>
          {(codeError.includes('Guest') || codeError.includes('Google')) && (
            <GoogleSignInButton label="Sign in with Google to Join Instantly" />
          )}
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>A code joins instantly — no approval needed. Get it from your club&apos;s admin.</p>

      <h2>Or find a club by name</h2>
      <input
        value={query}
        onChange={e => handleSearch(e.target.value)}
        placeholder="Search club name…"
        aria-label="Search clubs"
        style={{ width: '100%', minHeight: 44, padding: '10px 12px', fontSize: 16, border: '1px solid var(--border)', borderRadius: 8 }}
      />
      {searching && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Searching…</p>}
      {results.length > 1 && new Set(results.map(c => c.name)).size < results.length && (
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
          More than one club shares a name below — check who created it if you're not sure which is yours.
        </p>
      )}
      {results.map(c => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {c.logo_url ? (
            <img src={c.logo_url} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{c.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Created {new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </div>
          </div>
          <button
            className="btn-secondary"
            style={{ minHeight: 32, padding: '4px 12px', fontSize: 13 }}
            disabled={requestedIds.has(c.id)}
            onClick={() => handleRequest(c)}
          >
            {requestedIds.has(c.id) ? 'Requested ✓' : 'Request to Join'}
          </button>
        </div>
      ))}
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>
        Requesting to join needs the club&apos;s admin to approve you first — you&apos;ll get access once they do.
      </p>
    </div>
  );
}
