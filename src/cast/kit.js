// kit.js — HERO COMPONENTS (oct24, Andy: "cooler heroes, frames, and SO MUCH MORE … components? we def lacking
// components rn"). A component is owned ONCE and worn on ANY hero, so a few painted pieces make many looks (Among Us
// pets, Fortnite back bling, Rocket League borders). Two slots:
//  · SIDEKICK — a small painted pet that stands at your hero's feet wherever your hero is drawn big (profile showcase,
//    the WIN results card). Two painted frames each (public/cast/kit/<id>-0/1.webp — rest + action, ChatGPT, one
//    matched 3x2 sheet per frame) that it flips between now and then.
//  · FRAME — a painted card frame (public/cards/frame-<id>.webp, ChatGPT, the ELITE / LEGEND frames as the layout
//    reference) that turns your hero in the PROFILE into a framed card. Each frame's art + name-plate windows were
//    measured off the cut (% of the frame). The five MODE frames are the MASTERY ROAD's frame node (masteryRoad.js
//    ROAD_SHAPE[6]) made real: claim it on that mode's road and the frame is yours.
// Earned with WINS like the crew (gems skip the wait); the rare ones sit behind a rebirth, then gems. Looks only:
// nothing here changes how a game plays or pays.
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
].map((k) => ({ ...k, slot: 'pet' }));

// art / plate = the frame's two windows [x, y, w, h], % of the frame image; ar = its width / height
const F = (id, name, tag, color, ar, art, plate, more) => ({ id, name, tag, color, ar, art, plate, slot: 'frame', ...more });
export const FRAMES = [
  F('frost', 'FROST', 'COLD STREAK', '#2EFFE0', 477 / 855, [17.4, 14.85, 65.83, 53.1], [18.03, 73.22, 64.15, 9.12], { wins: 40, price: 600 }),
  F('graffiti', 'GRAFFITI', 'TAGGED IT', '#FF4FA3', 485 / 821, [16.49, 16.57, 66.8, 55.18], [17.94, 77.22, 63.92, 8.89], { wins: 70, price: 800 }),
  F('flame', 'FLAME', 'ON FIRE. LITERALLY.', '#FF6B3D', 489 / 803, [16.77, 16.94, 67.69, 56.41], [17.79, 78.95, 65.44, 9.59], { wins: 110, price: 1000 }),
  F('arcade', 'ARCADE', 'INSERT COIN', '#9A1AFF', 535 / 866, [17.38, 21.25, 64.11, 51.39], [17.76, 76.91, 63.36, 8.66], { reb: 2, price: 1500, rare: true }),
  // MASTERY ROAD frames: earned on that mode's road, never sold
  F('bomb', 'BOMB SQUAD', 'WORD BOMB MASTERY', '#FF6B3D', 497 / 826, [17.51, 21.43, 64.79, 52.91], [18.11, 79.66, 63.58, 9.44], { road: 'word-bomb' }),
  F('bolt', 'LIGHTNING', 'BLITZ MASTERY', '#3DA8FF', 499 / 766, [16.23, 14.88, 64.73, 55.35], [17.84, 75.98, 61.52, 10.18], { road: 'category-blitz' }),
  F('scholar', 'SCHOLAR', 'SAT RUSH MASTERY', '#FFE94A', 544 / 858, [17.28, 16.78, 66.18, 54.55], [19.3, 75.41, 61.76, 8.51], { road: 'sat-rush' }),
  F('chain', 'CHAIN', 'CHAIN MASTERY', '#2EFFE0', 499 / 808, [14.63, 19.93, 67.94, 54.7], [18.04, 79.08, 63.93, 10.27], { road: 'chain' }),
  F('defuser', 'DEFUSER', 'FUSE MASTERY', '#B8F632', 562 / 854, [20.82, 19.2, 58.36, 53.16], [21.17, 76.46, 57.47, 8.78], { road: 'fuse' }),
];
const ALL_KIT = [...SIDEKICKS, ...FRAMES];
export const kitById = (id) => ALL_KIT.find((k) => k.id === id) || null;
export const kitSrc = (id, frame = 0) => {
  const k = kitById(id);
  return k && k.slot === 'frame' ? `/cards/frame-${id}.webp` : `/cast/kit/${id}-${frame}.webp`;
};

// a season-2 key (taw.s2.*), so the save backup / cloud save carry it with the gems paid
export const KIT_KEY = 'taw.s2.kit';
const SLOT_OK = (slot, id) => { const k = kitById(id); return !!k && k.slot === slot; };
export function readKit() {
  try {
    const v = JSON.parse(localStorage.getItem(KIT_KEY) || '{}');
    const own = Array.isArray(v && v.own) ? v.own.filter((id) => kitById(id)) : [];
    return { own, pet: v && SLOT_OK('pet', v.pet) ? v.pet : null, frame: v && SLOT_OK('frame', v.frame) ? v.frame : null };
  } catch { return { own: [], pet: null, frame: null }; }
}
function writeKit(k) {
  try { localStorage.setItem(KIT_KEY, JSON.stringify(k)); } catch { /* blocked storage */ }
}

// the MASTERY ROAD's claims (masteryRoad.js ROAD_KEY = { mode: [node index …] }) read straight from storage so this file
// never pulls the road / mastery modules into the results chunk; ROAD_FRAME_NODE = ROAD_SHAPE's frame node (kit.test.js)
export const ROAD_KEY = 'taw.s2.road';
export const ROAD_FRAME_NODE = 6;
function roadClaimed(mode) {
  try {
    const o = JSON.parse(localStorage.getItem(ROAD_KEY) || '{}');
    return !!o && Array.isArray(o[mode]) && o[mode].includes(ROAD_FRAME_NODE);
  } catch { return false; }
}

/** Earned through play: free, its WINS count reached, or (a road frame) claimed on its mastery road. A rebirth-gated
 *  one is never earned — it is bought once the gate opens. */
export function kitEarned(id) {
  const k = kitById(id);
  if (!k) return false;
  if (k.road) return roadClaimed(k.road);
  if (!k.price) return true;
  try { return k.wins != null && totalWins() >= k.wins; } catch { return false; }
}
/** Can it be bought yet? A road frame never can; a rebirth-gated one once its rebirth is reached. */
export function kitGateMet(id) {
  const k = kitById(id);
  if (!k || k.road) return false;
  if (k.reb == null) return true;
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
/** The frame you wear (null = none). */
export const equippedFrame = () => readKit().frame;
/** Wear a component you own in its slot, or clear a slot ('pet' | 'frame', id null). Returns false when it isn't yours. */
export function wearKit(slot, id) {
  if (id != null && (!SLOT_OK(slot, id) || !ownsKit(id))) return false;
  const k = readKit();
  writeKit({ ...k, [slot]: id });
  return true;
}
export const equipPet = (id) => wearKit('pet', id);
/** Buy + wear a component with gems (you see exactly what you buy — never a loot box). { ok, reason? }: 'unknown' |
 *  'locked' (its rebirth gate, or a road frame — never sold) | 'unaffordable'. One you already have just goes on. */
export function buyKit(id) {
  const s = kitById(id);
  if (!s) return { ok: false, reason: 'unknown' };
  if (!ownsKit(id)) {
    if (!kitGateMet(id)) return { ok: false, reason: 'locked' };
    if (!spendGems(s.price)) return { ok: false, reason: 'unaffordable' };
    const k = readKit();
    writeKit({ ...k, own: [...k.own, id] });
    itemPurchased(id, s.slot === 'frame' ? 'frame' : 'sidekick');
  }
  wearKit(s.slot, id);
  return { ok: true };
}
