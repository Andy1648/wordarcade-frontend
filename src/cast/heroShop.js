// heroShop.js — buying an ELITE hero with gems (kept forever, never a loot box: you see exactly what you buy).
// Kept apart from cast.js so the cast data stays a tiny, dependency-free import for every screen.
import { ALL_HEROES, HEROES_KEY, ownedHeroes, ownsHero, heroGateMet, writeMain } from './cast.js';
import { spendGems } from '../progress/gems.js';
import { itemPurchased } from '../lib/events.js';

/** Buy + equip a priced hero (an ELITE or a priced crew member). Returns { ok, reason? } — reason 'unknown' |
 *  'unaffordable' | 'locked' (a GOLD not earned yet — GOLD is never for sale — or a LEGEND before its rebirth). A free or already-owned hero just equips. */
export function buyHero(id) {
  const e = ALL_HEROES.find((x) => x.id === id);
  if (!e) return { ok: false, reason: 'unknown' };
  if (e.gold) { if (!ownsHero(id)) return { ok: false, reason: 'locked' }; writeMain(id); return { ok: true }; } // GOLD: earned, never sold
  if (e.chase) { if (!ownsHero(id)) return { ok: false, reason: 'locked' }; writeMain(id); return { ok: true }; } // CHASE: only a drop, never sold
  if (!e.price) { writeMain(id); return { ok: true }; }
  const owned = ownedHeroes();
  if (!owned.includes(id) && !ownsHero(id)) {
    if (!heroGateMet(id)) return { ok: false, reason: 'locked' }; // a LEGEND: its rebirth first, then gems
    if (!spendGems(e.price)) return { ok: false, reason: 'unaffordable' };
    try { localStorage.setItem(HEROES_KEY, JSON.stringify([...owned, id])); } catch { /* blocked storage */ }
    itemPurchased(id, e.elite ? 'elite' : e.legend ? 'legend' : 'hero');
  }
  writeMain(id);
  return { ok: true };
}
