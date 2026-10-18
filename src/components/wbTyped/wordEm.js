// wbTyped/wordEm.js — how wide a word is in the prompt's font, in em, without measuring the DOM per keystroke.
//
// The live prompt (ComboLive) shrinks the typed word into a fixed-width row beside the TIME plaque. It used to assume
// every letter was 0.82em wide (letter-spacing included), but real glyphs run from ~0.55em (I) to over 1em (W), so a
// W/M-heavy word overflowed its row by ~44px straight into the clock (Andy oct17: "part of the word overlaps with the
// timer in word bomb"). Worst before Bungee arrives (Google Fonts is non-render-blocking, and blocked outright on some
// school networks): the `cursive` fallback's W is 1.04em.
//
// So the advance widths are MEASURED from the font actually in use — once per font family, re-measured when a webfont
// finishes loading — and the per-keystroke work is a pure table lookup (CLAUDE.md: no layout reads per keystroke).

// Bungee's capitals at 1em (canvas measureText on the shipped webfont, oct17): the table until a measurement lands.
export const BUNGEE_ADV = {
  A: 0.73, B: 0.725, C: 0.628, D: 0.746, E: 0.654, F: 0.618, G: 0.708, H: 0.759, I: 0.605, J: 0.688, K: 0.746,
  L: 0.695, M: 0.849, N: 0.753, O: 0.737, P: 0.682, Q: 0.737, R: 0.743, S: 0.65, T: 0.656, U: 0.746, V: 0.73,
  W: 0.831, X: 0.737, Y: 0.705, Z: 0.66,
};
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const widest = (adv) => Math.max(...Object.values(adv));

/** Sum of advance widths (em) for `text`, uppercased the way the prompt draws it. A glyph off the table (a digit, an
 *  apostrophe, an accented letter) is costed as the WIDEST letter, so it can only make the word smaller, never push
 *  it into the clock. */
export function wordEm(text, adv = BUNGEE_ADV) {
  const fallback = adv.__widest ?? widest(adv);
  let em = 0;
  for (const ch of String(text || '').toUpperCase()) em += adv[ch] ?? fallback;
  return em;
}

const cache = new Map();
/** Advance widths of A-Z in `fontFamily` (a computed font-family list) as the browser will draw them right now.
 *  Canvas text resolves the family list exactly like the DOM, so an unloaded webfont measures as its fallback. */
export function advancesFor(fontFamily) {
  if (!fontFamily || typeof document === 'undefined') return BUNGEE_ADV;
  let adv = cache.get(fontFamily);
  if (adv) return adv;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return BUNGEE_ADV;
  ctx.font = `100px ${fontFamily}`;
  adv = {};
  for (const ch of LETTERS) adv[ch] = ctx.measureText(ch).width / 100;
  adv.__widest = widest(adv);
  cache.set(fontFamily, adv);
  return adv;
}
/** A webfont finished loading: every cached measurement may have been of its fallback. */
export function clearAdvances() {
  cache.clear();
}
