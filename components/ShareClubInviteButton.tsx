'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

interface ShareClubInviteButtonProps {
  clubName: string;
  joinCode: string;
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
}

export default function ShareClubInviteButton({
  clubName,
  joinCode,
  variant = 'secondary',
  fullWidth = false,
}: ShareClubInviteButtonProps) {
  const [copied, setCopied] = useState(false);

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/clubs/join?code=${joinCode.toUpperCase()}`
    : `https://pickleball-app-two.vercel.app/clubs/join?code=${joinCode.toUpperCase()}`;

  const shareText = `🎾 Join ${clubName} on Réstorée Pickleball! Tap here to join instantly: ${inviteUrl}`;

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // 1. Copy link to clipboard first so it's always ready
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 3500);
      }
    } catch {
      // Ignore clipboard fallback
    }

    // 2. Try native mobile share if available and supported
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Join ${clubName}`,
          text: shareText,
          url: inviteUrl,
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fallback to WhatsApp web link below
      }
    }

    // 3. Desktop / Mobile Web WhatsApp fallback
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <button
      type="button"
      className={variant === 'primary' ? 'btn-primary' : 'btn-secondary'}
      onClick={handleShare}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: fullWidth ? '100%' : 'auto',
        minHeight: 44,
        padding: '8px 16px',
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {copied ? <Check size={18} /> : <Share2 size={18} />}
      <span>{copied ? 'Link Copied! Opening WhatsApp…' : 'Share Invite on WhatsApp'}</span>
    </button>
  );
}
