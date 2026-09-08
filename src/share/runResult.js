// src/share/runResult.js (feat/run-share)
// THE RUN's shareable receipt — PURE (no DOM, no imports) so it runs under `node --test`.
// Exact shape:
//
//   TYPE A WORD — THE RUN
//   ROUND 4/10 · 3,210 BANKED
//   🟩🟩🟩⬛
//   HAND: HOT STREAK · DEEP POCKETS · SNOWBALL
//   https://typeaword.com/run?ref=share
//
// Line 3: one glyph per round played — 🟩 cleared, 🟨 cleared by < 15% (a squeak), ⬛ the round
// that ended the run (the wall, or a GLASS CANNON fumble). A fully cleared run has no ⬛.
// Line 4 is dropped when the hand is empty. SUPPRESSED (null) on a 0-round run — dying on
// round 1 with nothing banked is an anti-ad, so callers hide the button entirely.

export const RUN_GLYPH = { clear: '🟩', squeak: '🟨', dead: '⬛' };
// A clear with score < wall × (1 + SQUEAK_MARGIN) is a squeak.
export const SQUEAK_MARGIN = 0.15;
// Up to this many modifier names on the HAND line (the image card shows the same four icons).
export const HAND_MAX = 4;

const group = (n) => String(Math.max(0, Math.floor(Number.isFinite(n) ? n : 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Glyph for one round record { score, wall, passed }. */
export function runGlyph(r) {
  if (!r || !r.passed) return RUN_GLYPH.dead;
  const wall = Number(r.wall) || 0;
  const score = Number(r.score) || 0;
  return wall > 0 && score < wall * (1 + SQUEAK_MARGIN) ? RUN_GLYPH.squeak : RUN_GLYPH.clear;
}

/** One glyph per round, in order. */
export function runGlyphRow(history = []) {
  return (Array.isArray(history) ? history : []).map(runGlyph).join('');
}

/** Cleared-round count (the suppression gate). */
export function clearedRounds(history = []) {
  return (Array.isArray(history) ? history : []).filter((r) => r && r.passed).length;
}

/**
 * Build the receipt, or null when suppressed (no round cleared).
 *   history     - [{ round, score, wall, passed, fumbled }] one per round played, in order
 *   totalRounds - RUN_ROUNDS (10)
 *   banked      - the run's cumulative score
 *   hand        - modifier NAMES in draft order (up to HAND_MAX shown)
 *   link        - the deep link for the last line
 */
export function buildRunResultText({ history = [], totalRounds = 10, banked = 0, hand = [], link } = {}) {
  const rounds = Array.isArray(history) ? history : [];
  if (clearedRounds(rounds) === 0) return null; // suppression rule — an anti-ad
  const reached = rounds.length ? rounds[rounds.length - 1].round || rounds.length : rounds.length;
  const lines = ['TYPE A WORD — THE RUN'];
  lines.push(`ROUND ${reached}/${totalRounds} · ${group(banked)} BANKED`);
  const row = runGlyphRow(rounds);
  if (row) lines.push(row);
  const names = (Array.isArray(hand) ? hand : []).filter(Boolean).slice(0, HAND_MAX).map((n) => String(n).toUpperCase());
  if (names.length) lines.push(`HAND: ${names.join(' · ')}`);
  if (link) lines.push(link);
  return lines.join('\n');
}
