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
  { id: 'movies',     label: 'MOVIES',     emoji: '🎬', color: '#ff4fa3', rot: -3,   sticker: 'star', count: 4 },
  { id: 'gaming',     label: 'GAMING',     emoji: '🎮', color: '#2EFFE0', rot: 2.5,  sticker: null,   count: 28 },
  { id: 'sports',     label: 'SPORTS',     emoji: '⚽', color: '#3DFF77', rot: -2.5, sticker: 'dots', count: 20 },
  { id: 'world',      label: 'WORLD',      emoji: '🌍', color: '#3DA8FF', rot: 1.5,  sticker: null,   count: 14 },
  { id: 'science',    label: 'SCIENCE',    emoji: '🔬', color: '#2ED6FF', rot: 2,    sticker: null,   count: 7 },
  { id: 'history',    label: 'HISTORY',    emoji: '🏛️', color: '#FF9F1C', rot: -3,   sticker: null,   count: 6 },
  { id: 'mythology',  label: 'MYTHOLOGY',  emoji: '⚡', color: '#B14DFF', rot: 1,    sticker: 'drip', count: 3 },
];

export default packs;
export { packs };
