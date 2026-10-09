// critText.js — CRIT's WORDS (Andy oct8): what the STATS row, the gear card band and the INDEX / roll-result lines
// print. PURE. Split from crit.js so the menu's eager chunk carries only the ROLL (payload ratchet); these load with
// the screens that print them (STATS, ROLL, INDEX).
import { formatNum, formatRate, formatMultExact } from '../format.js';
import { critAvgGain, critOneIn } from './crit.js';

const rate01 = (r) => (Number.isFinite(r) && r > 0 ? Math.min(1, r) : 0);
const powerOf = (p) => (Number.isFinite(p) && p > 0 ? p : 1);
const pct = (frac) => `${formatRate(frac * 100)}%`;
/** "12%" — a crit rate as the screen prints it (one decimal when it is real: 2.4%). */
export const critPctText = (rate) => pct(rate01(rate));
/** "×2.5" — the total crit power. */
export const critPowerText = (power) => `×${formatMultExact(powerOf(power))}`;

/**
 * A gear's EXTRA lines, in the crit yellow under its MAIN stat: ["+6% CRIT RATE", "+0.5× CRIT POWER"] (each only when
 * the gear has it). `stats` = critStatsOf(id, state).
 */
export function critLines(stats) {
  const out = [];
  if (!stats) return out;
  if (stats.rate > 0) out.push({ id: 'rate', num: `+${pct(stats.rate)}`, kind: 'CRIT RATE' });
  if (stats.power > 0) out.push({ id: 'power', num: `+${formatMultExact(stats.power)}×`, kind: 'CRIT POWER' });
  return out;
}

/**
 * The STATS screen's CRIT row: { on, head, value, sub } —
 *   on   "CRIT 12% · ×2.5"   "1 KEY IN 8 CRITS · +18% XP ON AVERAGE"
 *   off  "CRIT 0% · ×2"      "ROLL A RARE+ GEAR"
 * `totals` = critTotals().
 */
export function critSummary(totals = {}) {
  const rate = rate01(totals.rate);
  const power = powerOf(totals.power);
  const value = `${pct(rate)} · ${critPowerText(power)}`;
  const head = `CRIT ${value}`;
  if (!rate) return { on: false, head, value, sub: 'ROLL A RARE+ GEAR', rate, power, oneIn: null, avg: 0 };
  const oneIn = critOneIn(rate);
  const avg = critAvgGain({ rate, power });
  return { on: true, head, value, sub: `1 KEY IN ${formatNum(oneIn)} CRITS · +${pct(avg)} XP ON AVERAGE`, rate, power, oneIn, avg };
}

/**
 * The gear CARD's one-line CRIT band (the 180-wide card drawing has room for one line): "CRIT +6% · +0.5×" (rate +
 * power), "CRIT RATE +2%" (rate only), '' for none. The full named lines (critLines) are on the roll result and the
 * INDEX detail sheet.
 */
export function critCardText(stats) {
  if (!stats) return '';
  const r = stats.rate > 0 ? `+${pct(stats.rate)}` : '';
  const p = stats.power > 0 ? `+${formatMultExact(stats.power)}×` : '';
  if (r && p) return `CRIT ${r} · ${p}`;
  if (r) return `CRIT RATE ${r}`;
  return p ? `CRIT POWER ${p}` : '';
}
