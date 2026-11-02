// kitIds.js — which POP STYLES have their KIT art painted (oct27). A leaf with no imports (no CSS), so the node-tested
// popLooks.js can read it; kitArt.js re-exports it alongside the bar kit + its lazy styles.
export const KIT_PAINTED = new Set(['chrome', 'inferno', 'void', 'prism', 'toxic', 'ember', 'frost', 'gold', 'plasma', 'nova', 'eclipse', 'legend']);
// painted LEADING-EDGE caps (public/shop/pop/edge-<id>.webp); a kit without one rides its burst at the edge
export const EDGE_PAINTED = new Set(['chrome', 'inferno', 'void', 'prism', 'toxic', 'ember', 'frost', 'gold', 'plasma', 'nova', 'eclipse', 'legend']);
