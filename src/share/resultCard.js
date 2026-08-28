// src/share/resultCard.js
// The SHAREABLE RESULT CARD text — the Wordle-style one-tap-copyable receipt built
// after any run (Job 1). PURE module (no DOM, no imports) so it runs under
// `node --test` and is identical on every mode. The exact shape is:
//
//   TYPE A WORD - FUSE
//   24 words - 1,860 pts - LV 12
//   🟩🟩🟨🟩⬛🟩🟨🟩🟩🟥🟨🟩
//   typeaword.com/?fuse=1&ref=share
//
// Line 1 : brand + mode label.
// Line 2 : "<n> words" · optional "<pts> pts" (only when a mode has a DISTINCT score;
//          FUSE's score == word count, so it's dropped as redundant) · "LV <level>".
// Line 3 : one glyph per word — 🟩 fast, 🟨 middling, 🟥 slow, ⬛ the one that killed you.
// Line 4 : a deep link INTO the mode (not the homepage).
//
// Spoiler-safe by construction: never contains a category name or a secret word.

// Per-word speed glyphs. `dead` is the word that ended the run.
export const GLYPH = { fast: '🟩', mid: '🟨', slow: '🟥', dead: '⬛' };

// Clock-left thresholds from the CHAIN/FUSE spec: >=65% left = fast, 45-65% = mid, <45% = slow.
export const FAST_MIN = 0.65;
export const MID_MIN = 0.45;

// The grid is capped so it stays one chat line; past the cap we keep every ceil(n/30)th glyph.
export const MAX_GLYPHS = 30;

// A run with fewer than this many accepted words is SUPPRESSED — a 0/1/2-word share is an
// anti-ad. buildResultCard returns null so callers hide the button entirely.
export const MIN_WORDS = 3;

// Display label per mode id (line 1). Unknown ids fall back to the bare brand.
export const MODE_LABEL = {
  'word-bomb': 'WORD BOMB',
  'category-blitz': 'CATEGORY BLITZ',
  'sat-rush': 'SAT RUSH',
  chain: 'CHAIN',
  fuse: 'FUSE',
};

// Fraction of the clock left at submit -> speed tier. Pure; used by the CHAIN/FUSE adapters.
export function tierForClockLeft(frac) {
  const f = Number.isFinite(frac) ? frac : 0;
  if (f >= FAST_MIN) return 'fast';
  if (f >= MID_MIN) return 'mid';
  return 'slow';
}

// Full comma grouping ("1860" -> "1,860"). NOT the abbreviating formatNum — the receipt
// shows the real number. Pure, integer-only.
export function groupThousands(n) {
  const v = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * The glyph row. `tiers` is one entry per accepted word ('fast'|'mid'|'slow'); when
 * `killed` is true a trailing ⬛ is appended for the fatal word. Past MAX_GLYPHS the row is
 * DOWN-SAMPLED — keep every ceil(n/30)th glyph — so an epic run still fits one line.
 */
export function glyphRow(tiers = [], { killed = false } = {}) {
  let glyphs = (Array.isArray(tiers) ? tiers : []).map((t) => GLYPH[t] || GLYPH.slow);
  if (killed) glyphs.push(GLYPH.dead);
  if (glyphs.length > MAX_GLYPHS) {
    const k = Math.ceil(glyphs.length / MAX_GLYPHS);
    glyphs = glyphs.filter((_, i) => i % k === 0);
  }
  return glyphs.join('');
}

/**
 * Build the copyable result text, or null when suppressed (< MIN_WORDS accepted).
 *   mode   - one of MODE_LABEL's keys
 *   words  - accepted-word count (line 2 + the suppression gate)
 *   points - optional distinct score; dropped when null/undefined
 *   level  - optional player level for "LV n"; dropped when null/undefined
 *   tiers  - per-accepted-word speed tiers (see glyphRow)
 *   killed - append the ⬛ killer glyph
 *   link   - the deep-link URL for the last line
 */
export function buildResultCard({ mode, words, points, level, tiers = [], killed = false, link } = {}) {
  const w = Math.max(0, Math.floor(Number.isFinite(words) ? words : 0));
  if (w < MIN_WORDS) return null; // suppression rule — an anti-ad

  const label = MODE_LABEL[mode] || 'TYPE A WORD';
  const lines = [`TYPE A WORD - ${label}`];

  const stat = [`${w} words`];
  if (points != null && Number.isFinite(points)) stat.push(`${groupThousands(points)} pts`);
  if (level != null && Number.isFinite(level)) stat.push(`LV ${Math.max(1, Math.floor(level))}`);
  lines.push(stat.join(' - '));

  const row = glyphRow(tiers, { killed });
  if (row) lines.push(row);

  if (link) lines.push(link);
  return lines.join('\n');
}
