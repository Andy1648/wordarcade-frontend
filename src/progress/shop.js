// shop.js — the cosmetic shop catalog + ownership + equipped loadout, plus the Key Power
// purchase helpers. IDS ARE STABLE SAVE KEYS — never rename them. Cosmetics are PURE FLAIR
// now (they change pop colour / sound character, NOT XP); the only XP upgrade is Key Power
// (see xp.js). localStorage-backed, wrapped, sensible defaults. Buying deducts from taw.wins
// only (never winsLifetime); purchases are permanent and survive rebirth.
import { getWins, saveWins } from './wins.js';
import { getKeyPower, saveKeyPower, keyPowerCost } from './xp.js';

// `blurb` = what the cosmetic actually changes (shown on the card instead of an XP figure).
export const POP_STYLES = [
  { id: 'classic', name: 'CLASSIC', price: 0, blurb: 'Cyan pop' },
  { id: 'chrome', name: 'CHROME', price: 150, blurb: 'Chrome shine' },
  { id: 'inferno', name: 'INFERNO', price: 400, blurb: 'Orange blaze' },
  { id: 'void', name: 'VOID', price: 900, blurb: 'Purple void' },
  { id: 'prism', name: 'PRISM', price: 2000, blurb: 'Rainbow split' },
];
export const SOUND_PACKS = [
  { id: 'thock', name: 'THOCK', price: 0, blurb: 'Deep thock' },
  { id: 'clack', name: 'CLACK', price: 0, blurb: 'Sharp clack' },
  { id: 'cream', name: 'CREAM', price: 0, blurb: 'Soft cream' },
  { id: 'marble', name: 'MARBLE', price: 250, blurb: 'Marble click' },
  { id: 'typewriter', name: 'TYPEWRITER', price: 600, blurb: 'Typewriter' },
  { id: 'silent', name: 'SILENT', price: 1200, blurb: 'Near silent' },
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

// Buy ONE Key Power level: deducts the next-level cost from wins, bumps taw.keypower.
// Returns { ok, wins, level, spent }.
export function buyKeyPower() {
  const level = getKeyPower();
  const cost = keyPowerCost(level);
  const wins = getWins();
  if (wins < cost) return { ok: false, wins, level, spent: 0 };
  const nextWins = wins - cost;
  saveWins(nextWins);
  saveKeyPower(level + 1);
  return { ok: true, wins: nextWins, level: level + 1, spent: cost };
}

// Buy AS MANY Key Power levels as the current wins balance affords, in one action. Returns
// { ok, bought, spent, wins, level }.
export function buyKeyPowerMax() {
  let level = getKeyPower();
  let wins = getWins();
  let spent = 0;
  let bought = 0;
  while (wins >= keyPowerCost(level)) {
    const cost = keyPowerCost(level);
    wins -= cost;
    spent += cost;
    level += 1;
    bought += 1;
  }
  if (bought > 0) {
    saveKeyPower(level);
    saveWins(wins);
  }
  return { ok: bought > 0, bought, spent, wins, level };
}

// True when the player can afford at least one item they don't already own — drives the
// menu wins-chip's "something to buy" dot. Pure given wins/owned (defaults read live).
export function canAffordAny(wins = getWins(), owned = getOwned()) {
  const ownedSet = new Set(owned);
  const bal = Number.isFinite(wins) ? wins : 0;
  return ALL.some((it) => !ownedSet.has(it.id) && bal >= it.price);
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
