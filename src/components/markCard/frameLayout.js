// frameLayout.js — where the card's plates sit in the 180×260 drawing (CardFrame.jsx draws them, MarkCard.css puts the
// text on them via --mc-y-*). PURE numbers, unit-tested: every plate stays inside the face and none overlap.
export const CARD_W = 180;
export const CARD_H = 260;
export const FACE = { top: 42, bottom: 228 };
export const PLATE_H = { head: 28, name: 30, stat: 32, perk: 18, foot: 20 };
/** plain: no perk band; perk: LEGENDARY+ with a perk — the art and the lower plates move up to fit the band. */
export const LAYOUT = {
  plain: { head: 9, artC: 102, artR: 58, name: 162, stat: 196, perk: null, foot: 232 },
  perk: { head: 9, artC: 90, artR: 48, name: 140, stat: 174, perk: 208, foot: 232 },
};
/** The plates of a layout as [top, bottom] spans, in drawing order. */
export function plateSpans(L) {
  const out = [['head', L.head, L.head + PLATE_H.head], ['art', L.artC - L.artR, L.artC + L.artR], ['name', L.name, L.name + PLATE_H.name], ['stat', L.stat, L.stat + PLATE_H.stat]];
  if (L.perk != null) out.push(['perk', L.perk, L.perk + PLATE_H.perk]);
  out.push(['foot', L.foot, L.foot + PLATE_H.foot]);
  return out;
}
