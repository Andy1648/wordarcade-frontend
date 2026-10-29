// v3/shopDots.js — THE SHOP's NEW-THING DOTS (Andy oct28 "add notification dot not just on menu screen for shop but inside
// as well (boost, looks)"). One source of truth for the menu's UPGRADES dot AND the shelf tabs inside the shop:
//   BOOSTS — today's free chest is waiting, OR a fresh hourly restock you haven't looked at holds something you can pay for;
//   LOOKS  — a pop style / sound pack you don't own became affordable since you last opened LOOKS.
// Opening a shelf marks it SEEN (the restock window / the affordable look ids at that moment), so a dot means NEW, never
// "you have gems" forever. Pure reads of the live stores + two small seen-keys; changes fire SHOP_DOTS_CHANGE.
import { S2_PREFIX } from './store.js';
import { STOCK, stockLeft, windowOf } from './stock.js';
import { dropReady } from './dailyDrop.js';
import { itemGemPrice } from './hooks.js';
import { POP_STYLES, SOUND_PACKS, getOwned } from '../shop.js';

export const SEEN_BOOSTS_KEY = `${S2_PREFIX}shopseen.boosts`; // the restock window last looked at
export const SEEN_LOOKS_KEY = `${S2_PREFIX}shopseen.looks`; // [ids] affordable when LOOKS was last opened
export const SHOP_DOTS_CHANGE = 'taw:shop-dots-change';

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* blocked storage */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SHOP_DOTS_CHANGE));
};

/** The looks you could buy right now (not owned, a real price, within the gem balance). */
export function affordableLooks(gems) {
  const owned = new Set(getOwned());
  return [...POP_STYLES, ...SOUND_PACKS].filter((it) => {
    const p = itemGemPrice(it.id);
    return !owned.has(it.id) && p > 0 && gems >= p;
  }).map((it) => it.id);
}

/** LOOKS dot: an affordable look you haven't seen on the shelf yet. */
export function looksNew(gems) {
  const seen = new Set(read(SEEN_LOOKS_KEY) || []);
  return affordableLooks(gems).some((id) => !seen.has(id));
}
export function markLooksSeen(gems) {
  const seen = new Set(read(SEEN_LOOKS_KEY) || []);
  const now = affordableLooks(gems);
  if (now.every((id) => seen.has(id))) return;
  write(SEEN_LOOKS_KEY, [...new Set([...seen, ...now])]);
}

/** A boost on this window's shelf you can pay for (in stock, within the gem balance). */
export function boostAffordable(gems, now = Date.now()) {
  const left = stockLeft(now);
  return STOCK.some((it) => (left[it.id] || 0) > 0 && it.buyable !== false && gems >= it.price);
}
/** BOOSTS dot: the free chest, or an unseen restock with something buyable on it. */
export function boostsNew(gems, now = Date.now()) {
  if (dropReady(now)) return true;
  const seen = read(SEEN_BOOSTS_KEY);
  return seen !== windowOf(now) && boostAffordable(gems, now);
}
export function markBoostsSeen(now = Date.now()) {
  if (read(SEEN_BOOSTS_KEY) === windowOf(now)) return;
  write(SEEN_BOOSTS_KEY, windowOf(now));
}
