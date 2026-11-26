// menuModes.test.js — the six-card menu's "which six" rule (feat/menu-six-grid). Pure, node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickMenuModes, MENU_CARD_MAX } from './menuModes.js';

// gameData's GAMES order today (kept local: gameData won't load under node — see nextMode.test.js).
const GAMES = ['word-bomb', 'category-blitz', 'sat-rush', 'miner', 'chain', 'fuse', 'word-race'].map((id) => ({ id, enabled: true }));
const ids = (list) => list.map((g) => g.id);

test('six cards max', () => {
  assert.equal(MENU_CARD_MAX, 6);
});

test('a fresh save sees the first six in menu order; the last mode goes under MORE', () => {
  const { shown, more } = pickMenuModes({ games: GAMES, pinned: ['word-bomb'] });
  assert.deepEqual(ids(shown), ['word-bomb', 'category-blitz', 'sat-rush', 'miner', 'chain', 'fuse']);
  assert.deepEqual(ids(more), ['word-race']);
});

test('the least-opened mode moves under MORE; the six shown keep the menu order', () => {
  const picks = { 'word-race': 4, chain: 2, fuse: 1, 'sat-rush': 3, 'category-blitz': 5 };
  const { shown, more } = pickMenuModes({ games: GAMES, picks, pinned: ['word-bomb'] });
  assert.deepEqual(ids(more), ['miner']);
  assert.deepEqual(ids(shown), ['word-bomb', 'category-blitz', 'sat-rush', 'chain', 'fuse', 'word-race']);
});

test('the featured mode is pinned even at zero opens', () => {
  const picks = { 'category-blitz': 9, 'sat-rush': 9, miner: 9, chain: 9, fuse: 9, 'word-race': 9 };
  const { shown, more } = pickMenuModes({ games: GAMES, picks, pinned: ['word-bomb'] });
  assert.ok(ids(shown).includes('word-bomb'));
  assert.equal(more.length, 1);
});

test('game words break a tie in opens (an existing save starts from what it played)', () => {
  const { more } = pickMenuModes({ games: GAMES, words: { 'word-race': 300 }, pinned: ['word-bomb'] });
  assert.deepEqual(ids(more), ['fuse']);
});

test('six or fewer modes: everything shows, MORE is empty', () => {
  const { shown, more } = pickMenuModes({ games: GAMES.slice(0, 6) });
  assert.equal(shown.length, 6);
  assert.deepEqual(more, []);
});

test('a disabled mode never shows and never sits under MORE', () => {
  const games = [...GAMES.slice(0, 6), { id: 'word-race', enabled: false }];
  const { shown, more } = pickMenuModes({ games });
  assert.equal(shown.length, 6);
  assert.deepEqual(more, []);
});

test('garbage counts are read as zero', () => {
  const { more } = pickMenuModes({ games: GAMES, picks: { miner: -3, chain: 'x', fuse: NaN }, words: null || {} });
  assert.deepEqual(ids(more), ['word-race']);
});
