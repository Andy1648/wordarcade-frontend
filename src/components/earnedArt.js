// earnedArt.js — the painted art for each EARNED (achievement) gear: public/gear/earned/<name>.webp (Andy oct17: the
// achievement legendaries "need to do better" than the code-drawn glyphs). A leaf, read by the glyph table, the
// achievements screen and the gear sheet.
export const EARNED_ART = Object.freeze({
  'mk-ironhand': 'ironhand',
  'mk-grandmaster': 'grandmaster',
  'mk-eternal': 'eternal',
  'mk-linguist': 'highroller',
  'mk-legend': 'legend',
  'mk-marathon': 'marathon',
  'mk-curator': 'archivist',
  'mk-omega': 'omega',
});
export function earnedArt(id) {
  return EARNED_ART[id] ? `/gear/earned/${EARNED_ART[id]}.webp` : null;
}
