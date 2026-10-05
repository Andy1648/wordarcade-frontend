// palette.js — ROLL v1 card colours (Andy oct5 mockup, claude/mockups/roll-v1/MarkCard.dc.html). One row per tier:
//   line  — the tier colour: cog teeth + ring, the card's header bar, the reveal's "1 IN X"
//   fill  — the card face (a dark wash of the tier)
//   inner — the cog's inner disc behind the glyph
// PERMANENT (earned, never rolled) gets its own cyan row. SECRET's teeth are the RAINBOW (static — a tooth per
// colour, never an animated fill). Tiny on purpose: MarkBadge (the menu chip) reads it from the index chunk.
export const CARD_RAR = {
  common: { line: '#A9B4C8', fill: '#262b38', inner: '#5d6678' },
  rare: { line: '#3D8BFF', fill: '#0f2350', inner: '#1f4fa8' },
  epic: { line: '#B04BFF', fill: '#2a0e4a', inner: '#6a20b0' },
  legendary: { line: '#FFC23D', fill: '#3d2a05', inner: '#b07a10' },
  mythic: { line: '#FF3D7F', fill: '#4a0a22', inner: '#a8164e' },
  secret: { line: '#FFFFFF', fill: '#050208', inner: '#1c1c22' },
  permanent: { line: '#2EFFE0', fill: '#06302b', inner: '#0f8f7e' },
};
export const RAINBOW_TEETH = ['#FF3D7F', '#FFC23D', '#2EFFE0', '#3D8BFF', '#B04BFF'];
/** A locked card: the face and the inner disc go near-black; the cog keeps its tier colour. */
export const LOCKED = { fill: '#120a1c', inner: '#0b0612' };
export const cardTier = (t) => (CARD_RAR[t] ? t : 'common');
