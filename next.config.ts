import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Auction moved from /league/auctions to /tournaments/auctions (it's a
  // tournament-mode team-formation stage, not a League feature). Permanent
  // (301) so old bookmarks/links and search engines update — the previous
  // implementation used next/navigation's redirect() from page components,
  // which only issues a 307 (temporary) redirect with no way to mark it
  // permanent.
  async redirects() {
    return [
      { source: '/league/auctions', destination: '/tournaments/auctions', permanent: true },
      { source: '/league/auctions/:auctionId', destination: '/tournaments/auctions/:auctionId', permanent: true },
      { source: '/league/auctions/:auctionId/bid', destination: '/tournaments/auctions/:auctionId/bid', permanent: true },
      { source: '/league/auctions/:auctionId/rosters', destination: '/tournaments/auctions/:auctionId/rosters', permanent: true },
    ];
  },
};

export default nextConfig;
