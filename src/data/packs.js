// packs.js — the 15 real Category Blitz packs (Stage 1 manifest).
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
  { id: 'movies',     label: 'MOVIES',     emoji: '🎬', color: '#FF2EC4', rot: -3,   sticker: 'star', count: 31 },
  { id: 'gaming',     label: 'GAMING',     emoji: '🎮', color: '#2EFFE0', rot: 2.5,  sticker: null,   count: 60 },
  { id: 'food',       label: 'FOOD',       emoji: '🍔', color: '#FF6B3D', rot: -1.5, sticker: 'drip', count: 61 },
  { id: 'animals',    label: 'ANIMALS',    emoji: '🐾', color: '#FFE94A', rot: 3,    sticker: null,   count: 48 },
  { id: 'sports',     label: 'SPORTS',     emoji: '⚽', color: '#3DFF77', rot: -2.5, sticker: 'dots', count: 48 },
  { id: 'world',      label: 'WORLD',      emoji: '🌍', color: '#3DA8FF', rot: 1.5,  sticker: null,   count: 48 },
  { id: 'music',      label: 'MUSIC',      emoji: '🎵', color: '#9A28FF', rot: -2,   sticker: 'star', count: 21 },
  { id: 'science',    label: 'SCIENCE',    emoji: '🔬', color: '#2ED6FF', rot: 2,    sticker: null,   count: 18 },
  { id: 'history',    label: 'HISTORY',    emoji: '🏛️', color: '#FF9F1C', rot: -3,   sticker: null,   count: 14 },
  { id: 'tech',       label: 'TECH',       emoji: '💻', color: '#4D8BFF', rot: 2.5,  sticker: 'dots', count: 12 },
  { id: 'mythology',  label: 'MYTHOLOGY',  emoji: '⚡', color: '#B14DFF', rot: 1,    sticker: 'drip', count: 11 },
  { id: 'literature', label: 'LITERATURE', emoji: '📚', color: '#FF5CA8', rot: -1,   sticker: null,   count: 11 },
  { id: 'tv',         label: 'TV',         emoji: '📺', color: '#FF4D6D', rot: 3,    sticker: 'star', count: 10 },
  { id: 'art',        label: 'ART',        emoji: '🎨', color: '#FFD23D', rot: -2.5, sticker: null,   count: 8 },
  { id: 'geography',  label: 'GEOGRAPHY',  emoji: '🗺️', color: '#8FA0B8', rot: 2,    sticker: null,   count: 2 },
];

export default packs;
export { packs };
