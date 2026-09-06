// appConfig.js — pure, side-effect-free helpers/constants lifted out of App.jsx (refactor/app-split-6).
// No React, no window reads at module load, no game/WS state — moving them changes nothing.

// The music button's border/glyph colour, matched to each screen's accent.
export const SCREEN_ACCENT = {
  home: '#ff4fa3',
  lobby: '#2EFFE0',
  browse: '#2EFFE0',
  room: '#FFE94A',
  game: '#FF6B3D',
  'cg-arm': '#FF6B3D', // matches the game accent (cg arm hands straight into it)
  credits: '#9A1AFF',
  // SAT RUSH is a duotone manga surface; the ♫ button floats over the black gutter,
  // so it wears PAPER (reads on the void) instead of the house pink.
  'sat-rush': '#F0EAD9',
};

// The lobby "mode" can be a generic entry ('solo' for Create Room, 'join'
// for Join Room) or a specific game id picked from a homepage card. These are
// the real backend game types we can lock the room into and preselect; any
// other card would fall back to the in-room mode picker (and default Word Bomb).
export const PRESELECTABLE_GAMES = ['word-bomb', 'category-blitz'];

export function isPreselectableGame(mode) {
  return PRESELECTABLE_GAMES.includes(mode);
}

// Draw the 1/40 lucky verdict for one accepted word. Normally the seeded luck.js oracle; a test seam
// (mirrors window.__TAW_NO_ACHIEVEMENT_GRANT) lets e2e force it off/always so the combo-boosted
// payout-precision specs stay deterministic. Undefined in production → the real random oracle.
export function drawLucky(oracle) {
  try {
    const h = typeof window !== 'undefined' ? window.__TAW_LUCKY : undefined;
    if (h === 'off') return false;
    if (h === 'always') return true;
  } catch {
    /* no window / blocked → fall through to the real oracle */
  }
  return oracle.next();
}
