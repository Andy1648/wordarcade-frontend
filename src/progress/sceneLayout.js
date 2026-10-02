// sceneLayout.js — Andy oct2 A1: "SAME background style as before (the floating words) shifting to
// different positions per tier, as if the scene moved."
//
// The wall's decor (spray-painted words, stickers, splatters — WallScene) keeps its exact art and
// set at every tier; only WHERE each piece sits changes. Tier 0 is the original hand-placed layout.
// Tier N is a seeded layout: a jittered grid, shuffled per tier, so the pieces are always spread
// across the whole wall (never clumped) and a given tier always looks the same on every visit.
// PURE — unit-tested in sceneLayout.test.js.

const COLS = 5;
const ROWS = 5;
// The usable band, in % of the wall (keeps a piece's anchor off the very edges).
const TOP_MIN = 4;
const TOP_SPAN = 82;
const LEFT_MIN = 3;
const LEFT_SPAN = 86;

function rng(seed) {
  // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Positions for `count` decor pieces at menu tier `tier`: [{ top, left, rot }] (top/left in %, rot
 * in degrees), or null at tier 0 (use the hand-placed layout). Deterministic per tier.
 */
export function scenePositions(count, tier) {
  const t = Math.floor(Number(tier) || 0);
  if (t <= 0 || count <= 0) return null;
  const rand = rng(0x5eed + t * 7919);
  const cells = Array.from({ length: COLS * ROWS }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const out = [];
  for (let k = 0; k < count; k += 1) {
    const cell = cells[k % cells.length];
    const r = Math.floor(cell / COLS);
    const c = cell % COLS;
    out.push({
      top: Math.round((TOP_MIN + ((r + 0.15 + rand() * 0.7) / ROWS) * TOP_SPAN) * 10) / 10,
      left: Math.round((LEFT_MIN + ((c + 0.15 + rand() * 0.7) / COLS) * LEFT_SPAN) * 10) / 10,
      rot: Math.round(rand() * 56 - 28),
    });
  }
  return out;
}
