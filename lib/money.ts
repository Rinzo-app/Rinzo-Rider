/** All backend amounts are integer paise. Format for display. */
export function formatMoney(paise: number): string {
  const rupees = (paise ?? 0) / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
}
