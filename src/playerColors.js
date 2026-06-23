// playerColors.js
// Per-player visual identity. Each player is assigned ONE colour from the locked
// palette for the whole session, so multiplayer reads clearly: a player's colour
// follows them across the room screen, the player bar, the live typing line, the
// kill feed, their elimination flash and the end-game stats.
//
// Assignment is by join order (the roster array order, which the server keeps
// stable): player i gets PLAYER_PALETTE[i % 5]. The map is keyed by the stable
// player id, so once built from the room roster every screen that looks a player
// up by id paints them the same colour regardless of local list ordering.
//
// 6+ players reuse a hue but get an increasing `tier` (0 for the first five, 1
// for the next five, ...), which the UI renders as a small secondary marker so
// the two players sharing a hue stay distinguishable.

export const PLAYER_PALETTE = [
  '#FF2EC4', // pink
  '#2EFFE0', // cyan
  '#FFE94A', // yellow
  '#FF6B3D', // orange
  '#9A1AFF', // purple
];

// A darker companion per palette colour, for outlines/shadows in the cel style
// (mirrors the "darker shade of the fill" outline rule). Index-matched to
// PLAYER_PALETTE.
export const PLAYER_PALETTE_DARK = [
  '#A3157C', // pink
  '#179E8B', // cyan
  '#B0A015', // yellow
  '#B83D15', // orange
  '#5E0F9E', // purple
];

// Build a stable { [id]: { color, dark, index, tier } } map from an ORDERED
// roster (join order). Safe with null/missing ids.
export function buildPlayerColors(players) {
  const map = {};
  (players || []).forEach((p, i) => {
    if (!p || p.id == null) return;
    const slot = i % PLAYER_PALETTE.length;
    map[p.id] = {
      color: PLAYER_PALETTE[slot],
      dark: PLAYER_PALETTE_DARK[slot],
      index: i,
      tier: Math.floor(i / PLAYER_PALETTE.length),
    };
  });
  return map;
}

// Deterministic fallback for an id not present in the roster map (e.g. a stray
// gameState arriving before the room roster). Hashes the id onto the palette so
// the colour is still stable for that id.
export function fallbackColor(id) {
  const s = String(id == null ? '' : id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const slot = h % PLAYER_PALETTE.length;
  return { color: PLAYER_PALETTE[slot], dark: PLAYER_PALETTE_DARK[slot], index: -1, tier: 0 };
}

// Resolve a player's identity from a prebuilt map, falling back to a hashed
// colour so callers always get a usable { color, dark, index, tier }.
export function resolvePlayerColor(map, id) {
  return (map && map[id]) || fallbackColor(id);
}
