// packs.js — the Category Blitz packs (STEP 9, Andy oct2: LIST-ONLY — only packs whose curated, complete
// lists can fill a 3-round game exist; food/animals/music/literature/tv/art/tech/geography are gone).
//
// The `id`s MUST match the backend categoryPacks ids EXACTLY — that string is the
// contract used to tell the server which packs a room plays. `count` is the real
// number of verified categories in each pack (confirmed against the backend
// categoryPacks.js) and drives the PackPicker motion: heavier packs react bigger.
//
// emoji/color/rot/sticker reuse the approved pack-picker preview for the 14
// matching ids so the look is unchanged. `geography` is the new 2-category pack —
// a neutral colour for now (we'll decide later whether to surface such a tiny pack).
const packs = [
  { id: 'movies',     label: 'MOVIES',     emoji: '🎬', color: '#ff4fa3', rot: -3,   sticker: 'star', count: 49 },
  { id: 'gaming',     label: 'GAMING',     emoji: '🎮', color: '#2EFFE0', rot: 2.5,  sticker: null,   count: 36 },
  { id: 'sports',     label: 'SPORTS',     emoji: '⚽', color: '#3DFF77', rot: -2.5, sticker: 'dots', count: 20 },
  { id: 'world',      label: 'WORLD',      emoji: '🌍', color: '#3DA8FF', rot: 1.5,  sticker: null,   count: 21 },
  { id: 'science',    label: 'SCIENCE',    emoji: '🔬', color: '#2ED6FF', rot: 2,    sticker: null,   count: 22 },
  { id: 'history',    label: 'HISTORY',    emoji: '🏛️', color: '#FF9F1C', rot: -3,   sticker: null,   count: 6 },
  { id: 'mythology',  label: 'MYTHOLOGY',  emoji: '⚡', color: '#B14DFF', rot: 1,    sticker: 'drip', count: 8 },
  // oct14 (Andy "more categories … all easy"): Taylor Swift albums + the 12 Days of Christmas joined the two music lists,
  // and the Weasleys the two literature ones — 3+ each, so the backend offers both packs again
  { id: 'music',      label: 'MUSIC',      emoji: '🎵', color: '#FFE94A', rot: 2,    sticker: null,   count: 8 },
  { id: 'literature', label: 'LITERATURE', emoji: '📚', color: '#9A1AFF', rot: -2,   sticker: null,   count: 10 },
  // oct13 (Andy "more categories for Blitz"): Canada / Australia / Mexico joined US states bordering Canada — 4 lists, so
  // the backend now offers the pack (PACK_IDS needs >= 3)
  { id: 'geography',  label: 'GEOGRAPHY',  emoji: '🗺️', color: '#FF6B3D', rot: -1.5, sticker: null,   count: 4 },
  // oct15 (Andy "fun categories (like holiday etc.)"): HOLIDAYS is new (Halloween + Christmas lists, federal holidays);
  // FOOD is back now it has 9 closed lists (M&M colors, steak doneness, Starbucks sizes …)
  { id: 'holidays',   label: 'HOLIDAYS',   emoji: '🎃', color: '#FF6B3D', rot: 2,    sticker: null,   count: 15 },
  { id: 'food',       label: 'FOOD',       emoji: '🍕', color: '#FF4FA3', rot: -2,   sticker: null,   count: 17 },
  // oct15 night (Andy "A LOT ... easy ... FUN"): WORDPLAY = rhyme / pattern lists straight from the dictionary, animal
  // sounds, baby animals, Spanish basics — a typing game's home turf. TECH = iPhone models, Windows versions, keyboard keys.
  { id: 'wordplay',   label: 'WORDPLAY',   emoji: '🔤', color: '#2EFFE0', rot: 1.5,  sticker: null,   count: 25 },
  { id: 'tech',       label: 'TECH',       emoji: '💻', color: '#9A1AFF', rot: -1,   sticker: null,   count: 6 },
];

export default packs;
export { packs };
