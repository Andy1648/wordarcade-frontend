// menuModes.js — WHICH SIX CARDS fill the desktop menu's first screen (feat/menu-six-grid).
//
// The menu used to page its cards three at a time behind ← / → arrows. It is now one 3-across grid with no arrows:
// the first two rows (six cards) fill the first screen, the next row peeks in under them, and the cards area
// scrolls down to the rest (Andy nov25). This module orders them: the six below come first, `more` after.
//
// THE RULE (one line for Andy): "the six games you open most are on top; scroll down for the rest".
//   - score = how many times this browser opened the mode from the menu (`taw.menu.picks`), then the mode's
//     lifetime game words (mastery) as the tie-break, so an existing save starts from what it has actually
//     played instead of all-zero;
//   - the FEATURED mode is pinned (the first-run tour points at its card, and it is the flagship);
//   - ties fall back to the gameData order, so a fresh account always sees the same six (the last mode in
//     GAMES — WORD RACE today — is the one in the row below);
//   - the six SHOWN keep the gameData order: a card never jumps seats because its count moved.
//
// PURE core (pickMenuModes) + two tiny storage helpers. No gameData import (see nextMode.js for why).

export const MENU_CARD_MAX = 6;
export const MENU_PICKS_KEY = 'taw.menu.picks';

const n0 = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/**
 * games   - the mode list in menu order (GAMES)
 * picks   - { [id]: times opened from the menu }
 * words   - { [id]: lifetime game words } (tie-break)
 * pinned  - ids that always show (the featured mode)
 * max     - how many cards fit (MENU_CARD_MAX)
 * Returns { shown, more } — both in `games` order.
 */
export function pickMenuModes({ games = [], picks = {}, words = {}, pinned = [], max = MENU_CARD_MAX } = {}) {
  const list = (games || []).filter((g) => g && g.enabled !== false);
  if (list.length <= max) return { shown: list, more: [] };
  const rank = list
    .map((g, i) => ({ g, i, pin: pinned.includes(g.id) ? 1 : 0, p: n0(picks[g.id]), w: n0(words[g.id]) }))
    .sort((a, b) => b.pin - a.pin || b.p - a.p || b.w - a.w || a.i - b.i);
  const keep = new Set(rank.slice(0, max).map((r) => r.g.id));
  return { shown: list.filter((g) => keep.has(g.id)), more: list.filter((g) => !keep.has(g.id)) };
}

export function readMenuPicks() {
  try {
    const raw = JSON.parse(localStorage.getItem(MENU_PICKS_KEY) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

export function bumpMenuPick(id) {
  if (!id) return;
  try {
    const all = readMenuPicks();
    all[id] = n0(all[id]) + 1;
    localStorage.setItem(MENU_PICKS_KEY, JSON.stringify(all));
  } catch {
    /* storage blocked — the menu just keeps the default six */
  }
}
