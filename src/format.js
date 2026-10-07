// format.js — ONE shared number formatter for the economy UI (bar readout, Wins chip, shop
// prices, payouts, stats). Every number the player reads goes through here; a raw `47110` on
// screen is a bug.
//
// THE RULE (feat/progression-clarity):
//   < 10,000   exact, grouped every three digits with a COMMA — 9,999 · 1,234.
//              THIS WAS A THIN SPACE (U+2009) and it was wrong in practice. The reasoning was
//              that a comma reads as a decimal separator to half the world; the reality on the
//              game cards was "1 030", which reads as two numbers, and Andy filed it as a broken
//              formatter twice. A grouping character that makes a four-digit rate look like a
//              pair of numbers has failed at the only job it has. Comma it is.
//   >= 10,000  abbreviated to THREE SIGNIFICANT FIGURES with a unit suffix, trailing zeros
//              trimmed: 10.4K · 1.28M · 3.1B · 47.1K. Three sig figs is the point — a fixed one
//              decimal turns 1,284,000 into "1.3M" and throws away the digit that distinguishes
//              it from 1.25M, while a fixed two turns 3.1B into "3.10B", which reads as a
//              different, more precise number than it is.
// The ladder runs K/M/B/T/Qa/Qi (thousand … quintillion) so the rebirth multipliers (3^20 =
// 3.49e9) and the late-game XP totals stay compact. Above 1e21 it stops abbreviating, which the
// game never reaches; nothing throws.

// The grouping character. H6/L1: the header above has said COMMA since a34bf4fc, but this constant
// was still U+2009 THIN SPACE, so the UI kept printing "6 000" / "2 000 WORDS" — the exact "reads as
// two numbers" defect the header describes. (The name is kept so every importer stays valid.)
export const THIN = ',';

// Pluralize a count-noun: `plural(1, 'answer')` → "1 answer", `plural(3, 'answer')` → "3 answers".
// Pass an explicit plural form for irregulars: `plural(2, 'life', 'lives')`. The count is formatted
// with formatNum so big counts stay compact.
export function plural(n, singular, pluralForm = `${singular}s`) {
  const count = Number.isFinite(n) ? n : 0;
  return `${formatNum(count)} ${count === 1 ? singular : pluralForm}`;
}

// NO CAPS (Andy oct2): the ladder runs past Qi with NAMED short-scale tiers all the way to the top of
// a double (1.8e308), so a number never falls back to raw digits or "e+": … Qi Sx Sp Oc No Dc Ud Dd Td
// Qad Qid Sxd Spd Ocd Nod Vg Uvg … Tg … Qag … Ng Ce UCe. Tier t = 10^(3t); the -illion index is t-1.
const FIRST = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];
const UNIT = ['', 'U', 'D', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];
const TENS = ['', 'Dc', 'Vg', 'Tg', 'Qag', 'Qig', 'Sxg', 'Spg', 'Ocg', 'Ng'];
const TENS_TAIL = ['', 'd', 'vg', 'tg', 'qag', 'qig', 'sxg', 'spg', 'ocg', 'ng'];
function illionName(n) {
  if (n >= 100) return (UNIT[n - 100] || '') + 'Ce'; // centillion (1e303), uncentillion (1e306)
  const u = n % 10;
  const d = Math.floor(n / 10);
  return u === 0 ? TENS[d] : UNIT[u] + TENS_TAIL[d];
}
const SUFFIXES = [...FIRST];
for (let n = 10; n <= 101; n += 1) SUFFIXES.push(illionName(n)); // up to 1e306 (×1000 more is past a double)
export { SUFFIXES };

/** Group the integer part in threes: 1234567 → "1,234,567". */
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
  // Past a double: say so, never print 0 or "Infinity".
  if (n === Infinity) return { num: '∞', suffix: '', exact: false };
  if (n === -Infinity) return { num: '-∞', suffix: '', exact: false };
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

// NUMBER STYLE (P9d settings, claude/mockups/v2/RoomSettings.dc.html): 'short' (1.2M — the default, the rule above) or
// 'full' (1,200,000 — every digit, grouped). FULL stops at FULL_MAX (a billion): past it a number is abbreviated in
// either style, because a 13-digit figure does not fit any HUD slot. Read once at load, then set live by the settings
// row; a screen re-renders on its next state change (no per-frame read). Stored as `taw.numStyle`.
export const NUM_STYLE_KEY = 'taw.numStyle';
export const FULL_MAX = 1e9;
let numStyle = (() => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(NUM_STYLE_KEY) === 'full' ? 'full' : 'short';
  } catch {
    return 'short';
  }
})();
export function getNumberStyle() {
  return numStyle;
}
export function setNumberStyle(style) {
  numStyle = style === 'full' ? 'full' : 'short';
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(NUM_STYLE_KEY, numStyle);
  } catch {
    /* blocked storage: the style holds for this page only */
  }
  return numStyle;
}

export function formatNum(n) {
  if (numStyle === 'full' && Number.isFinite(n) && Math.abs(n) < FULL_MAX) {
    return (n < 0 ? '-' : '') + grouped(Math.round(Math.abs(n)));
  }
  const p = formatNumParts(n);
  return p.num + p.suffix;
}

/**
 * A PER-WORD WINS RATE, printed to the tenth it is actually paid at. A word is worth its XP ÷ 10
 * and XP is whole, so a rate is whole tenths of a win (10.1). `formatNum` rounds to a whole number
 * below 10,000 — which printed 10.1 as "10" and hid every momentum mark under ten. Same grouping
 * and same ≥10,000 abbreviation as formatNum; a whole rate prints with no ".0".
 */
export function formatRate(n) {
  const v = Number.isFinite(n) ? n : 0;
  if (Math.abs(v) >= 10000) return formatNum(v);
  const r = Math.round(Number((v * 10).toPrecision(12))) / 10;
  if (Number.isInteger(r)) return formatNum(r);
  const [i, d] = String(Math.abs(r)).split('.');
  return (r < 0 ? '-' : '') + grouped(i) + '.' + d;
}

/**
 * A SINGLE NAMED FACTOR, printed exactly. `formatMult` rounds to one decimal, which is right for a
 * resolved PRODUCT on a card (×3, ×4.5) and wrong for the individual factors a receipt names: the
 * daily-streak ladder is 1.05 / 1.10 / 1.20 / 1.25, and one decimal turns ×1.05 into "×1.1" and
 * ×1.25 into "×1.3" — a receipt quoting a multiplier the game did not apply.
 *
 * Two decimals, trailing zeros trimmed, so ×2.00 does not read as a different number from ×2.
 * Use this wherever a factor is shown BESIDE its name (receipts, the streak chip, the live stack);
 * use `formatMult` for the one combined number on a card.
 */
export function formatMultExact(n) {
  const v = Number.isFinite(n) ? n : 0;
  if (Math.abs(v) >= 10000) return formatNum(v);
  return String(Math.round(Number((v * 100).toPrecision(12))) / 100);
}

/**
 * A MULTIPLIER, NOT A COUNT. `formatNum` rounds to a whole number below 10,000 — correct for wins
 * and XP, and wrong for every "×" on the screen: a ×1.6 payout printed as "×2" and a ×1.4 printed
 * as "×1", so the card claimed a bonus the game did not pay and then claimed no bonus at all.
 * Both are the same defect, and "×1" is the worse one: it reads as "this upgrade does nothing".
 *
 * ONE decimal, trailing .0 stripped — 1.6 → "1.6", 2 → "2", 1.45 → "1.5".
 *
 * THE ONE EXTRA RULE: if one decimal would round a real bonus away to a whole number, keep a
 * second. MOMENTUM is +1% a buy, so a player forty purchases in is on ×1.4 (fine) and one buy in
 * is on ×1.01 — which at one decimal is "×1" again, the exact bug this function exists to fix,
 * just further down the scale. Above 10,000 it hands off to formatNum so the rebirth ladder
 * (3^20) stays "3.49B" rather than a ten-digit number with a pointless ".0" on it.
 *
 * NEVER use formatNum for a multiplier.
 */
export function formatMult(n) {
  const v = Number.isFinite(n) ? n : 0;
  if (Math.abs(v) >= 10000) return formatNum(v);
  // toPrecision before rounding: 1.45 * 10 is 14.499999999999998 in float64, so a plain
  // Math.round would give "1.4" for a number the caller wrote as 1.45.
  const r1 = Math.round(Number((v * 10).toPrecision(12))) / 10;
  const r = Number.isInteger(r1) && !Number.isInteger(v)
    ? Math.round(Number((v * 100).toPrecision(12))) / 100
    : r1;
  return String(r);
}

/**
 * THE LEVEL BAR AS A PERCENT, ONE DECIMAL (Andy oct3 #5: "bar just isn't moving"). Under
 * PROGRESSION v10 a high level is hundreds of words long, so a whole-number percent sat still for
 * a dozen words; one decimal moves on (almost) every word. FLOORED, never rounded: 99.96% must not
 * print "100.0%" while the level has not happened yet. `frac` is 0..1; out-of-range / NaN clamps.
 */
export function formatPct(frac) {
  const f = Number.isFinite(frac) ? Math.min(1, Math.max(0, frac)) : 0;
  const tenths = Math.floor(Number((f * 1000).toPrecision(12)));
  const shown = f < 1 ? Math.min(tenths, 999) : 1000;
  return `${(shown / 10).toFixed(1)}%`;
}

/**
 * A BAR GAIN as "+X.X%" — `gainFrac` is the gain as a fraction of the level (0.006 → "+0.6%").
 * ANY REAL GAIN SHOWS: a gain > 0 that rounds below a tenth prints "+0.1%", never "+0.0%" (Andy:
 * "a tiny gain still shows at least +0.1%"). A gain of a whole level or more (a multi-level jump)
 * stays a percent of the level it started in, through formatNum past 10,000%. 0 / negative / NaN → ''.
 */
export function formatGainPct(gainFrac) {
  if (!(gainFrac > 0)) return '';
  const pct = gainFrac * 100;
  if (pct >= 10000) return `+${formatNum(pct)}%`;
  const r = Math.round(Number((pct * 10).toPrecision(12))) / 10;
  return `+${Math.max(0.1, r).toFixed(1)}%`;
}
