// format.js — ONE shared number formatter for the economy UI (bar readout, Wins chip, shop
// prices, payouts, stats). Every number the player reads goes through here; a raw `47110` on
// screen is a bug.
//
// THE RULE (feat/progression-clarity):
//   < 10,000   exact, with a THIN separator every three digits — 9 999, 1 234. A comma at this
//              size reads as a decimal point to half the world and adds visual weight to a number
//              that is meant to be read at a glance; a thin space groups without shouting.
//   >= 10,000  abbreviated to THREE SIGNIFICANT FIGURES with a unit suffix, trailing zeros
//              trimmed: 10.4K · 1.28M · 3.1B · 47.1K. Three sig figs is the point — a fixed one
//              decimal turns 1,284,000 into "1.3M" and throws away the digit that distinguishes
//              it from 1.25M, while a fixed two turns 3.1B into "3.10B", which reads as a
//              different, more precise number than it is.
// The ladder runs K/M/B/T/Qa/Qi (thousand … quintillion) so the rebirth multipliers (3^20 =
// 3.49e9) and the late-game XP totals stay compact. Above 1e21 it stops abbreviating, which the
// game never reaches; nothing throws.

// U+2009 THIN SPACE. A non-breaking thin space would be better typography but breaks `toBe()`
// comparisons in a way that is invisible in a diff; this one at least renders identically
// everywhere and copies as a space.
export const THIN = ' ';

// Pluralize a count-noun: `plural(1, 'answer')` → "1 answer", `plural(3, 'answer')` → "3 answers".
// Pass an explicit plural form for irregulars: `plural(2, 'life', 'lives')`. The count is formatted
// with formatNum so big counts stay compact.
export function plural(n, singular, pluralForm = `${singular}s`) {
  const count = Number.isFinite(n) ? n : 0;
  return `${formatNum(count)} ${count === 1 ? singular : pluralForm}`;
}

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];

/** Group the integer part in threes with a thin space: 1234567 → "1 234 567". */
function grouped(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
}

/**
 * The two halves of a formatted number, so a caller can typeset them differently — the NUMERAL in
 * the display face and the UNIT at a smaller size (see <Num> in components/Num.jsx). Splitting
 * here rather than re-parsing the string keeps one definition of the rounding.
 * @returns {{ num: string, suffix: string, exact: boolean }}
 */
export function formatNumParts(n) {
  const num = Number.isFinite(n) ? n : 0;
  const sign = num < 0 ? '-' : '';
  let abs = Math.abs(num);
  if (abs < 10000) return { num: sign + grouped(Math.round(abs)), suffix: '', exact: true };
  let tier = 0;
  while (abs >= 1000 && tier < SUFFIXES.length - 1) {
    abs /= 1000;
    tier += 1;
  }
  // THREE SIGNIFICANT FIGURES. abs is now in [1, 1000), so the decimals needed are 2 / 1 / 0 for
  // the 1-/2-/3-digit cases — that is what makes 1.28M and 3.1B come out of the same rule.
  const decimals = abs < 10 ? 2 : abs < 100 ? 1 : 0;
  let str = abs.toFixed(decimals);
  // Rounding can push e.g. 999.6K to "1000"; carry it up a tier so it reads "1.00M", not "1000K".
  if (parseFloat(str) >= 1000 && tier < SUFFIXES.length - 1) {
    abs /= 1000;
    tier += 1;
    str = abs.toFixed(2);
  }
  // Trim trailing zeros (and a bare trailing point): 3.10 → 3.1, 5.00 → 5.
  if (str.includes('.')) str = str.replace(/\.?0+$/, '');
  return { num: sign + str, suffix: SUFFIXES[tier], exact: false };
}

export function formatNum(n) {
  const p = formatNumParts(n);
  return p.num + p.suffix;
}
