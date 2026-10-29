// v3/shopDots.js — THE SHOP's NEW-THING DOTS (Andy oct28 "add notification dot not just on menu screen for shop but inside
// as well (boost, looks)"). One source of truth for the menu's UPGRADES dot AND the shelf tabs inside the shop:
//   BOOSTS — today's free chest is waiting (the menu's long-standing chest dot, now on its shelf tab too);
//   LOOKS  — a pop style / sound pack you don't own became affordable since you last opened LOOKS.
// Opening LOOKS marks the affordable ids SEEN, so its dot means NEW, never "you have gems" forever. (An hourly-restock
// nudge was tried and cut: it kept the menu dot lit every hour and was invisible inside, on the shelf you open on.)
// Pure reads of the live stores + one small seen-key; changes fire SHOP_DOTS_CHANGE.
import { S2_PREFIX } from './store.js';
import { dropReady } from './dailyDrop.js';
import { itemGemPrice } from './hooks.js';
import { POP_STYLES, SOUND_PACKS, getOwned } from '../shop.js';

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

/** BOOSTS dot: today's free chest is waiting. */
export const boostsNew = (now = Date.now()) => dropReady(now);

/** The menu's UPGRADES dot (Homepage): calls `cb(new?)` now and on every change; returns the unsubscribe. In the v3
 *  install chunk, not the menu's, so the menu carries one line for it (payload ratchet). */
export function watchShopNew(gems, cb) {
  const re = () => cb(boostsNew() || looksNew(gems));
  re();
  const evs = [[window, SHOP_DOTS_CHANGE], [window, 'taw:drop-change'], [document, 'visibilitychange']];
  for (const [t, e] of evs) t.addEventListener(e, re);
  return () => { for (const [t, e] of evs) t.removeEventListener(e, re); };
}
