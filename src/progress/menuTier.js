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
// STEP 50 (Andy oct2: "border tiers get many more steps — satisfaction must not run out; plan
// tiers to L1000+ and rebirth tiers"): 15 level tiers to L1000, plus one per rebirth, to T24. Every
// tier also MOVES THE WALL (Andy oct2 A1): the same floating words/stickers sit in a new layout per
// tier (sceneLayout.js), and a climb swishes the scene up (WallScene, listening for SCENE_EVENT).
export const LEVEL_TIER_STARTS = [1, 10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 600, 750, 900, 1000];
export const MAX_TIER = 24;
// The frame's FX (pop length, shards) stop growing at this tier — past it, the climb is the world.
export const FX_TIER_CAP = 7;

export const TIER_NAMES = [
  'PLAIN', 'TAPED', 'BOLTED', 'STEEL', 'CHROME', 'GOLD', 'NEON', 'LEGEND',
  'ICE', 'VINE', 'WAVE', 'CANDY', 'STORM', 'GEM', 'MOON', 'COSMIC',
  'SOLAR', 'NIGHT', 'TOXIC', 'ABYSS', 'MAGMA', 'FROST', 'GILDED', 'VOID', 'MYTHIC',
];

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
  const t = Math.max(0, Math.min(FX_TIER_CAP, Math.floor(tier) || 0));
  return {
    tier: t,
    popMs: 600 + t * 90, // 600ms at T0 → 1230ms at T7
    popRise: 49 + t * 9, // px of upward travel
    shards: t >= 2 ? Math.min(6, 2 + Math.floor(t / 2)) : 0, // T2 3 → T7 5 (and KEY POWER still adds its own)
    levelUpBurst: true, // the starburst behind LEVEL N — every tier (STEP 50: T0 level-ups were bare text on the cards)
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
  // STEP 50: T8-T24 take their colour from their world's accent.
  { fill: '#e6f1ff', line: '#7d93b3' }, // ICE
  { fill: '#C8FF3D', line: '#6f8f14' }, // VINE
  { fill: '#2EFFE0', line: '#0f8f7e' }, // WAVE
  { fill: '#FF4FA3', line: '#a3175e' }, // CANDY
  { fill: '#FFE94A', line: '#a8950f' }, // STORM
  { fill: '#6a2bb0', line: '#3d1a6e' }, // GEM
  { fill: '#b9c6d6', line: '#5f6f84' }, // MOON
  { fill: '#9A1AFF', line: '#4f0391' }, // COSMIC
  { fill: '#FF6B3D', line: '#a8381a' }, // SOLAR
  { fill: '#2EFFE0', line: '#0f8f7e' }, // NIGHT
  { fill: '#C8FF3D', line: '#6f8f14' }, // TOXIC
  { fill: '#9A1AFF', line: '#4f0391' }, // ABYSS
  { fill: '#FF6B3D', line: '#a8381a' }, // MAGMA
  { fill: '#e6f1ff', line: '#7d93b3' }, // FROST
  { fill: '#FFD54A', line: '#a8800f' }, // GILDED
  { fill: '#FFE94A', line: '#a8950f' }, // VOID
  { fill: '#FF4FA3', line: '#a3175e' }, // MYTHIC
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
// Fired on window when the seen tier rises — the wall (WallScene, mounted once in App) moves.
export const SCENE_EVENT = 'taw:menu-tier';
export function setSeenTier(t) {
  const prev = getSeenTier();
  try {
    localStorage.setItem(SEEN_KEY, String(t));
  } catch {
    /* storage blocked — the moment may replay, harmless */
  }
  if (t > prev && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent(SCENE_EVENT, { detail: { tier: t } }));
  }
}
