import { redirect } from 'next/navigation';

export default async function LegacyAuctionRedirect({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = await params;
  redirect(`/tournaments/auctions/${auctionId}`);
}
