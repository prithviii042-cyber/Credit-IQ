const _inr = new Intl.NumberFormat('en-IN');

// Full Indian rupee: ₹1,00,000
export const fmtInr = (n) => '₹' + _inr.format(Math.round(n));

// Compact: ₹4.5L or ₹4.5 Cr
export function fmtCompact(n) {
  const lac = n / 1_00_000;
  if (lac >= 10_000) return `₹${(lac / 100).toFixed(1)} Cr`;
  return `₹${lac.toFixed(1)}L`;
}

// Portfolio health: weighted avg score by outstanding → letter+modifier
export function calcPortfolioHealth(portfolio) {
  if (!portfolio?.length) return null;
  const totalOs = portfolio.reduce((s, c) => s + (c.outstanding || 0), 0);
  if (!totalOs) return null;
  const ws = portfolio.reduce((s, c) => s + (c.finalScore || 0) * (c.outstanding || 0), 0) / totalOs;
  const label =
    ws >= 88 ? 'A+' : ws >= 80 ? 'A' : ws >= 75 ? 'A-' :
    ws >= 68 ? 'B+' : ws >= 61 ? 'B' : ws >= 55 ? 'B-' :
    ws >= 48 ? 'C+' : ws >= 41 ? 'C' : ws >= 35 ? 'C-' : 'D';
  return { score: ws, label };
}
