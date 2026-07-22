export interface FeeSplit {
  totalCourtCost: number;
  totalBallCost: number;
  playerCount: number;
  perPlayerCost: number;
}

export function calculateFeeSplit(courtCost: number, ballCost: number, playerCount: number): FeeSplit {
  const safeCourt = Math.max(0, courtCost || 0);
  const safeBall = Math.max(0, ballCost || 0);
  const safePlayers = Math.max(1, playerCount || 1);
  const total = safeCourt + safeBall;
  const perPlayerCost = Math.ceil(total / safePlayers);

  return {
    totalCourtCost: safeCourt,
    totalBallCost: safeBall,
    playerCount: safePlayers,
    perPlayerCost
  };
}

export function buildUpiDeepLink(vpa: string, amount: number, payeeName = 'Pickleball Session'): string {
  const cleanVpa = vpa.trim();
  const safeAmount = Math.max(0, amount);
  const note = encodeURIComponent(`Court Dues - ${payeeName}`);
  return `tez://upi/pay?pa=${cleanVpa}&pn=${encodeURIComponent(payeeName)}&am=${safeAmount}&cu=INR&tn=${note}`;
}
