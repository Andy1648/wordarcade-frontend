// popLooks.js — what each POP STYLE (shop LOOKS) actually paints (Andy oct19: "the looks dont seem to do anything at
// all"). They never did: the style was saved and never read. Now the equipped look dresses the menu's "+N XP" gain pops
// (MenuXp letterPop / tapPop, the pooled nodes) — fill, a coloured outline (a darker shade of the fill, the house rule),
// a hard offset shadow and the burst shards. A pricier look throws more shards; PRISM / PLASMA / LEGEND cycle their
// fill pop to pop. LOOKS ONLY: nothing here touches XP, wins or gems. CLASSIC = the old dress, untouched (null).
// Colours follow each look's shop swatch (public/shop/pop/<id>.webp). Leaf module: no imports. LAZY — useXpCapture
// loads it on the menu's first key / tap, and only while a paid look is worn, so it never weighs on the first paint.

/** fill: colours cycled pop to pop · stroke: the text outline · shadow: the hard offset · shards: burst colours, n of them. */
export const POP_LOOKS = Object.freeze({
  chrome: { fill: ['#E8EEF6'], stroke: '#4A5468', shadow: '#000', shards: ['#FFFFFF', '#9AA6BA'], n: 2 },
  inferno: { fill: ['#FF6B3D', '#FFB23D'], stroke: '#7A1A00', shadow: '#000', shards: ['#FF6B3D', '#FFE94A'], n: 3 },
  void: { fill: ['#B44CFF'], stroke: '#2A0656', shadow: '#000', shards: ['#9A1AFF', '#FFFFFF'], n: 3 },
  prism: { fill: ['#FF4FA3', '#2EFFE0', '#FFE94A', '#B44CFF'], stroke: '#000', shadow: '#000', shards: ['#FF4FA3', '#2EFFE0', '#FFE94A', '#B44CFF'], n: 4 },
  toxic: { fill: ['#9EFF2E'], stroke: '#2C5A00', shadow: '#000', shards: ['#9EFF2E', '#C8FF3D'], n: 4 },
  ember: { fill: ['#FF3D2E', '#FF6B3D'], stroke: '#2A0A06', shadow: '#FFB23D', shards: ['#FF3D2E', '#FFB23D', '#2A0A06'], n: 4 },
  frost: { fill: ['#C9F4FF'], stroke: '#1C6E9A', shadow: '#000', shards: ['#FFFFFF', '#4CE0FF'], n: 5 },
  gold: { fill: ['#FFD54A'], stroke: '#7A5200', shadow: '#000', shards: ['#FFD54A', '#FFF3B0'], n: 5 },
  plasma: { fill: ['#FF4FA3', '#FF9AD5'], stroke: '#5C0838', shadow: '#2EFFE0', shards: ['#FF4FA3', '#2EFFE0'], n: 5 },
  nova: { fill: ['#FFFFFF'], stroke: '#000', shadow: '#FFE94A', shards: ['#FFFFFF', '#FFE94A'], n: 6 },
  eclipse: { fill: ['#0d0618'], stroke: '#FF9A1F', shadow: '#FFE94A', shards: ['#FF9A1F', '#FFE94A', '#0d0618'], n: 6 },
  legend: { fill: ['#FF4FA3', '#FFE94A', '#2EFFE0', '#B44CFF', '#FF6B3D'], stroke: '#000', shadow: '#FFD54A', shards: ['#FF4FA3', '#FFE94A', '#2EFFE0', '#B44CFF', '#FF6B3D'], n: 6 },
});

/** The look for a pop-style id, or null (CLASSIC / unknown → the menu's own tier colours). */
export function popLookOf(id) {
  return (id && POP_LOOKS[id]) || null;
}
