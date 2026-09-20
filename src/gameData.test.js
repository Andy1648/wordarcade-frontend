// node --test — the menu's game table, and the one value derived from it.
//
// FEATURED_GAME exists because the XP-bar hint under the menu's level bar has to quote the rate
// of the card the menu is pointing AT. It used to divide by the MENU's own per-word rate, which
// is ×1 and therefore the slowest in the game — so the first progression number a new player
// ever read was the worst one available, printed directly above a FEATURED card advertising
// twice it. Both numbers were correct; the pair was incoherent.
//
// The e2e half of this lives in e2e/menu.spec.js, which compares the two RENDERED strings. This
// half pins the derivation: one flag, one card, and never a hardcoded id.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, FEATURED_GAME, MORE_MODES } from './gameData.js';

test('exactly ONE game carries the featured flag', () => {
  const flagged = GAMES.filter((g) => g.featured);
  assert.equal(flagged.length, 1, `featured: ${flagged.map((g) => g.id).join(', ') || 'none'}`);
});

test('FEATURED_GAME is DERIVED from that flag, not named', () => {
  assert.ok(FEATURED_GAME, 'there must always be a featured game to quote');
  assert.equal(FEATURED_GAME, GAMES.find((g) => g.featured));
  // It has to be playable — the hint divides by its rate, and a disabled mode has none.
  assert.equal(FEATURED_GAME.enabled, true);
  // ...and it must be one of the cards actually on the grid, not a detached object.
  assert.ok(GAMES.includes(FEATURED_GAME));
});

test('the featured game is UNGATED — a hint nobody can act on is worse than none', () => {
  // The hint is the first progression line a brand-new LV1 account reads. If the mode it quotes
  // were level-locked the number would be a rate the player cannot earn yet.
  assert.ok(!FEATURED_GAME.unlockLevel, `${FEATURED_GAME.id} is gated at LV${FEATURED_GAME.unlockLevel}`);
});

test('MORE_MODES still counts the real grid', () => {
  assert.equal(MORE_MODES, Math.max(1, GAMES.length - 1));
});
