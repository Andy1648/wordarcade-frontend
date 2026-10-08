// v3/ranks.js — RANKS by REBIRTHS, then STARS (progression-v3.md "Ranks (monotonic; never drop when levels reset)").
//
//   R0 INKLING · R1 TYPO · R2 CLACKER · R3 HOTKEY · R4 INKSTORM · R5 WORDSMITH · R6 KEYFIEND · R7 CAPSLOCK ·
//   R8 OVERCLOCK · R9 GLYPHLORD · R10 LEXIBEAST · ★1 VOIDTYPER · ★3 ASCENDANT · ★5 OMNIKEY · ★10 FINAL BOSS ·
//   ★20 ENDGAME
//
// A rank reads only rebirths and stars — never the level — so a rebirth (level → 1) cannot drop it. Ascension
// resets rebirths to 0 but adds ★ (≥ 1), and every ★ rank sits above LEXIBEAST, so it cannot drop there either.
// Belt and braces: the shown rank is the best ever reached (store.noteRankIndex). The score `min` is the rank's
// index (0–15) — RankLadder compares it like a level; `req` is what it says ("R5", "★10").
// LEAF (pure; the live helpers read store.js).
import { s2Rebirths, getStarsV3, bestRankIndex, noteRankIndex } from './store.js';

export const RANKS_V3 = [
  { r: 0, name: 'INKLING' },
  { r: 1, name: 'TYPO' },
  { r: 2, name: 'CLACKER' },
  { r: 3, name: 'HOTKEY' },
  { r: 4, name: 'INKSTORM' },
  { r: 5, name: 'WORDSMITH' },
  { r: 6, name: 'KEYFIEND' },
  { r: 7, name: 'CAPSLOCK' },
  { r: 8, name: 'OVERCLOCK' },
  { r: 9, name: 'GLYPHLORD' },
  { r: 10, name: 'LEXIBEAST' },
  { s: 1, name: 'VOIDTYPER' },
  { s: 3, name: 'ASCENDANT' },
  { s: 5, name: 'OMNIKEY' },
  { s: 10, name: 'FINAL BOSS' },
  { s: 20, name: 'ENDGAME' },
].map((x, i) => ({ ...x, min: i, req: x.s != null ? `★${x.s}` : `R${x.r}` }));

const int0 = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** PURE: the rank index for { rebirths, stars } — stars first (any ★ outranks every R), then rebirths. */
export function rankIndexV3({ rebirths = 0, stars = 0 } = {}) {
  const st = int0(stars);
  const r = int0(rebirths);
  let i = 0;
  for (let k = 0; k < RANKS_V3.length; k++) {
    const x = RANKS_V3[k];
    if (x.s != null ? st >= x.s : st >= 1 || r >= x.r) i = k;
  }
  return i;
}
/** PURE: the rank entry for a state. */
export function rankForV3(state) {
  return RANKS_V3[rankIndexV3(state)];
}
/** The live rank (season 2): max(computed, best ever) — and the best is raised. */
export function liveRankV3() {
  const i = Math.max(rankIndexV3({ rebirths: s2Rebirths(), stars: getStarsV3() }), Math.min(RANKS_V3.length - 1, bestRankIndex()));
  noteRankIndex(i);
  return RANKS_V3[i];
}
