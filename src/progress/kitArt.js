// kitArt.js — which POP STYLES have their KIT art painted yet (oct27): the bar fill strip and the crit burst
// (public/shop/pop/bar-<id>.webp, crit-<id>.webp). A look not listed keeps its burst + the plain dress, so a half-painted
// set never points at a missing file. Leaf module, no imports — the menu's first paint reads it for the bar skin.
export const KIT_PAINTED = new Set(['chrome', 'inferno', 'void', 'prism', 'toxic', 'ember', 'frost']);
/** The XP bar's painted fill while `id` is worn, or null. */
export const kitBarOf = (id) => (KIT_PAINTED.has(id) ? `/shop/pop/bar-${id}.webp` : null);
