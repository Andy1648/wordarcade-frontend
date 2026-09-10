// nextMode.test.js — the "TRY <MODE>" chooser (feat/solo-endgame). Pure, node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTryMode, isModeUnlocked, modeDisplayName, MODE_PATH, KNOWN_MODES } from './nextMode.js';

// A stand-in for gameData's GAMES with the real ids, names and unlock levels. Kept local so this
// test stays pure (gameData imports satRush/config extensionlessly and won't load under node).
const GAMES = [
  { id: 'word-bomb', name: 'WORD\nBOMB', enabled: true },
  { id: 'category-blitz', name: 'CATEGORY\nBLITZ', enabled: true },
  { id: 'sat-rush', name: 'SAT\nRUSH', enabled: true },
  { id: 'chain', name: 'CHAIN', unlockLevel: 20, enabled: true },
  { id: 'fuse', name: 'FUSE', unlockLevel: 25, enabled: true },
];

test('the fixture matches the modes mastery actually tracks', () => {
  // If a 6th mode ships, mastery and this chooser must learn about it together.
  assert.deepEqual(GAMES.map((g) => g.id).sort(), [...KNOWN_MODES].sort());
  for (const g of GAMES) assert.ok(MODE_PATH[g.id], `${g.id} has a route path`);
});

test('modeDisplayName flattens the two-line menu name', () => {
  assert.equal(modeDisplayName({ name: 'WORD\nBOMB' }), 'WORD BOMB');
  assert.equal(modeDisplayName({ name: 'CHAIN' }), 'CHAIN');
  assert.equal(modeDisplayName(null), '');
});

test('isModeUnlocked gates only on unlockLevel, and honours enabled:false', () => {
  assert.equal(isModeUnlocked({ id: 'word-bomb' }, 1), true, 'ungated modes are always open');
  assert.equal(isModeUnlocked({ id: 'chain', unlockLevel: 20 }, 19), false);
  assert.equal(isModeUnlocked({ id: 'chain', unlockLevel: 20 }, 20), true, 'the gate level itself unlocks');
  assert.equal(isModeUnlocked({ id: 'x', enabled: false }, 99), false);
});

test('picks the LEAST-played unlocked mode that is not the one just played', () => {
  const pick = pickTryMode({
    current: 'chain',
    level: 30, // everything unlocked
    counts: { 'word-bomb': 500, 'category-blitz': 400, 'sat-rush': 10, chain: 900, fuse: 300 },
    games: GAMES,
  });
  assert.equal(pick.id, 'sat-rush');
  assert.equal(pick.name, 'SAT RUSH');
  assert.equal(pick.path, '/sat-rush');
});

test('NEVER suggests the mode just played, even when it is the least played', () => {
  for (const current of GAMES.map((g) => g.id)) {
    const counts = Object.fromEntries(GAMES.map((g) => [g.id, g.id === current ? 0 : 999]));
    const pick = pickTryMode({ current, level: 30, counts, games: GAMES });
    assert.ok(pick, `${current} should still get a suggestion`);
    assert.notEqual(pick.id, current, `${current} suggested itself`);
  }
});

test('NEVER suggests a locked mode', () => {
  // LV 19: CHAIN (20) and FUSE (25) are both still locked, and both read as never-played.
  const counts = { 'word-bomb': 900, 'category-blitz': 900, 'sat-rush': 900, chain: 0, fuse: 0 };
  const pick = pickTryMode({ current: 'word-bomb', level: 19, counts, games: GAMES });
  assert.ok(pick);
  assert.ok(pick.id !== 'chain' && pick.id !== 'fuse', `suggested the locked ${pick.id}`);
  // At LV 20 CHAIN becomes eligible and its 0 count wins outright.
  assert.equal(pickTryMode({ current: 'word-bomb', level: 20, counts, games: GAMES }).id, 'chain');
});

test('an unplayed mode (count missing entirely) beats a played one', () => {
  // sat-rush is absent from counts — that must read as 0, not as "unknown, skip it".
  const pick = pickTryMode({
    current: 'chain',
    level: 30,
    counts: { 'word-bomb': 5, 'category-blitz': 5, fuse: 5 },
    games: GAMES,
  });
  assert.equal(pick.id, 'sat-rush');
  assert.equal(pick.plays, 0);
});

test('ties break deterministically on menu order, so the suggestion never flickers', () => {
  const counts = Object.fromEntries(GAMES.map((g) => [g.id, 0]));
  const first = pickTryMode({ current: 'chain', level: 30, counts, games: GAMES });
  for (let i = 0; i < 20; i += 1) {
    assert.equal(pickTryMode({ current: 'chain', level: 30, counts, games: GAMES }).id, first.id);
  }
  assert.equal(first.id, 'word-bomb', 'the earliest listed unlocked mode wins a tie');
});

test('returns null when there is nothing honest to offer', () => {
  // A brand-new account playing Word Bomb with only the gated modes besides it.
  assert.equal(
    pickTryMode({ current: 'word-bomb', level: 1, counts: {}, games: [GAMES[0], GAMES[3], GAMES[4]] }),
    null,
    'everything else locked -> no row'
  );
  assert.equal(pickTryMode({ current: 'chain', level: 30, counts: {}, games: [GAMES[3]] }), null, 'only itself');
  assert.equal(pickTryMode({ games: [] }), null);
  assert.equal(pickTryMode(), null, 'no args must not throw');
});
