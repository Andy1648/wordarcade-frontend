// menuTier.js — STEP 22 / Andy A1: "the player must FEEL more stimulation as they progress."
//
// ONE number, the MENU TIER, says how rich the menu is allowed to look. It climbs with level
// and with rebirth, and a rebirth never makes the menu poorer: level resets to 1 on a rebirth,
// so a pure level ladder would strip a R1 player's frame the moment they earned it. Each rebirth
// is therefore worth one whole tier on top of the level tier — a fresh R2 player starts at T2
// and climbs from there.
//
// Everything that escalates reads THIS (the frame art, the letter-pop length, shards, the
// level-up burst), so "a L150 player's menu looks richer than L1" is one table, not five
// scattered thresholds that drift apart. PURE — unit-tested in menuTier.test.js.

// Level at which each level-tier starts. T0 is L1.
export const LEVEL_TIER_STARTS = [1, 10, 25, 50, 100, 150, 250];
export const MAX_TIER = 7;

export const TIER_NAMES = ['PLAIN', 'TAPED', 'BOLTED', 'STEEL', 'CHROME', 'GOLD', 'NEON', 'LEGEND'];

export function levelTier(level) {
  const lv = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
  let t = 0;
  for (let i = 0; i < LEVEL_TIER_STARTS.length; i += 1) if (lv >= LEVEL_TIER_STARTS[i]) t = i;
  return t;
}

export function menuTier(level, rebirths = 0) {
  const rb = Number.isFinite(rebirths) && rebirths > 0 ? Math.floor(rebirths) : 0;
  return Math.min(MAX_TIER, levelTier(level) + rb);
}

// The level the NEXT tier starts at for this player (null at MAX_TIER, or when only a rebirth
// can lift it further).
export function nextTierLevel(level, rebirths = 0) {
  const t = menuTier(level, rebirths);
  if (t >= MAX_TIER) return null;
  const lt = levelTier(level);
  return LEVEL_TIER_STARTS[lt + 1] ?? null;
}

// What each tier buys the menu's motion. Longer + juicier letter pops (Andy: "LONGER type
// animations"), more shards, a bigger level-up. All finite one-shots; the counts feed pooled
// nodes, so a higher tier costs more simultaneous animations during typing, never at rest.
export function tierFx(tier) {
  const t = Math.max(0, Math.min(MAX_TIER, Math.floor(tier) || 0));
  return {
    tier: t,
    popMs: 600 + t * 90, // 600ms at T0 → 1230ms at T7
    popRise: 49 + t * 9, // px of upward travel
    shards: t >= 2 ? Math.min(6, 2 + Math.floor(t / 2)) : 0, // T2 3 → T7 5 (and KEY POWER still adds its own)
    levelUpBurst: t >= 1, // the starburst behind LEVEL N
    levelUpShards: 6 + t * 3,
  };
}

// The frame accent per tier. Each is a flat fill + its darker outline shade (house style:
// thick COLORED outlines, a darker shade of the fill).
export const TIER_COLORS = [
  { fill: '#6b5a86', line: '#3d3150' }, // PLAIN — barely there
  { fill: '#e8dcc0', line: '#9c8f72' }, // TAPED — masking tape
  { fill: '#2EFFE0', line: '#0f8f7e' }, // BOLTED
  { fill: '#b9c6d6', line: '#5f6f84' }, // STEEL
  { fill: '#e6f1ff', line: '#7d93b3' }, // CHROME
  { fill: '#FFD54A', line: '#a8800f' }, // GOLD
  { fill: '#FF4FA3', line: '#a3175e' }, // NEON
  { fill: '#9A1AFF', line: '#4f0391' }, // LEGEND
];

// localStorage: the highest tier this browser has SEEN on the menu, so crossing into a new
// tier gets exactly one "NEW FRAME" moment.
const SEEN_KEY = 'taw.menuTierSeen';
export function getSeenTier() {
  try {
    const n = Number(localStorage.getItem(SEEN_KEY));
    return Number.isFinite(n) && n >= 0 ? n : -1;
  } catch {
    return -1;
  }
}
export function setSeenTier(t) {
  try {
    localStorage.setItem(SEEN_KEY, String(t));
  } catch {
    /* storage blocked — the moment may replay, harmless */
  }
}
