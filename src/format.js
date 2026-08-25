// format.js — ONE shared number formatter for the economy UI (bar readout, Wins chip, shop
// prices, stats). Below 10,000 it reads in full with grouping (toLocaleString); at or above
// 10,000 it abbreviates to one decimal with a suffix, so a value never shows more than 5
// characters before the suffix (e.g. 14.3K, 2.2M, 999,999 → 1.0M). The ladder runs
// K/M/B/T/Qa/Qi (thousand … quintillion) so Economy v4's rebirth multipliers (R20 ×1e11,
// past-R20 ×1e12+) and the huge late-game XP totals stay compact — 1e11 → 100.0B, 1e15 →
// 1.0Qa, 1e18 → 1.0Qi. Above 1e21 it stops abbreviating (returns "1000.0Qi"+), which the
// game never reaches; nothing throws.
export function formatNum(n) {
  const num = Number.isFinite(n) ? n : 0;
  if (Math.abs(num) < 10000) return num.toLocaleString();
  const suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
  const sign = num < 0 ? '-' : '';
  let abs = Math.abs(num);
  let tier = 0;
  while (abs >= 1000 && tier < suffixes.length - 1) {
    abs /= 1000;
    tier += 1;
  }
  let str = abs.toFixed(1);
  // Rounding can push e.g. 999.95K to "1000.0K"; carry it up a tier so it reads "1.0M".
  if (parseFloat(str) >= 1000 && tier < suffixes.length - 1) {
    abs /= 1000;
    tier += 1;
    str = abs.toFixed(1);
  }
  return sign + str + suffixes[tier];
}
