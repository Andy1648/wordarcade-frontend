// kit.js — HERO COMPONENTS (oct24, Andy: "cooler heroes, frames, and SO MUCH MORE … components? we def lacking
// components rn"). A component is owned ONCE and worn on ANY hero, so a few painted pieces make many looks (Among Us
// pets, Fortnite back bling, Valorant gun buddies). First slot: the SIDEKICK — a small painted pet that stands at your
// hero's feet wherever your hero is drawn big (profile showcase, hero preview, results). Each sidekick is two painted
// frames (public/cast/kit/<id>-0/1.webp, ChatGPT, one matched 3x2 sheet per frame — rest + action) that it flips
// between now and then. Earned with WINS like the crew (gems skip the wait); TURBO is the rare one behind a rebirth.
// Looks only: nothing here changes how a game plays or pays.
import { getRebirths } from '../progress/xp.js';
import { spendGems } from '../progress/gems.js';
import { itemPurchased } from '../lib/events.js';
import { totalWins } from './cast.js';

export const SIDEKICKS = [
  { id: 'pup', name: 'BOMB PUP', tag: 'GOOD BOY. HIGHLY EXPLOSIVE.', color: '#2EFFE0' },
  { id: 'inky', name: 'INKY', tag: 'GETS EVERYWHERE', color: '#9A1AFF', wins: 15, price: 400 },
  { id: 'ducky', name: 'DUCKY', tag: 'TOO COOL TO QUACK', color: '#FFE94A', wins: 30, price: 500 },
  { id: 'worm', name: 'BOOKWORM', tag: 'HAS READ THE DICTIONARY. TWICE.', color: '#B8F632', wins: 50, price: 650 },
  { id: 'pixel', name: 'PIXEL', tag: 'RUNS ON 8 BITS OF JOY', color: '#2EFFE0', wins: 80, price: 900 },
  // the rare one: a rebirth gate, then gems (like a LEGEND hero)
  { id: 'turbo', name: 'TURBO', tag: 'FASTEST SNAIL ALIVE', color: '#FF6B3D', reb: 3, price: 1500, rare: true },
];
export const kitById = (id) => SIDEKICKS.find((k) => k.id === id) || null;
export const kitSrc = (id, frame = 0) => `/cast/kit/${id}-${frame}.webp`;

// a season-2 key (taw.s2.*), so the save backup / cloud save carry it with the gems paid
export const KIT_KEY = 'taw.s2.kit';
export function readKit() {
  try {
    const v = JSON.parse(localStorage.getItem(KIT_KEY) || '{}');
    const own = Array.isArray(v && v.own) ? v.own.filter((id) => kitById(id)) : [];
    return { own, pet: v && kitById(v.pet) ? v.pet : null };
  } catch { return { own: [], pet: null }; }
}
function writeKit(k) {
  try { localStorage.setItem(KIT_KEY, JSON.stringify(k)); } catch { /* blocked storage */ }
}

/** Earned through play: its WINS count reached (a rebirth-gated one is never earned — it is bought once the gate opens). */
export function kitEarned(id) {
  const k = kitById(id);
  if (!k) return false;
  if (!k.price) return true;
  try { return k.wins != null && totalWins() >= k.wins; } catch { return false; }
}
/** Can it be bought yet? Only a rebirth-gated sidekick has a gate. */
export function kitGateMet(id) {
  const k = kitById(id);
  if (!k || k.reb == null) return true;
  try { return (getRebirths() || 0) >= k.reb; } catch { return false; }
}
export const ownsKit = (id) => !!kitById(id) && (kitEarned(id) || readKit().own.includes(id));

/** Progress toward an earnable / gated one: { have, need, label, gate? } or null. */
export function kitProgress(id) {
  const k = kitById(id);
  if (!k || !k.price) return null;
  try {
    if (k.reb != null) return { have: Math.min(getRebirths() || 0, k.reb), need: k.reb, label: 'REBIRTHS TO UNLOCK', gate: true };
    if (k.wins != null) return { have: Math.min(totalWins(), k.wins), need: k.wins, label: 'WINS' };
  } catch { /* a broken store reads as zero */ }
  return null;
}

/** The sidekick you wear (null = none). */
export const equippedPet = () => readKit().pet;
/** Wear a sidekick you own (null takes it off). Returns false when it isn't yours. */
export function equipPet(id) {
  if (id != null && !ownsKit(id)) return false;
  const k = readKit();
  writeKit({ ...k, pet: id });
  return true;
}
/** Buy + wear a sidekick with gems (you see exactly what you buy — never a loot box). { ok, reason? }: 'unknown' |
 *  'locked' (its rebirth gate) | 'unaffordable'. One you already have just goes on. */
export function buyKit(id) {
  const s = kitById(id);
  if (!s) return { ok: false, reason: 'unknown' };
  if (!ownsKit(id)) {
    if (!kitGateMet(id)) return { ok: false, reason: 'locked' };
    if (!spendGems(s.price)) return { ok: false, reason: 'unaffordable' };
    const k = readKit();
    writeKit({ ...k, own: [...k.own, id] });
    itemPurchased(id, 'sidekick');
  }
  equipPet(id);
  return { ok: true };
}
