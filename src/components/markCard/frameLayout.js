// frameLayout.js — where the card's plates sit in the 180×260 drawing (CardFrame.jsx draws them, MarkCard.css puts the
// text on them). PURE numbers, unit-tested: every plate stays inside the face and none overlap.
//
// GEAR TILE v2 (Andy oct9 — "avoid overcrowding by having the main stat on display and have the user click for more
// substats"; claude research gear-card-research.md §3, the Genshin / HSR / Diablo tile): ONE layout for every card.
// The tile carries rarity → art → name → the MAIN STAT as the hero → a quiet pip row on the bottom band (a dot per
// extra stat, ✦ for a perk, ★ for dupe pips). The crit / perk / odds lines left the tile for the detail sheet, so the
// per-card layouts (plain / perk / crit / both) are gone: every tile in the grid lines up.
export const CARD_W = 180;
export const CARD_H = 260;
export const FACE = { top: 42, bottom: 228 };
export const PLATE_H = { head: 28, name: 30, hero: 54, pips: 20 };
export const LAYOUT = { head: 9, artC: 89, artR: 45, name: 138, hero: 172, pips: 232 };
/** The pip plate's width for n pips (centred on the bottom band); 0 = no plate. */
export const PIP_W = 15;
export const PIP_GAP = 2;
export const PIP_PLATE_MAX = 164;
/** The gap between pips: PIP_GAP, or 0 when that would not fit the band (GEAR POOL v2: ORIGIN at ★5 carries 10 —
 *  2 extra stats + 3 perks + ★5). MarkCard.css mirrors it on .mc-pips[data-tight]. */
export function pipGap(n) {
  return n * PIP_W + (n - 1) * PIP_GAP + 12 > PIP_PLATE_MAX ? 0 : PIP_GAP;
}
export function pipPlateW(n) {
  return n > 0 ? Math.min(PIP_PLATE_MAX, n * PIP_W + (n - 1) * pipGap(n) + 12) : 0;
}
/** The plates as [name, top, bottom] spans, in drawing order. */
export function plateSpans(L = LAYOUT) {
  return [
    ['head', L.head, L.head + PLATE_H.head],
    ['art', L.artC - L.artR, L.artC + L.artR],
    ['name', L.name, L.name + PLATE_H.name],
    ['hero', L.hero, L.hero + PLATE_H.hero],
    ['pips', L.pips, L.pips + PLATE_H.pips],
  ];
}
