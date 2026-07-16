// Auction currency is stored as one canonical integer unit server-side —
// whole rupees, never pre-formatted — and converted to the IPL-style
// Lakhs/Crores display only at render time. Storing pre-formatted or
// ambiguous-unit values (some rows "5" meaning lakhs, others meaning raw
// rupees) was flagged during planning as an easy silent-corruption bug.
export function formatRupees(amountInRupees: number): string {
  if (amountInRupees >= 1_00_00_000) {
    return `₹${(amountInRupees / 1_00_00_000).toFixed(amountInRupees % 1_00_00_000 === 0 ? 0 : 2)}Cr`;
  }
  if (amountInRupees >= 1_00_000) {
    return `₹${(amountInRupees / 1_00_000).toFixed(amountInRupees % 1_00_000 === 0 ? 0 : 2)}L`;
  }
  return `₹${amountInRupees.toLocaleString('en-IN')}`;
}
