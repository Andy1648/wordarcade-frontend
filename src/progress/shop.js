// shop.js — the cosmetic shop catalog + ownership + equipped loadout. IDS ARE STABLE SAVE
// KEYS — never rename them. Each item carries an XP multiplier that feeds the single
// multiplier stack (see xp.js xpPerInput). localStorage-backed, wrapped, sensible defaults.
// Buying deducts from taw.wins only (never winsLifetime); purchases are permanent and
// survive rebirth.
import { getWins, saveWins } from './wins.js';

export const POP_STYLES = [
  { id: 'classic', name: 'CLASSIC', price: 0, mult: 1.0 },
  { id: 'chrome', name: 'CHROME', price: 150, mult: 1.05 },
  { id: 'inferno', name: 'INFERNO', price: 400, mult: 1.1 },
  { id: 'void', name: 'VOID', price: 900, mult: 1.15 },
  { id: 'prism', name: 'PRISM', price: 2000, mult: 1.25 },
];
export const SOUND_PACKS = [
  { id: 'thock', name: 'THOCK', price: 0, mult: 1.0 },
  { id: 'clack', name: 'CLACK', price: 0, mult: 1.0 },
  { id: 'cream', name: 'CREAM', price: 0, mult: 1.0 },
  { id: 'marble', name: 'MARBLE', price: 250, mult: 1.05 },
  { id: 'typewriter', name: 'TYPEWRITER', price: 600, mult: 1.1 },
  { id: 'silent', name: 'SILENT', price: 1200, mult: 1.15 },
];

export const OWNED_KEY = 'taw.owned';
export const EQUIPPED_KEY = 'taw.equipped';
const DEFAULT_OWNED = ['classic', 'thock', 'clack', 'cream'];
const DEFAULT_EQUIPPED = { popStyle: 'classic', soundPack: 'thock' };

const ALL = [...POP_STYLES, ...SOUND_PACKS];
const POP_IDS = new Set(POP_STYLES.map((i) => i.id));
const SOUND_IDS = new Set(SOUND_PACKS.map((i) => i.id));
export function itemById(id) {
  return ALL.find((i) => i.id === id) || null;
}
export function itemType(id) {
  if (POP_IDS.has(id)) return 'popStyle';
  if (SOUND_IDS.has(id)) return 'soundPack';
  return null;
}

export function getOwned() {
  const set = new Set(DEFAULT_OWNED);
  try {
    const raw = localStorage.getItem(OWNED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) for (const id of arr) if (itemById(id)) set.add(id);
  } catch {
    /* storage blocked — just the defaults */
  }
  return [...set];
}
export function saveOwned(ids) {
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* storage blocked */
  }
}
export function isOwned(id) {
  return getOwned().includes(id);
}

export function getEquipped() {
  let popStyle = DEFAULT_EQUIPPED.popStyle;
  let soundPack = DEFAULT_EQUIPPED.soundPack;
  try {
    const raw = localStorage.getItem(EQUIPPED_KEY);
    const o = raw ? JSON.parse(raw) : {};
    if (o && POP_IDS.has(o.popStyle)) popStyle = o.popStyle;
    if (o && SOUND_IDS.has(o.soundPack)) soundPack = o.soundPack;
  } catch {
    /* storage blocked — defaults */
  }
  return { popStyle, soundPack };
}
export function saveEquipped(eq) {
  try {
    localStorage.setItem(EQUIPPED_KEY, JSON.stringify(eq));
  } catch {
    /* storage blocked */
  }
}

export function getEquippedSoundPack() {
  return getEquipped().soundPack;
}
export function equippedPopStyleMult() {
  const it = itemById(getEquipped().popStyle);
  return it ? it.mult : 1;
}
export function equippedSoundPackMult() {
  const it = itemById(getEquipped().soundPack);
  return it ? it.mult : 1;
}

// Buy an item: it must exist, not already be owned, and be affordable. Deducts from wins
// ONLY (winsLifetime is untouched). Returns { ok, reason?, wins }.
export function buy(id) {
  const item = itemById(id);
  if (!item) return { ok: false, reason: 'unknown', wins: getWins() };
  if (isOwned(id)) return { ok: false, reason: 'owned', wins: getWins() };
  const wins = getWins();
  if (wins < item.price) return { ok: false, reason: 'unaffordable', wins };
  const next = wins - item.price;
  saveWins(next); // spendable balance only — never winsLifetime
  saveOwned([...getOwned(), id]);
  return { ok: true, wins: next };
}

// Equip an OWNED item (instant + free) into its type's slot. Returns true on success.
export function equip(id) {
  if (!isOwned(id)) return false;
  const type = itemType(id);
  if (!type) return false;
  const eq = getEquipped();
  eq[type] = id;
  saveEquipped(eq);
  return true;
}
