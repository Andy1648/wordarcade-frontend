import { formatNum } from '../format.js';

// MARK ROLLS ticker ('roll'): v is a tier CODE, never text — the name comes from this fixed table.
export const ROLL_TICK_TIERS = { 4: 'MYTHIC', 5: 'SECRET' }; // = markRollsCore tierRank('mythic' | 'secret')

/**
 * The ticker's ONLY text, split so the render can dress the TIER part in its rarity identity (Andy oct5):
 * { lead, tag, rarity } — `lead + tag` is the whole line; `rarity` is a rarity key (src/lib/rarityStyle.js)
 * for `tag`, or null when it has none. Fixed templates around a validated {k, n, v} (live.js cleanTick).
 */
export function tickParts(t) {
  if (!t) return null;
  if (t.k === 'lv') return { lead: `${t.n} just hit LV ${formatNum(t.v)}`, tag: '', rarity: null };
  if (t.k === 'rank') return { lead: `${t.n} took #${formatNum(t.v)}`, tag: '', rarity: null };
  if (t.k === 'rb') return { lead: `${t.n} reached REBIRTH ${formatNum(t.v)}`, tag: '', rarity: null };
  if (t.k === 'roll' && ROLL_TICK_TIERS[t.v]) return { lead: `${t.n} ROLLED `, tag: ROLL_TICK_TIERS[t.v], rarity: ROLL_TICK_TIERS[t.v].toLowerCase() };
  return null;
}

// The ticker's ONLY text: fixed templates around a validated {k, n, v} (live.js cleanTick).
export function tickText(t) {
  const p = tickParts(t);
  return p ? p.lead + p.tag : '';
}
