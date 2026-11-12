// kit.js — HERO COMPONENTS (oct24, Andy: "cooler heroes, frames, and SO MUCH MORE … components? we def lacking
// components rn"). A component is owned ONCE and worn on ANY hero, so a few painted pieces make many looks (Rocket
// League borders + goal explosions). Two slots (the SIDEKICK slot was removed oct26 by Andy; an old
// save's `pet` key / owned sidekick ids are simply ignored on read and dropped on the next write):
//  · FRAME — a painted card frame (public/cards/frame-<id>.webp, ChatGPT, the ELITE / LEGEND frames as the layout
//    reference) that turns your hero in the PROFILE into a framed card. Each frame's art + name-plate windows were
//    measured off the cut (% of the frame). The five MODE frames are the MASTERY ROAD's frame node (masteryRoad.js
//    ROAD_SHAPE[6]) made real: claim it on that mode's road and the frame is yours.
//  · (WIN FX — retired nov2; the `fx` slot reads as empty on every save)
// nov9 (Andy: heroes "cost pure gems", no WINS / rebirth requirements): the sold frames are GEMS ONLY, priced against the
// heroes and the paid packs; road frames are claimed on a mastery road, JACKPOT is won on the wheel. Looks only:
// nothing here changes how a game plays or pays.
import { KIT_CHANGE } from './avatarFrame.js';
import { spendGems } from '../progress/gems.js';
import { itemPurchased } from '../lib/events.js';
import { totalWins } from './cast.js'; // only to grandfather frames earned with wins before nov9

// art / plate = the frame's two windows [x, y, w, h], % of the frame image; ar = its width / height
const F = (id, name, tag, color, ar, art, plate, more) => ({ id, name, tag, color, ar, art, plate, slot: 'frame', ...more });
export const FRAMES = [
  F('frost', 'FROST', 'COLD STREAK', '#2EFFE0', 477 / 855, [17.4, 14.85, 65.83, 53.1], [18.03, 73.22, 64.15, 9.12], { price: 2000, oldWins: 40 }),
  F('graffiti', 'GRAFFITI', 'TAGGED IT', '#FF4FA3', 485 / 821, [16.49, 16.57, 66.8, 55.18], [17.94, 77.22, 63.92, 8.89], { price: 3000, oldWins: 70 }),
  F('flame', 'FLAME', 'ON FIRE. LITERALLY.', '#FF6B3D', 489 / 803, [16.77, 16.94, 67.69, 56.41], [17.79, 78.95, 65.44, 9.59], { price: 4000, oldWins: 110 }),
  F('arcade', 'ARCADE', 'INSERT COIN', '#9A1AFF', 535 / 866, [17.38, 21.25, 64.11, 51.39], [17.76, 76.91, 63.36, 8.66], { price: 6000, rare: true }),
  // MASTERY ROAD frames: earned on that mode's road, never sold
  F('bomb', 'BOMB SQUAD', 'WORD BOMB MASTERY', '#FF6B3D', 497 / 826, [17.51, 21.43, 64.79, 52.91], [18.11, 79.66, 63.58, 9.44], { road: 'word-bomb' }),
  F('bolt', 'LIGHTNING', 'BLITZ MASTERY', '#3DA8FF', 499 / 766, [16.23, 14.88, 64.73, 55.35], [17.84, 75.98, 61.52, 10.18], { road: 'category-blitz' }),
  F('scholar', 'SCHOLAR', 'SAT RUSH MASTERY', '#FFE94A', 544 / 858, [17.28, 16.78, 66.18, 54.55], [19.3, 75.41, 61.76, 8.51], { road: 'sat-rush' }),
  F('chain', 'CHAIN', 'CHAIN MASTERY', '#2EFFE0', 499 / 808, [14.63, 19.93, 67.94, 54.7], [18.04, 79.08, 63.93, 10.27], { road: 'chain' }),
  F('defuser', 'DEFUSER', 'FUSE MASTERY', '#B8F632', 562 / 854, [20.82, 19.2, 58.36, 53.16], [21.17, 76.46, 57.47, 8.78], { road: 'fuse' }),
  // DAILY WHEEL only — painted oct25; windows measured off the cut (its name plate is taller: FitText fills it)
  F('jackpot', 'JACKPOT', 'HIT THE BIG ONE', '#FFC23D', 462 / 866, [19.48, 12.14, 61.04, 52.49], [19.48, 70.52, 61.04, 18.38], { wheel: true, rare: true }),
];
// WIN FX were retired nov2 (Andy: "dont want win fx or sound") — progress/cosmeticsRetire.js refunded the paid ones
// and took them out of every save; the results card keeps its one default burst.
const ALL_KIT = [...FRAMES];
export const kitById = (id) => ALL_KIT.find((k) => k.id === id) || null;
export const kitSrc = (id) => {
  const k = kitById(id);
  if (k && k.slot === 'frame') return `/cards/frame-${id}.webp`;
  return null; // an unknown / retired id has no art
};

// a season-2 key (taw.s2.*), so the save backup / cloud save carry it with the gems paid
export const KIT_KEY = 'taw.s2.kit'; // = avatarFrame.js KIT_KEY
const SLOT_OK = (slot, id) => { const k = kitById(id); return !!k && k.slot === slot; };
// GRANDFATHERED (nov9, once per save): a frame earned with WINS under the old rules is written into the owned list
const KIT_GF_NOV9 = 'taw.s2.kit.gf3';
function grandfatherKitNov9() {
  try {
    if (localStorage.getItem(KIT_GF_NOV9)) return;
    const w = totalWins();
    const keep = FRAMES.filter((k) => k.oldWins != null && w >= k.oldWins).map((k) => k.id);
    if (keep.length) {
      const v = JSON.parse(localStorage.getItem(KIT_KEY) || '{}') || {};
      const own = Array.isArray(v.own) ? v.own : [];
      localStorage.setItem(KIT_KEY, JSON.stringify({ ...v, own: [...new Set([...own, ...keep])] }));
    }
    localStorage.setItem(KIT_GF_NOV9, '1');
  } catch { /* blocked storage */ }
}
export function readKit() {
  grandfatherKitNov9();
  try {
    const v = JSON.parse(localStorage.getItem(KIT_KEY) || '{}');
    const own = Array.isArray(v && v.own) ? v.own.filter((id) => kitById(id)) : [];
    const slot = (k) => (v && SLOT_OK(k, v[k]) ? v[k] : null);
    return { own, frame: slot('frame'), fx: slot('fx') };
  } catch { return { own: [], frame: null, fx: null }; }
}
function writeKit(k) {
  try { localStorage.setItem(KIT_KEY, JSON.stringify(k)); } catch { /* blocked storage */ }
  try { window.dispatchEvent(new Event(KIT_CHANGE)); } catch { /* no window (tests) */ } // the worn-frame portraits (AvatarFrame)
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

/** Earned through play: free, or (a road frame) claimed on its mastery road. A sold frame is only ever bought. */
export function kitEarned(id) {
  const k = kitById(id);
  if (!k) return false;
  if (k.road) return roadClaimed(k.road);
  if (k.wheel) return false; // only ever won on the DAILY WHEEL (grantKit)
  return !k.price;
}
/** Can it be bought? A road or wheel frame never can; every priced one always can. */
export function kitGateMet(id) {
  const k = kitById(id);
  return !!k && !k.road && !k.wheel;
}
export const ownsKit = (id) => !!kitById(id) && (kitEarned(id) || readKit().own.includes(id));

/** Progress toward a frame: none any more (nov9: sold frames are gems only). Kept so callers need no change. */
export function kitProgress() {
  return null;
}

/** THE DAILY WHEEL's cosmetic slot paid out (progress/wheel.js payLanded): a wheel-only piece is now yours. */
export function grantKit(id) {
  const s = kitById(id);
  if (!s || !s.wheel) return false;
  const k = readKit();
  if (!k.own.includes(id)) writeKit({ ...k, own: [...k.own, id] });
  return true;
}

/** The frame you wear (null = none). */
export const equippedFrame = () => readKit().frame;
/** Wear a component you own in its slot, or clear a slot ('frame' | 'fx', id null). Returns false when it isn't yours. */
export function wearKit(slot, id) {
  if (id != null && (!SLOT_OK(slot, id) || !ownsKit(id))) return false;
  const k = readKit();
  writeKit({ ...k, [slot]: id });
  return true;
}
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
    itemPurchased(id, { frame: 'frame', fx: 'winfx' }[s.slot]);
  }
  wearKit(s.slot, id);
  return { ok: true };
}
