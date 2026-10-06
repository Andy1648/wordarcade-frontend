// season.test.js — THE SEASON2 FLAG IS OFF BY DEFAULT, AND OFF CHANGES NOTHING (PROGRESSION v3, phase 3).
// Every number below is the live game's (Rebirth Rush, econ 12) as it was before the v3 modules existed — pinned
// against the pre-v3 source (git archive of feat/server-rebirth, same values). The flag-ON rules are in
// v3/v3.test.js (its own process: the flag is fixed at module load).
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};

const S = await import('./season.js');
const X = await import('./xp.js');
const W = await import('./wins.js');
const G = await import('./gemsCore.js');
const GM = await import('./gems.js');
const C = await import('./claims.js');
const R = await import('./rank.js');
const ST = await import('./stars.js');
const SH = await import('./shop.js');
const V3S = await import('./v3/store.js');
const U = await import('./v3/unlocks.js');

test('SEASON2 defaults OFF (no ?season2, no VITE_SEASON2, no global) and keys are the live ones', () => {
  assert.equal(S.SEASON2, false);

  assert.equal(G.GEMS_KEY, 'taw.gems');
  assert.equal(Object.keys(S.V3).length, 0, 'nothing installed');
});

test('OFF: the level curve, XP per letter, KEY, rebirth and wins numbers are exactly the live ones', () => {
  assert.deepEqual([1, 2, 5, 10, 50, 100].map(X.need), [100, 110, 170, 350, 94230, 102114210]);
  assert.deepEqual([0, 1, 5, 10].map(X.keyXpMult), [1, 2, 50, 2150]);
  assert.equal(X.levelXpPerLetter(3, 2, 1, 0), 2500); // 10 × KEY ×10 × 5^2
  assert.deepEqual([1, 2, 3, 4, 8].map((t) => X.keyTierCostAt(t)), [50, 290, 1730, 10370, 13436930]);
  assert.deepEqual([0, 1, 3, 10].map((r) => X.rebirthThreshold(r)), [25, 50, 100, 275]);
  assert.equal(X.rebirthMult(2), 25);
  assert.equal(W.perWordWins({ mode: 'wordBomb', wordLength: 5, rebirthCount: 0 }), 10);
  assert.equal(W.perWordWins({ mode: 'chain', wordLength: 7, rebirthCount: 2 }), 700);
  assert.deepEqual(X.creditXp({ level: 1, frac: 0 }, 1000).state, { level: 7, intoLevel: 140, frac: 0.6086956521739131 });
  assert.equal(X.keyTierXp(), 20);
  assert.equal('stars' in W.perWordFactors({ mode: 'wordBomb' }), false, 'no ★ row on the live receipt');
});

test('OFF: the gem table and the roll price are the live ones', () => {
  assert.equal(G.GEM_DROP_CHANCE, 1 / 30);
  assert.deepEqual([G.GEM_DROP_MIN, G.GEM_DROP_MAX, G.BOT_WIN, G.PER_PLAYER_BEATEN, G.STREAK_PER_WIN, G.LEVEL_UP, G.REBIRTH, G.ROLL_PRICE_GEMS], [1, 3, 3, 3, 1, 2, 20, 10]);
  // streak: STREAK_PER_WIN × the wins in a row before (not v3's flat +4)
  const p = GM.gameResultPayout({ iWon: true, rivals: [{ id: 'b', isBot: true }], streak: 3 });
  assert.deepEqual(p.lines, [{ reason: 'bot', amount: 3 }, { reason: 'streak', amount: 3 }]);
});

test('OFF: claims, ranks, star perks, cosmetics and every unlock behave as today', () => {
  assert.equal(C.claimPolicy('achievement'), 'inbox');
  assert.equal(C.claimPolicy('rank'), 'inbox');
  assert.equal(C.claimPolicy('collection'), 'instant');
  assert.equal(R.RANKS.length, 18);
  assert.equal(R.rankTitle(1), 'ROOKIE');
  assert.equal(R.rankTitle(150), 'MYTHIC');
  assert.equal(ST.starsForRebirth(50, 0), 9); // gate 25: 1 + floor(25 / 3)
  assert.equal(SH.POP_STYLES.find((i) => i.id === 'chrome').price, 6000, 'cosmetics keep their wins price');
  assert.equal(S.V3.ready, undefined, 'the v3 rules are not even loaded with the flag OFF');
  for (const u of U.UNLOCKS) assert.equal(U.featureOpen(u.id), true, `${u.id} is not gated with the flag OFF`);
  assert.equal(U.unlockLuckMult(), 1);
});

test('OFF: the season-2 stores never write and read as empty', () => {
  mem.clear();
  V3S.saveStarsV3(5);
  V3S.bumpCounter('words', 10);
  V3S.maxCounter('power', 3);
  V3S.noteMarkSeen('x');
  V3S.noteRankIndex(4);
  assert.equal(mem.size, 0, 'nothing written under taw.s2.*');
  assert.equal(V3S.getStarsV3(), 0);
  assert.equal(V3S.s2Rebirths(), 0);
  // a real rebirth writes the live keys only
  X.saveProgress({ level: 30, frac: 0 });
  ST.rebirthWithStars();
  assert.ok([...mem.keys()].every((k) => !k.startsWith('taw.s2.')), [...mem.keys()].join(','));
  assert.equal(mem.get('taw.rebirths'), '1');
});
