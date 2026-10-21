// gameXp.js — the GAME XP LEDGER (Andy oct21: "games giving xp … noticeably less than spamming keys on the main menu").
// A LEAF (no imports): letterXp.js records every XP credit an accepted game word made; the end-of-game "+N XP" lines
// read "XP since my mark". In memory only — a results card is always in the same session as the game it sums.
//
//   const since = gameXpMark();            // when a game / run starts
//   gameXpSince(since) → { xp, levels }    // on the results card (live: a late credit still adds in)
//   subscribeGameXp(fn) → unsubscribe

let xpTotal = 0;
let levelTotal = 0;
let seq = 0;
const marks = new Map(); // mark id → { xp, levels } at the moment it was taken
const subs = new Set();

/** Record one game-word credit (letterXp.js). Never throws. */
export function noteGameXp(xp, levels = 0) {
  const x = Number.isFinite(xp) && xp > 0 ? xp : 0;
  const l = Number.isFinite(levels) && levels > 0 ? Math.floor(levels) : 0;
  if (!x && !l) return;
  xpTotal += x;
  levelTotal += l;
  for (const fn of subs) {
    try { fn({ xp: x, levels: l }); } catch { /* a bad subscriber must never break a credit */ }
  }
}

/** A mark for "XP earned from now on". */
export function gameXpMark() {
  seq += 1;
  marks.set(seq, { xp: xpTotal, levels: levelTotal });
  if (marks.size > 64) marks.delete(marks.keys().next().value); // old marks fall away (a long session)
  return seq;
}

/** XP and levels credited by game words since `mark` (an unknown mark = nothing yet). */
export function gameXpSince(mark) {
  const m = marks.get(mark);
  if (!m) return { xp: 0, levels: 0 };
  return { xp: Math.max(0, xpTotal - m.xp), levels: Math.max(0, levelTotal - m.levels) };
}

export function subscribeGameXp(fn) {
  if (typeof fn !== 'function') return () => {};
  subs.add(fn);
  return () => subs.delete(fn);
}

/** Tests: a fresh ledger. */
export function resetGameXp() {
  xpTotal = 0;
  levelTotal = 0;
  marks.clear();
  subs.clear();
}
