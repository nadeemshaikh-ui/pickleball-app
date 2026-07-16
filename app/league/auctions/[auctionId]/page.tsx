'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Gavel, Plus, Trash2, Share2 } from 'lucide-react';
import { fetchAuction, type AuctionRow } from '@/lib/auctions';
import {
  fetchAuctionCategories,
  addAuctionCategory,
  updateAuctionCategoryPrice,
  deleteAuctionCategory,
  type AuctionCategoryRow,
} from '@/lib/auctionCategories';
import {
  fetchAuctionPlayersPublic,
  addAuctionPlayer,
  updateAuctionPlayerCategory,
  removeAuctionPlayer,
  suggestCategoryForRating,
  type AuctionPlayerPublicRow,
} from '@/lib/auctionPlayers';
import { fetchAuctionTeams, createAuctionTeam, uploadAuctionTeamLogo, type AuctionTeamRow } from '@/lib/auctionTeams';
import { formatRupees } from '@/lib/auctionMoney';
import { listPlayers, type PlayerRow } from '@/lib/players';
import { isCurrentUserAdmin } from '@/lib/auth';
import { useCurrentClub } from '@/lib/useCurrentClub';
import { shareElementAsImage } from '@/lib/shareImage';
import ShareBrandedHeader from '@/components/ShareBrandedHeader';

export default function AuctionDetailPage() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [auction, setAuction] = useState<AuctionRow | null>(null);
  const [categories, setCategories] = useState<AuctionCategoryRow[]>([]);
  const [poolPlayers, setPoolPlayers] = useState<AuctionPlayerPublicRow[]>([]);
  const [teams, setTeams] = useState<AuctionTeamRow[]>([]);
  const [clubPlayers, setClubPlayers] = useState<PlayerRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imageShareError, setImageShareError] = useState<string | null>(null);
  const poolCaptureRef = useRef<HTMLDivElement>(null);

  const [newCatName, setNewCatName] = useState('');
  const [newCatPrice, setNewCatPrice] = useState('');

  const [poolPlayerName, setPoolPlayerName] = useState('');
  const [poolCategoryId, setPoolCategoryId] = useState('');
  const [poolWhatsapp, setPoolWhatsapp] = useState('');
  const [poolInstagram, setPoolInstagram] = useState('');

  const [teamName, setTeamName] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');

  async function load(clubId: string, id: string) {
    const [a, cats, pool, tm, pl] = await Promise.all([
      fetchAuction(id),
      fetchAuctionCategories(id),
      fetchAuctionPlayersPublic(id),
      fetchAuctionTeams(id),
      listPlayers(clubId),
    ]);
    setAuction(a);
    setCategories(cats);
    setPoolPlayers(pool);
    setTeams(tm);
    setClubPlayers(pl);
  }

  useEffect(() => {
    if (clubLoading) return;
    if (!currentClubId || !auctionId) {
      setLoading(false);
      return;
    }
    async function init() {
      try {
        await Promise.all([load(currentClubId!, auctionId), isCurrentUserAdmin(currentClubId!).then(setIsAdmin)]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load auction.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [currentClubId, clubLoading, auctionId]);

  async function handleAddCategory() {
    if (!newCatName.trim() || !newCatPrice) return;
    setBusy(true);
    setError(null);
    try {
      await addAuctionCategory(auctionId, newCatName.trim(), Number(newCatPrice), categories.length);
      setNewCatName('');
      setNewCatPrice('');
      setCategories(await fetchAuctionCategories(auctionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add category.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCategoryPriceChange(categoryId: string, price: string) {
    if (!price) return;
    try {
      await updateAuctionCategoryPrice(categoryId, Number(price));
      setCategories(await fetchAuctionCategories(auctionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update base price.');
    }
  }

  async function handleRemoveCategory(categoryId: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteAuctionCategory(categoryId);
      setCategories(await fetchAuctionCategories(auctionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove category — players already pooled under it must move first.");
    } finally {
      setBusy(false);
    }
  }

  function handlePoolPlayerSelect(name: string) {
    setPoolPlayerName(name);
    const player = clubPlayers.find(p => p.name === name);
    if (player) {
      const suggested = suggestCategoryForRating(player.elo_rating, categories);
      if (suggested) setPoolCategoryId(suggested);
    }
  }

  async function handleAddToPool() {
    if (!poolPlayerName || !poolCategoryId) return;
    setBusy(true);
    setError(null);
    try {
      const player = clubPlayers.find(p => p.name === poolPlayerName);
      await addAuctionPlayer({
        auctionId,
        playerName: poolPlayerName,
        playerUserId: player?.user_id ?? null,
        categoryId: poolCategoryId,
        whatsappNumber: poolWhatsapp.trim() || null,
        instagramHandle: poolInstagram.trim() || null,
      });
      setPoolPlayerName('');
      setPoolCategoryId('');
      setPoolWhatsapp('');
      setPoolInstagram('');
      setPoolPlayers(await fetchAuctionPlayersPublic(auctionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add player to pool.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePoolCategoryChange(auctionPlayerId: string, categoryId: string) {
    try {
      await updateAuctionPlayerCategory(auctionPlayerId, categoryId);
      setPoolPlayers(await fetchAuctionPlayersPublic(auctionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update category.');
    }
  }

  async function handleRemoveFromPool(auctionPlayerId: string) {
    setBusy(true);
    setError(null);
    try {
      await removeAuctionPlayer(auctionPlayerId);
      setPoolPlayers(await fetchAuctionPlayersPublic(auctionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove player.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddTeam() {
    if (!teamName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createAuctionTeam(auctionId, teamName.trim(), null, ownerUserId || null);
      setTeamName('');
      setOwnerUserId('');
      setTeams(await fetchAuctionTeams(auctionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add team.');
    } finally {
      setBusy(false);
    }
  }

  async function handleTeamLogoUpload(teamId: string, file: File) {
    setBusy(true);
    setError(null);
    try {
      const url = await uploadAuctionTeamLogo(file);
      const { updateAuctionTeamLogo } = await import('@/lib/auctionTeams');
      await updateAuctionTeamLogo(teamId, url);
      setTeams(await fetchAuctionTeams(auctionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload logo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSharePool() {
    if (!poolCaptureRef.current) return;
    setImageShareError(null);
    try {
      const result = await shareElementAsImage(poolCaptureRef.current, 'auction-pool.png');
      if (result === 'downloaded') {
        setImageShareError("Image downloaded — attach it to WhatsApp manually (direct share isn't supported on this browser).");
      }
    } catch (e) {
      setImageShareError(e instanceof Error ? e.message : 'Failed to share image.');
    }
  }

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId || !auction) return <main className="page"><p>Auction not found.</p></main>;

  const categoryName = (id: string) => categories.find(c => c.id === id)?.name ?? 'Unknown';
  const categoryPrice = (id: string) => categories.find(c => c.id === id)?.base_price ?? 0;
  const eligiblePlayers = clubPlayers.filter(p => !poolPlayers.some(pp => pp.player_name === p.name));
  const ownerCandidates = clubPlayers.filter(p => p.user_id);

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href="/league/auctions" className="text-link-btn">← Auctions</Link>
      </div>

      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Gavel size={22} /> {auction.name}</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
        Purse per team: {formatRupees(auction.purse_amount)} · Min roster: {auction.min_roster_size}
      </p>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>{error}</p>}

      <h2>Categories</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {categories.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, flex: 1 }}>{c.name}</span>
            {isAdmin ? (
              <input
                type="number"
                defaultValue={c.base_price}
                onBlur={e => handleCategoryPriceChange(c.id, e.target.value)}
                style={{ width: 110 }}
              />
            ) : (
              <span>{formatRupees(c.base_price)}</span>
            )}
            {isAdmin && (
              <button className="icon-btn" aria-label="Remove category" disabled={busy} onClick={() => handleRemoveCategory(c.id)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input type="text" placeholder="Category name" value={newCatName} onChange={e => setNewCatName(e.target.value)} style={{ flex: 1 }} />
            <input type="number" placeholder="Base price (₹)" value={newCatPrice} onChange={e => setNewCatPrice(e.target.value)} style={{ width: 130 }} />
            <button className="btn-secondary" onClick={handleAddCategory} disabled={busy || !newCatName.trim() || !newCatPrice}>
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="page-header-row">
        <h2 style={{ margin: 0 }}>Player Pool</h2>
        {isAdmin && poolPlayers.length > 0 && (
          <button className="icon-btn" aria-label="Share pool catalogue on WhatsApp" onClick={handleSharePool}>
            <Share2 size={16} />
          </button>
        )}
      </div>
      {imageShareError && <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{imageShareError}</p>}
      <div className="card" ref={poolCaptureRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <ShareBrandedHeader clubId={currentClubId} />
        {poolPlayers.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No players pooled yet.</p>}
        {poolPlayers.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, flex: 1 }}>{p.player_name}</span>
            {isAdmin ? (
              <select value={p.category_id} onChange={e => handlePoolCategoryChange(p.id, e.target.value)}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{categoryName(p.category_id)}</span>
            )}
            <span style={{ fontSize: 12, fontWeight: 700 }}>{formatRupees(categoryPrice(p.category_id))}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>{p.status}</span>
            {isAdmin && (
              <button className="icon-btn" aria-label="Remove from pool" disabled={busy} onClick={() => handleRemoveFromPool(p.id)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <div style={{ fontWeight: 700 }}>Add Player to Pool</div>
          <select value={poolPlayerName} onChange={e => handlePoolPlayerSelect(e.target.value)}>
            <option value="">Choose a player…</option>
            {eligiblePlayers.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <select value={poolCategoryId} onChange={e => setPoolCategoryId(e.target.value)}>
            <option value="">Choose a category…</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name} — {formatRupees(c.base_price)}</option>)}
          </select>
          <input type="tel" placeholder="WhatsApp number (optional)" value={poolWhatsapp} onChange={e => setPoolWhatsapp(e.target.value)} />
          <input
            type="text"
            placeholder="Instagram handle (optional — teams love checking out your game reels)"
            value={poolInstagram}
            onChange={e => setPoolInstagram(e.target.value)}
          />
          <button className="btn-primary" onClick={handleAddToPool} disabled={busy || !poolPlayerName || !poolCategoryId}>
            <Plus size={14} /> Add to Pool
          </button>
        </div>
      )}

      <h2>Teams</h2>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {teams.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>No teams yet.</p>}
        {teams.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {t.logo_url && <img src={t.logo_url} alt="" width={28} height={28} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
            <span style={{ fontWeight: 700, flex: 1 }}>{t.name}</span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{formatRupees(t.purse_remaining)} left</span>
            {isAdmin && (
              <label className="text-link-btn" style={{ cursor: 'pointer' }}>
                Logo
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && handleTeamLogoUpload(t.id, e.target.files[0])}
                />
              </label>
            )}
          </div>
        ))}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <input type="text" placeholder="Team name" value={teamName} onChange={e => setTeamName(e.target.value)} style={{ flex: '1 1 140px' }} />
            <select value={ownerUserId} onChange={e => setOwnerUserId(e.target.value)} style={{ flex: '1 1 140px' }}>
              <option value="">Owner (optional, can assign later)</option>
              {ownerCandidates.map(p => <option key={p.id} value={p.user_id!}>{p.name}</option>)}
            </select>
            <button className="btn-primary" onClick={handleAddTeam} disabled={busy || !teamName.trim()}>
              <Plus size={14} /> Add
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
