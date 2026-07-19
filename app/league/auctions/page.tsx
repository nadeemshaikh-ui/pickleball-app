import { redirect } from 'next/navigation';

// Auction moved under Tournaments (it's a tournament-mode team-formation
// stage, not a League feature) — kept as a redirect so old bookmarks work.
export default function LegacyAuctionsRedirect() {
  redirect('/tournaments/auctions');
}
