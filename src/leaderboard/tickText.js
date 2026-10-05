import { formatNum } from '../format.js';

// MARK ROLLS ticker ('roll'): v is a tier CODE, never text — the name comes from this fixed table.
export const ROLL_TICK_TIERS = { 4: 'MYTHIC', 5: 'SECRET' }; // = markRollsCore tierRank('mythic' | 'secret')

// The ticker's ONLY text: fixed templates around a validated {k, n, v} (live.js cleanTick).
export function tickText(t) {
  if (!t) return '';
  if (t.k === 'lv') return `${t.n} just hit LV ${formatNum(t.v)}`;
  if (t.k === 'rank') return `${t.n} took #${formatNum(t.v)}`;
  if (t.k === 'rb') return `${t.n} reached REBIRTH ${formatNum(t.v)}`;
  if (t.k === 'roll' && ROLL_TICK_TIERS[t.v]) return `${t.n} ROLLED ${ROLL_TICK_TIERS[t.v]}`;
  return '';
}
