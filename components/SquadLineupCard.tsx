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

  // Updated theme colors dynamically: Mavericks (Blue) and Hotshots (Red)
  const isMavericksVsHotshots = goldLabel.toLowerCase().includes('mavericks') || blackLabel.toLowerCase().includes('mavericks');
  const goldThemeColor = isMavericksVsHotshots ? '#2563eb' : '#d4af37';
  const blackThemeColor = isMavericksVsHotshots ? '#dc2626' : '#1a1a1a';

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: -0.2 }}>Tournament Roster</h2>
        <button className="btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }} aria-label="Share squad lineup on WhatsApp" onClick={handleShare} disabled={sharing}>
          <Share2 size={14} />
          <span>Share Roster</span>
        </button>
      </div>
      {shareError && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{shareError}</p>}
      <div ref={captureRef} style={{ background: 'var(--card-bg, #ffffff)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <SquadColumn label={goldLabel} players={goldPlayers} color={goldThemeColor} />
          <SquadColumn label={blackLabel} players={blackPlayers} color={blackThemeColor} />
        </div>
      </div>
    </div>
  );
}

function SquadColumn({ label, players, color }: { label: string; players: string[]; color: string }) {
  const sortedPlayers = [...players].sort((a, b) => a.localeCompare(b));
  return (
    <div style={{ background: 'var(--surface-1, #f8fafc)', borderRadius: 10, padding: 12, border: '1px solid rgba(0, 0, 0, 0.05)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingBottom: 10,
          marginBottom: 12,
          borderBottom: `2px solid ${color}`,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: color,
          }}
        />
        <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sortedPlayers.map(name => {
          // Find subteam groups
          const subteamGroups = [
            { name: 'Blue Storm', players: ['Hemal', 'Karan', 'Nimish', 'Saurabh'] },
            { name: 'Red Strikers', players: ['Gopal', 'Miten', 'Hitesh', 'Shrawani'] },
            { name: 'Green Force', players: ['Tushar', 'Hiten', 'Amit', 'Ketan'] },
            { name: 'Blue Blazers', players: ['Sumiit', 'Viki', 'Nadeem', 'Sid G'] },
            { name: 'Red Firestorm', players: ['Deep', 'Priyesh', 'Amreesh', 'Anosh'] },
            { name: 'Green Hurricanes', players: ['Shanawaz', 'Arif', 'Ansh', 'Gulshan'] }
          ];
          const matchedGroup = subteamGroups.find(g => g.players.some(p => p.toLowerCase() === name.toLowerCase()));
          const subteamName = matchedGroup ? matchedGroup.name.split(' ')[1] || matchedGroup.name : 'PL';
          
          return (
            <div 
              key={name} 
              style={{ 
                fontSize: 13, 
                fontWeight: 600,
                color: 'var(--foreground)', 
                padding: '6px 10px', 
                background: 'var(--card-bg, #ffffff)', 
                borderRadius: 6,
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                borderLeft: `3px solid ${color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>{name}</span>
              <span style={{ fontSize: 9, opacity: 0.7, textTransform: 'uppercase', fontWeight: 800, color, background: `${color}15`, padding: '2px 6px', borderRadius: 4 }}>
                {subteamName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
