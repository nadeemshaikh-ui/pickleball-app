'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getSession, type SessionRow } from '@/lib/db';
import { renderElementToImage, shareCachedImage } from '@/lib/shareImage';
import SessionNav from '@/components/SessionNav';
import SessionDate from '@/components/SessionDate';
import GroupHeader from '@/components/GroupHeader';
import { WhatsAppIcon } from '@/components/icons';

export default function StorylinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [storylineImageFile, setStorylineImageFile] = useState<File | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSession(id).then(setSession);
  }, [id]);

  // Pre-render the storyline image as soon as the session data exists, well
  // before the user clicks share — see lib/shareImage.ts: rendering inside
  // the click handler burns the browser's user-gesture window on some
  // mobile browsers, so navigator.share() gets silently rejected even
  // though canShare() said yes. Same fix as the team-championship stage page.
  useEffect(() => {
    if (!session || !captureRef.current) {
      setStorylineImageFile(null);
      return;
    }
    renderElementToImage(captureRef.current, `storyline-${id}.png`)
      .then(file => {
        setStorylineImageFile(file);
        setShareError(null);
      })
      .catch(e => {
        setStorylineImageFile(null);
        setShareError(e instanceof Error ? `Couldn't prepare the image: ${e.message}` : "Couldn't prepare the image.");
      });
  }, [session, id]);

  async function handleShare() {
    setShareError(null);
    setSharing(true);
    try {
      const file = storylineImageFile ?? (captureRef.current ? await renderElementToImage(captureRef.current, `storyline-${id}.png`) : null);
      if (!file) {
        setShareError("Couldn't prepare the image — try again.");
        return;
      }
      const result = await shareCachedImage(file);
      if (result === 'downloaded') {
        setShareError('Image downloaded — attach it to WhatsApp manually (direct share isn\'t supported on this browser).');
      }
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'Failed to share image.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <main className="page">
        <div className="page-header-row">
          <Link href={`/session/${id}/schedule`} className="text-link-btn">← Schedule</Link>
          <button className="icon-btn" aria-label="Share storyline image on WhatsApp" onClick={handleShare} disabled={sharing}>
            <WhatsAppIcon size={24} />
          </button>
        </div>
        {shareError && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14 }}>{shareError}</p>}

        <div ref={captureRef} style={{ background: 'white', padding: session ? 4 : 0 }}>
          {session && <GroupHeader groupName={session.group_name} logoUrl1={session.logo_url_1} logoUrl2={session.logo_url_2} />}
          <h1>Tonight&apos;s Storyline</h1>
          {session && <SessionDate createdAt={session.created_at} eventDate={session.event_date} venue={session.venue} />}

          {(!session?.storylines || session.storylines.length === 0) && (
            <p className="card" style={{ color: 'var(--muted)', fontSize: 14, marginTop: 16 }}>
              No storyline was generated for this session — needs at least one player with a rivalry or streak on
              record.
            </p>
          )}

          <div className="card" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 15 }}>
            {session?.storylines?.map(line => <p key={line} style={{ margin: 0 }}>{line}</p>)}
          </div>
        </div>
      </main>
      <SessionNav sessionId={id} clubId={session?.club_id} />
    </>
  );
}
