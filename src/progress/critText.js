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
  // GEAR POOL v2: EVERY Nth KEY CRITS makes 1 key in N a sure crit; the others still roll `rate`
  const every = Number.isFinite(totals.every) && totals.every >= 1 ? Math.floor(totals.every) : 0;
  const eff = every ? 1 / every + (1 - 1 / every) * rate : rate;
  if (!eff) return { on: false, head, value, sub: 'ROLL A RARE+ GEAR', rate, power, oneIn: null, avg: 0 };
  const oneIn = critOneIn(eff);
  const avg = critAvgGain({ rate: eff, power });
  return { on: true, head, value, sub: `1 KEY IN ${formatNum(oneIn)} CRITS · +${pct(avg)} XP ON AVERAGE`, rate, power, oneIn, avg };
}
// (GEAR TILE v2, Andy oct9: the card's one-line CRIT band is gone — the tile shows a pip per extra stat and the full
// critLines live in the INDEX detail sheet and the roll result.)
