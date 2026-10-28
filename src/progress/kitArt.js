// kitArt.js — which POP STYLES have their KIT art painted yet (oct27): the bar fill strip and the crit burst
// (public/shop/pop/bar-<id>.webp, crit-<id>.webp). A look not listed keeps its burst + the plain dress, so a half-painted
// set never points at a missing file. Leaf module, no imports — the menu's first paint reads it for the bar skin.
export const KIT_PAINTED = new Set(['chrome', 'inferno', 'void', 'prism', 'toxic', 'ember', 'frost', 'gold', 'plasma', 'nova']);
// painted LEADING-EDGE caps (public/shop/pop/edge-<id>.webp); a kit without one rides its burst at the edge
export const EDGE_PAINTED = new Set(['chrome', 'inferno', 'void', 'prism', 'toxic', 'ember', 'frost', 'gold', 'plasma', 'nova']);
/** The XP bar's painted fill while `id` is worn, or null. */
export const kitBarOf = (id) => (KIT_PAINTED.has(id) ? `/shop/pop/bar-${id}.webp` : null);

// THE KIT's BAR, end to end (oct27, Andy: "the progress bar still doesnt fit with the theme"): the frame is the look's
// coloured outline (a darker shade of its fill — the house rule), the empty channel its own dark well, the LV / goal
// plates its colours, the ghost and the level sweep its light, a painted cap rides the fill's leading edge, and a level
// wrap slams the look's crit art on the goal plate. edge = the outline · well = the channel · hi = numerals / light.
const THEME = {
  chrome: { edge: '#6B7790', well: '#161B26', hi: '#E8EEF6' },
  inferno: { edge: '#B8320A', well: '#240800', hi: '#FFB23D' },
  void: { edge: '#6A22C8', well: '#12052A', hi: '#C98CFF' },
  prism: { edge: '#B44CFF', well: '#160A28', hi: '#2EFFE0' },
  toxic: { edge: '#4C9A00', well: '#0B1A02', hi: '#9EFF2E' },
  ember: { edge: '#A8200F', well: '#1A0604', hi: '#FF6B3D' },
  frost: { edge: '#2A8CC0', well: '#061826', hi: '#C9F4FF' },
  gold: { edge: '#A87A00', well: '#1E1400', hi: '#FFD54A' },
  plasma: { edge: '#B0136A', well: '#22041A', hi: '#FF9AD5' },
  nova: { edge: '#C9A800', well: '#1A1A08', hi: '#FFFFFF' },
  eclipse: { edge: '#FF9A1F', well: '#050208', hi: '#FF9A1F' },
  legend: { edge: '#FF4FA3', well: '#1A0B2E', hi: '#FFE94A' },
};
/** The whole bar kit while `id` is worn (painted looks only), or null. */
export function kitOf(id) {
  if (!KIT_PAINTED.has(id) || !THEME[id]) return null;
  return {
    id,
    ...THEME[id],
    fill: `/shop/pop/bar-${id}.webp`,
    crit: `/shop/pop/crit-${id}.webp`,
    cap: EDGE_PAINTED.has(id) ? `/shop/pop/edge-${id}.webp` : `/shop/pop/burst-${id}.webp`,
  };
}
