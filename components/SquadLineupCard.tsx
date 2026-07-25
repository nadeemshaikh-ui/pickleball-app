'use client';

import { useEffect, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { renderElementToImage, shareCachedImage } from '@/lib/shareImage';

interface SquadLineupCardProps {
  goldLabel: string;
  blackLabel: string;
  goldLogoUrl: string | null;
  blackLogoUrl: string | null;
  goldPlayers: string[];
  blackPlayers: string[];
  filename: string;
}

// The actual ask, after three misses: not a score hero, not the assignment
// picker — a straight left/right roster reveal (who's on which squad
// tonight), shown before the round schedule, with its own share button so
// it can go straight to WhatsApp as its own image.
export default function SquadLineupCard({ goldLabel, blackLabel, goldLogoUrl, blackLogoUrl, goldPlayers, blackPlayers, filename }: SquadLineupCardProps) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Pre-render ahead of the click so the share stays inside the browser's
  // user-gesture window (see lib/shareImage.ts) — rendering inside the
  // click handler can silently break navigator.share() on mobile.
  useEffect(() => {
    if (!captureRef.current) {
      setImageFile(null);
      return;
    }
    renderElementToImage(captureRef.current, filename)
      .then(file => {
        setImageFile(file);
        setShareError(null);
      })
      .catch(e => {
        setImageFile(null);
        setShareError(e instanceof Error ? `Couldn't prepare the image: ${e.message}` : "Couldn't prepare the image.");
      });
  }, [filename, goldLabel, blackLabel, goldLogoUrl, blackLogoUrl, goldPlayers, blackPlayers]);

  async function handleShare() {
    setSharing(true);
    setShareError(null);
    try {
      const file = imageFile ?? (captureRef.current ? await renderElementToImage(captureRef.current, filename) : null);
      if (!file) {
        setShareError("Couldn't prepare the image — try again.");
        return;
      }
      const result = await shareCachedImage(file);
      if (result === 'downloaded') {
        setShareError("Image downloaded — attach it to WhatsApp manually (direct share isn't supported on this browser).");
      }
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'Failed to share image.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Squad Lineup</h2>
        <button className="icon-btn" aria-label="Share squad lineup on WhatsApp" onClick={handleShare} disabled={sharing}>
          <Share2 size={16} />
        </button>
      </div>
      {shareError && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{shareError}</p>}
      <div ref={captureRef} style={{ background: 'white', padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <SquadColumn label={goldLabel} logoUrl={goldLogoUrl} players={goldPlayers} color="#d4af37" />
          <SquadColumn label={blackLabel} logoUrl={blackLogoUrl} players={blackPlayers} color="#1a1a1a" />
        </div>
      </div>
    </div>
  );
}

function SquadColumn({ label, logoUrl, players, color }: { label: string; logoUrl: string | null; players: string[]; color: string }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          paddingBottom: 8,
          marginBottom: 8,
          borderBottom: `3px solid ${color}`,
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            width={72}
            height={72}
            crossOrigin="anonymous"
            style={{ borderRadius: '50%', objectFit: 'cover', border: `2px solid ${color}` }}
          />
        ) : (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 24,
            }}
          >
            {label.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ fontWeight: 800, fontSize: 14, textAlign: 'center' }}>{label}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {players.map(name => (
          <div key={name} style={{ fontSize: 13, textAlign: 'center', padding: '3px 0' }}>
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}
