// shop.js — the cosmetic shop catalog + ownership + equipped loadout, plus the Key Power
// purchase helpers. IDS ARE STABLE SAVE KEYS — never rename them. Cosmetics are PURE FLAIR
// now (they change pop colour / sound character, NOT XP); the only XP upgrade is Key Power
// (see xp.js). localStorage-backed, wrapped, sensible defaults. Buying deducts from taw.wins
// only (never winsLifetime); purchases are permanent and survive rebirth.
import { getWins, saveWins } from './wins.js';
import { getKeyTier, saveKeyTier, keyTierCost } from './xp.js';
import { forgeBuys, forgeCost, forgeOne, markForgePop } from './forge.js';
import { layerOpen } from './claims.js';
import { THEMES, isThemeOwned } from '../theme/themes.js';

// `blurb` = what the cosmetic changes (its flair). `xpMult` = a permanent XP multiplier the
// cosmetic carries once EQUIPPED — Economy v3 restores cosmetics as a multiplier layer in the
// xpPerInput stack (the free defaults are ×1). Pop style and sound pack stack multiplicatively.
// PRICES /10 (Economy v8): wins are the word's XP ÷ 10 now, so the whole currency was restated
// an order of magnitude smaller and every price followed it down. The LADDER is untouched.
// COSMETIC PRICES ARE AN EXPONENTIAL LADDER (Economy v7). v6 priced them 150 / 400 / 900 / 2000
// - roughly linear steps against an income that compounds, so the whole cosmetic sink was cleared
// inside the first hour and then paid for nothing for the remaining 199. One ×COSMETIC_PRICE_STEP (6, v9) ladder per list,
// from a base that is one good round: every rung costs six of the last one, so the last item in
// each list stays a genuine goal instead of pocket change.
export const COSMETIC_PRICE_STEP = 5; // oct2: ×5 a rung from a ×100 base — top pop ~2.9e11, under the 1e12 readability cap
export const POP_PRICE_BASE = 6000; // oct2 (Andy: "pop styles/sound packs cost MORE"): ×10 the v9 base — each rung is minutes of play, not seconds
export const SOUND_PRICE_BASE = 10000; // oct2: ×10 the v9 base (3 packs stay free)
/** The i-th PAID rung of a ladder (i = 1 for the first paid item). */
export function cosmeticPrice(base, i) {
  return Math.round(base * Math.pow(COSMETIC_PRICE_STEP, Math.max(0, i - 1)));
}
export const POP_STYLES = [
  { id: 'classic', name: 'CLASSIC', price: 0, xpMult: 1.0, blurb: 'Cyan pop' },
  { id: 'chrome', name: 'CHROME', price: cosmeticPrice(POP_PRICE_BASE, 1), xpMult: 1.05, blurb: 'Chrome shine' },
  { id: 'inferno', name: 'INFERNO', price: cosmeticPrice(POP_PRICE_BASE, 2), xpMult: 1.1, blurb: 'Orange blaze' },
  { id: 'void', name: 'VOID', price: cosmeticPrice(POP_PRICE_BASE, 3), xpMult: 1.15, blurb: 'Purple void' },
  { id: 'prism', name: 'PRISM', price: cosmeticPrice(POP_PRICE_BASE, 4), xpMult: 1.25, blurb: 'Rainbow split' },
  // STEP 19 / Andy A6: the ladder keeps going, ×5 a rung, so a late-game player always has a next pop
  // to chase (v8 ended at 7,500 wins — pocket change by L100).
  { id: 'toxic', name: 'TOXIC', price: cosmeticPrice(POP_PRICE_BASE, 5), xpMult: 1.35, blurb: 'Acid green' },
  { id: 'ember', name: 'EMBER', price: cosmeticPrice(POP_PRICE_BASE, 6), xpMult: 1.45, blurb: 'Hot coals' },
  { id: 'frost', name: 'FROST', price: cosmeticPrice(POP_PRICE_BASE, 7), xpMult: 1.6, blurb: 'Ice blue' },
  { id: 'gold', name: 'GOLD', price: cosmeticPrice(POP_PRICE_BASE, 8), xpMult: 1.75, blurb: 'Solid gold' },
  { id: 'plasma', name: 'PLASMA', price: cosmeticPrice(POP_PRICE_BASE, 9), xpMult: 1.95, blurb: 'Pink plasma' },
  { id: 'nova', name: 'NOVA', price: cosmeticPrice(POP_PRICE_BASE, 10), xpMult: 2.2, blurb: 'Star white' },
  { id: 'eclipse', name: 'ECLIPSE', price: cosmeticPrice(POP_PRICE_BASE, 11), xpMult: 2.5, blurb: 'Black sun' },
  { id: 'legend', name: 'LEGEND', price: cosmeticPrice(POP_PRICE_BASE, 12), xpMult: 3.0, blurb: 'The last pop' },
];
export const SOUND_PACKS = [
  { id: 'thock', name: 'THOCK', price: 0, xpMult: 1.0, blurb: 'Deep thock' },
  { id: 'clack', name: 'CLACK', price: 0, xpMult: 1.0, blurb: 'Sharp clack' },
  { id: 'cream', name: 'CREAM', price: 0, xpMult: 1.0, blurb: 'Soft cream' },
  { id: 'marble', name: 'MARBLE', price: cosmeticPrice(SOUND_PRICE_BASE, 1), xpMult: 1.05, blurb: 'Marble click' },
  { id: 'typewriter', name: 'TYPEWRITER', price: cosmeticPrice(SOUND_PRICE_BASE, 2), xpMult: 1.1, blurb: 'Typewriter' },
  { id: 'silent', name: 'SILENT', price: cosmeticPrice(SOUND_PRICE_BASE, 3), xpMult: 1.15, blurb: 'Near silent' },
  { id: 'arcade', name: 'ARCADE', price: cosmeticPrice(SOUND_PRICE_BASE, 4), xpMult: 1.25, blurb: 'Coin-op click' },
  { id: 'vinyl', name: 'VINYL', price: cosmeticPrice(SOUND_PRICE_BASE, 5), xpMult: 1.35, blurb: 'Warm crackle' },
  { id: 'glass', name: 'GLASS', price: cosmeticPrice(SOUND_PRICE_BASE, 6), xpMult: 1.5, blurb: 'Glass tap' },
  { id: 'steel', name: 'STEEL', price: cosmeticPrice(SOUND_PRICE_BASE, 7), xpMult: 1.7, blurb: 'Steel switch' },
  { id: 'bass', name: 'BASS', price: cosmeticPrice(SOUND_PRICE_BASE, 8), xpMult: 1.95, blurb: 'Sub thump' },
  { id: 'crystal', name: 'CRYSTAL', price: cosmeticPrice(SOUND_PRICE_BASE, 9), xpMult: 2.3, blurb: 'Crystal ping' },
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
  // Andy oct2: buying a cosmetic EQUIPS it — you bought it to see/hear it.
  equip(id);
  return { ok: true, wins: next, equipped: true };
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

// LETTER FORGE (forge.js — replaced MOMENTUM, Andy oct2): buy ONE forge — deduct the (rising)
// price, forge the next letter. Uncapped: there is always a next letter level. `count` in the
// result is the new total buys; `letter`/`level` say what was forged.
export function buyForge() {
  const count = forgeBuys();
  const cost = forgeCost(count);
  const wins = getWins();
  if (wins < cost) return { ok: false, wins, count, spent: 0 };
  const nextWins = wins - cost;
  saveWins(nextWins);
  const f = forgeOne();
  markForgePop(f.letter); // the menu rail pops the newly forged letter once
  return { ok: true, wins: nextWins, count: count + 1, spent: cost, letter: f.letter, level: f.level };
}

// True when the player can afford at least one thing they don't already own — drives the
// menu wins-chip's "something to buy" dot. Counts EVERYTHING purchasable, not just cosmetics:
// the dot used to go dark forever once a player owned all 11 cosmetics, even though Key Power,
// Momentum and buyable themes were still affordable. `wins`/`owned` are injectable
// for the cosmetic layer; the other sinks read their own live stores (guarded, sane defaults).
export function canAffordAny(wins = getWins(), owned = getOwned()) {
  const ownedSet = new Set(owned);
  const bal = Number.isFinite(wins) ? wins : 0;
  // Cosmetics (pop styles + sound packs).
  if (ALL.some((it) => !ownedSet.has(it.id) && bal >= it.price)) return true;
  // Key Power — the cost ladder extrapolates forever, so there is always a next tier to buy.
  const kCost = keyTierCost(getKeyTier());
  if (Number.isFinite(kCost) && bal >= kCost) return true;
  // LETTER FORGE — uncapped, so there is always a next forge to buy (once it has been revealed).
  if ((layerOpen('forge') || forgeBuys() > 0) && bal >= forgeCost(forgeBuys())) return true;
  // Buyable menu themes (priced, not yet owned or level-granted).
  if (THEMES.some((t) => t.price > 0 && !isThemeOwned(t.id) && bal >= t.price)) return true;
  return false;
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
