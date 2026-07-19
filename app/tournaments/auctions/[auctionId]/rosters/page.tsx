'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Trophy, Share2 } from 'lucide-react';
import { fetchAuction, type AuctionRow } from '@/lib/auctions';
import { fetchAuctionCategories, type AuctionCategoryRow } from '@/lib/auctionCategories';
import { fetchAuctionPlayersPublic, type AuctionPlayerPublicRow } from '@/lib/auctionPlayers';
import { fetchAuctionTeams, type AuctionTeamRow } from '@/lib/auctionTeams';
import { formatRupees } from '@/lib/auctionMoney';
import { useCurrentClub } from '@/lib/useCurrentClub';
import { shareElementAsImage } from '@/lib/shareImage';
import ShareBrandedHeader from '@/components/ShareBrandedHeader';

export default function AuctionRostersPage() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [auction, setAuction] = useState<AuctionRow | null>(null);
  const [categories, setCategories] = useState<AuctionCategoryRow[]>([]);
  const [players, setPlayers] = useState<AuctionPlayerPublicRow[]>([]);
  const [teams, setTeams] = useState<AuctionTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const captureRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (clubLoading || !currentClubId) return;
    Promise.all([fetchAuction(auctionId), fetchAuctionCategories(auctionId), fetchAuctionPlayersPublic(auctionId), fetchAuctionTeams(auctionId)])
      .then(([a, cats, pl, tm]) => {
        setAuction(a);
        setCategories(cats);
        setPlayers(pl);
        setTeams(tm);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load rosters.'))
      .finally(() => setLoading(false));
  }, [currentClubId, clubLoading, auctionId]);

  async function handleShareTeam(teamId: string, teamName: string) {
    const el = captureRefs.current[teamId];
    if (!el) return;
    setShareError(null);
    try {
      const result = await shareElementAsImage(el, `${teamName.replace(/\s+/g, '-')}-roster.png`);
      if (result === 'downloaded') {
        setShareError("Image downloaded — attach it to WhatsApp manually (direct share isn't supported on this browser).");
      }
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'Failed to share image.');
    }
  }

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId || !auction) return <main className="page"><p>Auction not found.</p></main>;
  if (error) return <main className="page"><p style={{ color: 'var(--danger)' }}>{error}</p></main>;

  const categoryName = (id: string) => categories.find(c => c.id === id)?.name ?? '';
  const soldPlayers = players.filter(p => p.status === 'sold');
  const unsoldPlayers = players.filter(p => p.status === 'unsold');

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href={`/tournaments/auctions/${auctionId}`} className="text-link-btn">← {auction.name}</Link>
      </div>

      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={22} /> Final Rosters</h1>

      {shareError && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 13, marginBottom: 12 }}>{shareError}</p>}

      {teams.map(team => {
        const roster = soldPlayers.filter(p => p.winning_team_id === team.id);
        const totalSpent = roster.reduce((sum, p) => sum + (p.sold_price ?? 0), 0);
        return (
          <div key={team.id} style={{ marginBottom: 20 }}>
            <div className="page-header-row" style={{ marginBottom: 4 }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {team.logo_url && <img src={team.logo_url} alt="" width={28} height={28} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
                {team.name}
              </h2>
              <button className="icon-btn" aria-label={`Share ${team.name} roster`} onClick={() => handleShareTeam(team.id, team.name)}>
                <Share2 size={16} />
              </button>
            </div>
            <div className="card" ref={el => { captureRefs.current[team.id] = el; }}>
              <ShareBrandedHeader clubId={currentClubId} />
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                {roster.length} player{roster.length === 1 ? '' : 's'} · {formatRupees(totalSpent)} spent · {formatRupees(team.purse_remaining)} remaining
              </div>
              {roster.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No players won yet.</p>}
              {roster.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 700 }}>{p.player_name}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{categoryName(p.category_id)}</span>
                  <span style={{ fontWeight: 700 }}>{formatRupees(p.sold_price ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {unsoldPlayers.length > 0 && (
        <>
          <h2>Unsold</h2>
          <div className="card">
            {unsoldPlayers.map(p => (
              <div key={p.id} style={{ padding: '4px 0' }}>{p.player_name} — {categoryName(p.category_id)}</div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
