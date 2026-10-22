// masteryRoad.js — MODE MASTERY ROADS (Andy oct21: progression should grow through new, NOTICEABLE content, not by
// rescaling the economy). Each mode's mastery track (mastery.js — untouched) gets a visible reward road, like Brawl
// Stars' Trophy Road but one per mode: a fixed list of NODES, each sitting on a mastery level, each paying ONE thing.
//
// CADENCE (claude/mastery-road/cadence.mjs): node k lands 12 × 1.2^k minutes of MEDIAN play in that mode after node
// k-1, snapped to a whole mastery level — so a node every ~10–20 min early, ~1 h by node 12. The modes make words at
// different rates (CHAIN free-types ~10 a minute, WORD BOMB gets one word a turn), so each mode has its OWN levels.
//
// REWARDS ARE CONTENT, NOT NUMBERS: a painted mode BADGE (bronze → silver → gold), the mode's HERO, a mode CARD FRAME,
// a VICTORY pose, small one-time GEM CHESTS and ROLL TICKETS. Nothing here multiplies XP or WINS, and every node pays
// once. No titles (Andy oct17: "no need for titles … we already have enough cosmetics").
//
// PURE + localStorage-backed (a taw.s2.* key, so the save backup / cloud save carry it), every access guarded.
import { masteryState, masteryWordsToReach, masteryWords, MASTERY_MODES } from './mastery.js';
import { grantGems } from './gemsCore.js';
import { HEROES_KEY, ownsHero, heroById } from '../cast/cast.js';

export const ROAD_KEY = 'taw.s2.road';

// Node levels per mode (cadence.mjs LADDERS — regenerate there, never hand-tune one mode).
export const ROAD_LEVELS = {
  'word-bomb': [2, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15],
  'category-blitz': [3, 5, 7, 9, 10, 11, 13, 14, 15, 17, 18, 19],
  'sat-rush': [2, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15],
  chain: [4, 7, 8, 10, 12, 13, 15, 16, 17, 19, 20, 22],
  fuse: [4, 7, 8, 10, 12, 13, 15, 16, 17, 19, 20, 22],
};

// Each mode's own content: its name, colour (= the mode dialog's accent, modeDialogConfig.js), the hero its road hands out (a crew member that otherwise costs WINS or
// gems — the road is a second, free way in), and the badge / pose names.
export const ROAD_MODES = {
  'word-bomb': { name: 'WORD BOMB', color: '#FF6B3D', hero: 'sizzle', badge: 'BOMB SQUAD', pose: 'SHORT FUSE' },
  'category-blitz': { name: 'BLITZ', color: '#3DA8FF', hero: 'shh', badge: 'QUICK THINKER', pose: 'SPEED ROUND' },
  'sat-rush': { name: 'SAT RUSH', color: '#FFE94A', hero: 'lexi', badge: 'SCHOLAR', pose: 'CUM LAUDE' },
  chain: { name: 'CHAIN', color: '#2EFFE0', hero: 'quill', badge: 'UNBROKEN', pose: 'ENCORE' },
  fuse: { name: 'FUSE', color: '#FFE94A', hero: 'dud', badge: 'DEFUSER', pose: 'DUD NO MORE' },
};

// The ORDER of the road (same shape on every mode). gems = a chest's size; a ticket pays one roll's price.
// One-time totals a road: 90 gems + 2 rolls — 16 rolls across all five roads over ~40 h of median play.
export const ROAD_SHAPE = [
  { kind: 'badge', tier: 1 },
  { kind: 'chest', gems: 10 },
  { kind: 'ticket' },
  { kind: 'badge', tier: 2 },
  { kind: 'chest', gems: 15 },
  { kind: 'hero' },
  { kind: 'frame' },
  { kind: 'ticket' },
  { kind: 'chest', gems: 25 },
  { kind: 'badge', tier: 3 },
  { kind: 'chest', gems: 40 },
  { kind: 'pose' },
];
// the hero node when that hero is already yours (bought / earned by WINS): a chest instead, never nothing
export const HERO_OWNED_GEMS = 15;
// a ROLL TICKET pays one season-2 roll's price in gems, flat (Andy oct21: "keep 75 gems for each roll") — no server roll path
export const TICKET_GEMS = 75;

const TIER = ['', 'BRONZE', 'SILVER', 'GOLD'];
const BADGE_ART = ['', '/stage/emblem-3.webp', '/stage/emblem-2.webp', '/stage/emblem-1.webp'];

/** The display for one node's reward: { kind, name, sub, art, gems?, heroId? }. Art is painted (public/) only. */
export function rewardInfo(mode, shape) {
  const m = ROAD_MODES[mode];
  switch (shape.kind) {
    case 'badge':
      return { kind: 'badge', tier: shape.tier, name: `${TIER[shape.tier]} BADGE`, sub: `${m.badge} ${'I'.repeat(shape.tier)}`, art: BADGE_ART[shape.tier] };
    case 'chest':
      return { kind: 'chest', name: 'GEM CHEST', sub: `${shape.gems} GEMS`, art: '/shop/chest.webp', gems: shape.gems };
    case 'ticket':
      return { kind: 'ticket', name: 'ROLL TICKET', sub: '75 GEMS = 1 ROLL', art: '/icons/gears.webp', gems: TICKET_GEMS };
    case 'hero': {
      const h = heroById(m.hero);
      return { kind: 'hero', name: h ? h.name : 'HERO', sub: 'NEW HERO', art: `/cast/${m.hero}-hero.webp`, heroId: m.hero };
    }
    case 'frame':
      return { kind: 'frame', name: 'CARD FRAME', sub: `${m.name} CARD`, art: '/cards/frame-legend.webp' };
    case 'pose':
      return { kind: 'pose', name: 'VICTORY POSE', sub: m.pose, art: `/cast/${m.hero}-win.webp` };
    default:
      return { kind: shape.kind, name: '', sub: '', art: '' };
  }
}

function loadClaims() {
  try {
    const o = JSON.parse(localStorage.getItem(ROAD_KEY) || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch { return {}; }
}
function saveClaims(o) {
  try { localStorage.setItem(ROAD_KEY, JSON.stringify(o)); } catch { /* storage blocked */ }
}
const claimedSet = (all, mode) => new Set(Array.isArray(all[mode]) ? all[mode].filter(Number.isInteger) : []);

/**
 * A mode's road right now: { mode, level, words, nodes: [{ i, level, reward, state, toGo }], next, ready, done }.
 * state: 'claimed' | 'ready' (reached, not claimed yet) | 'locked'. toGo = words of THIS mode still needed.
 */
export function roadStatus(mode) {
  const levels = ROAD_LEVELS[mode];
  if (!levels) return null;
  const st = masteryState(mode);
  const words = masteryWords(mode);
  const claimed = claimedSet(loadClaims(), mode);
  const nodes = levels.map((lv, i) => {
    const reached = st.level >= lv;
    const state = claimed.has(i) ? 'claimed' : reached ? 'ready' : 'locked';
    return { i, level: lv, reward: rewardInfo(mode, ROAD_SHAPE[i]), state, toGo: reached ? 0 : Math.max(0, masteryWordsToReach(lv) - words) };
  });
  const next = nodes.find((n) => n.state === 'locked') || null;
  const prevLv = next ? (next.i > 0 ? levels[next.i - 1] : 1) : 1;
  // progress toward the NEXT node, in words (the bar the road + the dialog strip show)
  const span = next ? masteryWordsToReach(next.level) - masteryWordsToReach(prevLv) : 1;
  const frac = next ? Math.min(1, Math.max(0, 1 - next.toGo / Math.max(1, span))) : 1;
  return {
    mode, level: st.level, words, nodes, next, frac,
    ready: nodes.filter((n) => n.state === 'ready').length,
    done: nodes.every((n) => n.state === 'claimed'),
    badgeTier: nodes.reduce((t, n) => (n.state === 'claimed' && n.reward.kind === 'badge' ? n.reward.tier : t), 0),
  };
}

/** Every mode's road (STATS / the menu dot). */
export function allRoads() {
  return MASTERY_MODES.filter((m) => ROAD_LEVELS[m]).map(roadStatus);
}

/**
 * CLAIM node i of a mode's road. Pays it once (gems through the one gem door, a hero onto the owned list) and marks
 * it claimed. Returns { ok, reward, gems } — ok false when the node is locked, already claimed or unknown.
 */
export function claimRoadNode(mode, i) {
  const levels = ROAD_LEVELS[mode];
  if (!levels || !Number.isInteger(i) || i < 0 || i >= levels.length) return { ok: false };
  if (masteryState(mode).level < levels[i]) return { ok: false };
  const all = loadClaims();
  const set = claimedSet(all, mode);
  if (set.has(i)) return { ok: false };
  const reward = rewardInfo(mode, ROAD_SHAPE[i]);
  let gems = 0;
  // mark FIRST, pay second: a throw in the pay path can never let the same node pay twice
  set.add(i);
  all[mode] = [...set].sort((a, b) => a - b);
  saveClaims(all);
  if (reward.kind === 'chest' || reward.kind === 'ticket') {
    gems = grantGems(reward.gems, 'road', { mode, detail: `road-${mode}-${i}` });
  } else if (reward.kind === 'hero') {
    if (ownsHero(reward.heroId)) {
      gems = grantGems(HERO_OWNED_GEMS, 'road', { mode, detail: `road-${mode}-${i}-owned` });
    } else {
      try {
        const v = JSON.parse(localStorage.getItem(HEROES_KEY) || '[]');
        localStorage.setItem(HEROES_KEY, JSON.stringify([...new Set([...(Array.isArray(v) ? v : []), reward.heroId])]));
      } catch { /* blocked storage */ }
    }
  }
  return { ok: true, reward, gems };
}
