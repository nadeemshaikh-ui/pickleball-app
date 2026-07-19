'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Gavel, Clock } from 'lucide-react';
import { fetchAuction, type AuctionRow } from '@/lib/auctions';
import { fetchAuctionCategories, type AuctionCategoryRow } from '@/lib/auctionCategories';
import { fetchAuctionPlayersPublic, type AuctionPlayerPublicRow } from '@/lib/auctionPlayers';
import { fetchAuctionTeams, type AuctionTeamRow } from '@/lib/auctionTeams';
import {
  startAuctionLot,
  placeBid,
  resolveLot,
  computeMaxBid,
  fetchRecentBids,
  subscribeToAuction,
  type AuctionBidRow,
} from '@/lib/auctionBidding';
import { formatRupees } from '@/lib/auctionMoney';
import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth';
import { useCurrentClub } from '@/lib/useCurrentClub';

export default function AuctionBiddingPage() {
  const { auctionId } = useParams<{ auctionId: string }>();
  const { currentClubId, loading: clubLoading } = useCurrentClub();
  const [auction, setAuction] = useState<AuctionRow | null>(null);
  const [categories, setCategories] = useState<AuctionCategoryRow[]>([]);
  const [poolPlayers, setPoolPlayers] = useState<AuctionPlayerPublicRow[]>([]);
  const [teams, setTeams] = useState<AuctionTeamRow[]>([]);
  const [bids, setBids] = useState<AuctionBidRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customBid, setCustomBid] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [nextPlayerId, setNextPlayerId] = useState('');
  const resolveInFlight = useRef(false);

  const load = useCallback(async () => {
    const [a, cats, pool, tm] = await Promise.all([
      fetchAuction(auctionId),
      fetchAuctionCategories(auctionId),
      fetchAuctionPlayersPublic(auctionId),
      fetchAuctionTeams(auctionId),
    ]);
    setAuction(a);
    setCategories(cats);
    setPoolPlayers(pool);
    setTeams(tm);
    if (a.current_lot_player_id) {
      setBids(await fetchRecentBids(a.current_lot_player_id));
    } else {
      setBids([]);
    }
  }, [auctionId]);

  useEffect(() => {
    if (clubLoading || !currentClubId) return;
    let cancelled = false;
    async function init() {
      try {
        const [user, admin] = await Promise.all([getCurrentUser(), isCurrentUserAdmin(currentClubId!)]);
        if (cancelled) return;
        setUserId(user?.id ?? null);
        setIsAdmin(admin);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load auction.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    const unsubscribe = subscribeToAuction(auctionId, () => load().catch(() => {}));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [currentClubId, clubLoading, auctionId, load]);

  // Local 1s ticker drives both the visible countdown and the opportunistic
  // resolve — the server-authoritative deadline is auction_player.lot_closes_at,
  // this timer only ever reads it, never sets it, so a slow/fast client
  // clock can't create an unfair window (everyone's countdown reads the
  // same shared DB value, just re-renders locally every second).
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const currentLot = auction?.current_lot_player_id ? poolPlayers.find(p => p.id === auction.current_lot_player_id) ?? null : null;

  // Opportunistic client-side resolve the instant the countdown hits zero —
  // near-instant resolution when anyone's watching; pg_cron (see the
  // migration) is purely the once-a-minute backstop for an unwatched lot.
  // resolve_lot is idempotent and safe for any club member to call, so no
  // harm if two viewers' clients both fire this at once.
  useEffect(() => {
    if (!currentLot?.lot_closes_at || resolveInFlight.current) return;
    if (new Date(currentLot.lot_closes_at).getTime() > nowTick) return;
    resolveInFlight.current = true;
    resolveLot(currentLot.id, false)
      .then(() => load())
      .catch(() => {})
      .finally(() => {
        resolveInFlight.current = false;
      });
  }, [currentLot, nowTick, load]);

  if (loading || clubLoading) return <main className="page"><p>Loading…</p></main>;
  if (!currentClubId || !auction) return <main className="page"><p>Auction not found.</p></main>;

  const myTeam = teams.find(t => t.owner_user_id === userId) ?? null;
  const wonCount = myTeam ? poolPlayers.filter(p => p.winning_team_id === myTeam.id && p.status === 'sold').length : 0;
  const minCategoryPrice = categories.length > 0 ? Math.min(...categories.map(c => c.base_price)) : 0;
  const myMaxBid = myTeam ? computeMaxBid(myTeam.purse_remaining, auction.min_roster_size, wonCount, minCategoryPrice) : null;

  const category = currentLot ? categories.find(c => c.id === currentLot.category_id) : null;
  const floor = category?.base_price ?? 0; // starting price before any bid is placed on this lot
  const leadingTeam = currentLot?.current_bid_team_id ? teams.find(t => t.id === currentLot.current_bid_team_id) : null;

  const eligibleNextPlayers = poolPlayers.filter(p => p.status === 'pooled' && p.id !== auction.current_lot_player_id);

  async function handleStartLot() {
    if (!nextPlayerId) return;
    setBusy(true);
    setError(null);
    try {
      await startAuctionLot(auctionId, nextPlayerId);
      setNextPlayerId('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start lot.');
    } finally {
      setBusy(false);
    }
  }

  async function handleBid(amount: number) {
    if (!currentLot || !myTeam) return;
    setBusy(true);
    setError(null);
    try {
      await placeBid(currentLot.id, myTeam.id, amount);
      setCustomBid('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bid failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseLot() {
    if (!currentLot) return;
    setBusy(true);
    setError(null);
    try {
      await resolveLot(currentLot.id, true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to close lot.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <div className="page-header-row">
        <Link href={`/tournaments/auctions/${auctionId}`} className="text-link-btn">← {auction.name}</Link>
      </div>

      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Gavel size={22} /> Live Bidding</h1>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>{error}</p>}

      {myTeam && (
        <p style={{ fontSize: 13, marginBottom: 12 }}>
          <strong>{myTeam.name}</strong> — purse {formatRupees(myTeam.purse_remaining)}
          {myMaxBid !== null && <> · your max bid right now: <strong>{formatRupees(myMaxBid)}</strong></>}
        </p>
      )}

      {currentLot ? (
        <LotCard
          lot={currentLot}
          categoryName={category?.name ?? ''}
          leadingTeamName={leadingTeam?.name ?? null}
          myTeam={myTeam}
          myMaxBid={myMaxBid}
          minIncrement={auction.min_increment}
          floor={floor}
          busy={busy}
          customBid={customBid}
          setCustomBid={setCustomBid}
          onBid={handleBid}
          bids={bids}
          teams={teams}
          nowTick={nowTick}
        />
      ) : (
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>No lot is currently open.</p>
      )}

      {isAdmin && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <div style={{ fontWeight: 700 }}>Admin Controls</div>
          {currentLot && (
            <button className="btn-secondary" onClick={handleCloseLot} disabled={busy}>
              Close Lot Now
            </button>
          )}
          {!currentLot && (
            <>
              <select value={nextPlayerId} onChange={e => setNextPlayerId(e.target.value)}>
                <option value="">Choose next player…</option>
                {eligibleNextPlayers.map(p => <option key={p.id} value={p.id}>{p.player_name}</option>)}
              </select>
              <button className="btn-primary" onClick={handleStartLot} disabled={busy || !nextPlayerId}>
                Start Lot
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}

function LotCard({
  lot,
  categoryName,
  leadingTeamName,
  myTeam,
  myMaxBid,
  minIncrement,
  floor,
  busy,
  customBid,
  setCustomBid,
  onBid,
  bids,
  teams,
  nowTick,
}: {
  lot: AuctionPlayerPublicRow;
  categoryName: string;
  leadingTeamName: string | null;
  myTeam: AuctionTeamRow | null;
  myMaxBid: number | null;
  minIncrement: number;
  floor: number;
  busy: boolean;
  customBid: string;
  setCustomBid: (v: string) => void;
  onBid: (amount: number) => void;
  bids: AuctionBidRow[];
  teams: AuctionTeamRow[];
  nowTick: number;
}) {
  const secondsLeft = lot.lot_closes_at ? Math.max(0, Math.round((new Date(lot.lot_closes_at).getTime() - nowTick) / 1000)) : null;
  const currentBid = lot.current_bid_amount;
  const nextBidFloor = (currentBid ?? floor - minIncrement) + minIncrement;
  const isMineLeading = myTeam && leadingTeamName === myTeam.name;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 900, fontSize: 20 }}>{lot.player_name}</div>
        {secondsLeft !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 800, color: secondsLeft <= 5 ? 'var(--danger)' : 'inherit' }}>
            <Clock size={16} /> {secondsLeft}s
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{categoryName}</div>
      <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>{formatRupees(currentBid ?? floor)}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        {leadingTeamName ? <>Leading: <strong>{leadingTeamName}</strong>{isMineLeading && ' (you)'}</> : 'No bids yet'}
      </div>

      {myTeam && !isMineLeading && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            disabled={busy || (myMaxBid !== null && nextBidFloor > myMaxBid)}
            onClick={() => onBid(nextBidFloor)}
          >
            Bid {formatRupees(nextBidFloor)}
          </button>
          <input
            type="number"
            placeholder="Custom amount"
            value={customBid}
            onChange={e => setCustomBid(e.target.value)}
            style={{ width: 140 }}
          />
          <button
            className="btn-secondary"
            disabled={busy || !customBid || Number(customBid) < nextBidFloor || (myMaxBid !== null && Number(customBid) > myMaxBid)}
            onClick={() => onBid(Number(customBid))}
          >
            Bid Custom
          </button>
        </div>
      )}

      {bids.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
          {bids.map(b => (
            <div key={b.id}>{formatRupees(b.amount)} — {teams.find(t => t.id === b.team_id)?.name ?? 'Unknown'}</div>
          ))}
        </div>
      )}
    </div>
  );
}
