// shop.js — the cosmetic shop catalog + ownership + equipped loadout, plus the Key Power
// purchase helpers. IDS ARE STABLE SAVE KEYS — never rename them. Cosmetics are PURE FLAIR
// now (they change pop colour / sound character, NOT XP); the only XP upgrade is Key Power
// (see xp.js). localStorage-backed, wrapped, sensible defaults. Buying deducts from taw.wins
// only (never winsLifetime); purchases are permanent and survive rebirth.
import { getWins, saveWins } from './wins.js';
import { getKeyTier, saveKeyTier, keyTierCost } from './xp.js';
import { getWordSenseTier, saveWordSenseTier, wordSenseCost } from './wordSense.js';

// `blurb` = what the cosmetic changes (its flair). `xpMult` = a permanent XP multiplier the
// cosmetic carries once EQUIPPED — Economy v3 restores cosmetics as a multiplier layer in the
// xpPerInput stack (the free defaults are ×1). Pop style and sound pack stack multiplicatively.
export const POP_STYLES = [
  { id: 'classic', name: 'CLASSIC', price: 0, xpMult: 1.0, blurb: 'Cyan pop' },
  { id: 'chrome', name: 'CHROME', price: 150, xpMult: 1.05, blurb: 'Chrome shine' },
  { id: 'inferno', name: 'INFERNO', price: 400, xpMult: 1.1, blurb: 'Orange blaze' },
  { id: 'void', name: 'VOID', price: 900, xpMult: 1.15, blurb: 'Purple void' },
  { id: 'prism', name: 'PRISM', price: 2000, xpMult: 1.25, blurb: 'Rainbow split' },
];
export const SOUND_PACKS = [
  { id: 'thock', name: 'THOCK', price: 0, xpMult: 1.0, blurb: 'Deep thock' },
  { id: 'clack', name: 'CLACK', price: 0, xpMult: 1.0, blurb: 'Sharp clack' },
  { id: 'cream', name: 'CREAM', price: 0, xpMult: 1.0, blurb: 'Soft cream' },
  { id: 'marble', name: 'MARBLE', price: 250, xpMult: 1.05, blurb: 'Marble click' },
  { id: 'typewriter', name: 'TYPEWRITER', price: 600, xpMult: 1.1, blurb: 'Typewriter' },
  { id: 'silent', name: 'SILENT', price: 1200, xpMult: 1.15, blurb: 'Near silent' },
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

// The XP multiplier carried by an item id (1.0 if unknown / has none). Used to feed the
// xpPerInput stack (Economy v3). Pure lookups over the catalog above.
export function xpMultOf(id) {
  const it = itemById(id);
  return it && Number.isFinite(it.xpMult) && it.xpMult > 0 ? it.xpMult : 1;
}
// The equipped pop-style / sound-pack XP multipliers (read live from the equipped loadout).
export function equippedPopMult() {
  return xpMultOf(getEquipped().popStyle);
}
export function equippedSoundMult() {
  return xpMultOf(getEquipped().soundPack);
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

// Buy the NEXT Key Power TIER: deducts the next tier's cost from wins, bumps taw.keytier by 1.
// Tiers are one at a time — each is a real decision, so there is NO "buy max" (Economy v6).
// Returns { ok, wins, tier, spent }.
export function buyKeyPower() {
  const tier = getKeyTier();
  const cost = keyTierCost(tier); // cost to reach tier+1
  const wins = getWins();
  if (wins < cost) return { ok: false, wins, tier, spent: 0 };
  const nextWins = wins - cost;
  saveWins(nextWins);
  saveKeyTier(tier + 1);
  return { ok: true, wins: nextWins, tier: tier + 1, spent: cost };
}

// Buy the NEXT WORD SENSE TIER (Job 4): deducts the next tier's cost from wins, bumps taw.wordsense
// by 1. One at a time, like KEY POWER. Returns { ok, wins, tier, spent }.
export function buyWordSense() {
  const tier = getWordSenseTier();
  const cost = wordSenseCost(tier); // cost to reach tier+1
  const wins = getWins();
  if (wins < cost) return { ok: false, wins, tier, spent: 0 };
  const nextWins = wins - cost;
  saveWins(nextWins);
  saveWordSenseTier(tier + 1);
  return { ok: true, wins: nextWins, tier: tier + 1, spent: cost };
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
