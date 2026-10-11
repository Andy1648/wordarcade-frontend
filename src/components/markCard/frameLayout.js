// frameLayout.js — where the card's plates sit in the 180×300 drawing (CardFrame.jsx draws them, MarkCard.css puts the
// text on them). PURE numbers, unit-tested: every plate stays inside the face and none overlap.
//
// GEAR CARD v4 (Andy oct11 — "one main line on top and substats below … all cards the same size … can be bigger"):
// ONE layout for every card, 40px taller than v2: rarity → art → name → the MAIN STAT as the hero → a SUBSTATS plate
// of 4 lines on the bottom band (a dash for an unused line). The ★ pip row is gone (duplicates pay gems).
export const CARD_W = 180;
export const CARD_H = 300;
export const CARD_RATIO = CARD_H / CARD_W; // hosts size the card box by width × this (MarkCard.css .mc)
export const FACE = { top: 42, bottom: 212 };
export const PLATE_H = { head: 28, name: 30, hero: 44, subs: 80, pips: 20 };
export const SUB_LINE_H = 19;
export const LAYOUT = { head: 9, artC: 86, artR: 42, name: 128, hero: 164, subs: 214, pips: 232 };
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
    ['subs', L.subs, L.subs + PLATE_H.subs],
  ];
}
