// heroShop.js — buying an ELITE hero with gems (kept forever, never a loot box: you see exactly what you buy).
// Kept apart from cast.js so the cast data stays a tiny, dependency-free import for every screen.
import { ELITE, HEROES_KEY, ownedElite, writeMain } from './cast.js';
import { spendGems } from '../progress/gems.js';
import { itemPurchased } from '../lib/events.js';

/** Buy + equip an ELITE. Returns { ok, reason? } — reason 'unknown' | 'unaffordable'. Owning it already is ok. */
export function buyHero(id) {
  const e = ELITE.find((x) => x.id === id);
  if (!e) return { ok: false, reason: 'unknown' };
  const owned = ownedElite();
  if (!owned.includes(id)) {
    if (!spendGems(e.price)) return { ok: false, reason: 'unaffordable' };
    try { localStorage.setItem(HEROES_KEY, JSON.stringify([...owned, id])); } catch { /* blocked storage */ }
    itemPurchased(id, 'elite');
  }
  writeMain(id);
  return { ok: true };
}
