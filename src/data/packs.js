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
// Oct 8 (Andy: "no one plays this anymore — shrink the categories, MUCH easier prompts"): SIX packs × 10 EASY
// categories (backend feat/blitz-easy-packs puts exactly these 60 in rotation; the old niche pool is benched).
const packs = [
  { id: 'food',    label: 'FOOD',         emoji: '🍕', color: '#FF6B3D', rot: -2.5, sticker: null,   count: 10 },
  { id: 'animals', label: 'ANIMALS',      emoji: '🐾', color: '#3DFF77', rot: 2,    sticker: 'dots', count: 10 },
  { id: 'sports',  label: 'SPORTS',       emoji: '⚽', color: '#3DA8FF', rot: -2,   sticker: null,   count: 10 },
  { id: 'movies',  label: 'MOVIES & TV',  emoji: '🎬', color: '#ff4fa3', rot: 1.5,  sticker: 'star', count: 10 },
  { id: 'gaming',  label: 'GAMING',       emoji: '🎮', color: '#2EFFE0', rot: -1.5, sticker: null,   count: 10 },
  { id: 'music',   label: 'MUSIC',        emoji: '🎵', color: '#FFE94A', rot: 2.5,  sticker: 'drip', count: 10 },
];

export default packs;
export { packs };
