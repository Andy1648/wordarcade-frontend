// gems.test.js — GEMS (Andy oct5): the one door, the ledger, the drops (injectable rng), the game results, the
// level-up high-water mark, the rebirth grant — and the hooks that pay them (wins.awardWordXp, xp.saveProgress,
// stars.rebirthWithStars).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from './gems.js';
import { awardWordXp } from './wins.js';
import { saveProgress } from './xp.js';
import { rebirthWithStars } from './stars.js';

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  G.resetGemsLedger();
  G.setGemRng(null);
  try {
    return fn(map);
  } finally {
    G.setGemRng(null);
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
}
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const migrated = (o = {}) => JSON.stringify({ v: 1, bal: 0, peak: 1, streak: 0, mig: 1, ...o });

test('the tuning constants Andy set', () => {
  assert.equal(G.GEM_DROP_CHANCE, 1 / 15);
  assert.equal(G.GEM_DROP_MIN, 1);
  assert.equal(G.GEM_DROP_MAX, 3);
  assert.equal(G.BOT_WIN, 5);
  assert.equal(G.PER_PLAYER_BEATEN, 5);
  assert.equal(G.STREAK_PER_WIN, 1);
  assert.equal(G.LEVEL_UP, 2);
  assert.equal(G.REBIRTH, 20);
  assert.equal(G.ROLL_PRICE_GEMS, 10);
});

test('the one door: grant adds, writes a ledger entry, tells both channels; spend refuses a short balance', () => {
  withStorage({}, () => {
    const bal = [];
    const led = [];
    const off1 = G.subscribeGems((v) => bal.push(v));
    const off2 = G.subscribeGemLedger((e) => led.push(e));
    const mark = G.gemsLedgerMark();
    assert.equal(G.grantGems(3, 'drop', { mode: 'chain' }), 3);
    assert.equal(G.grantGems(0, 'drop'), 0, '0 is a no-op');
    assert.equal(G.grantGems(-5, 'drop'), 0);
    assert.equal(G.grantGems(5.9, 'bot'), 5, 'whole gems');
    assert.equal(G.getGems(), 8);
    assert.deepEqual(bal, [3, 8]);
    assert.deepEqual(led.map((e) => [e.amount, e.reason]), [[3, 'drop'], [5, 'bot']]);
    assert.deepEqual(G.sumGems(G.gemsLedgerSince(mark)), { total: 8, by: { drop: 3, bot: 5 } });
    assert.equal(G.spendGems(10), false);
    assert.equal(G.getGems(), 8, 'a refused spend spends nothing');
    assert.equal(G.canAffordRoll(), false);
    G.grantGems(2, 'level');
    assert.equal(G.canAffordRoll(), true);
    assert.equal(G.spendGems(10), true);
    assert.equal(G.getGems(), 0);
    off1();
    off2();
  });
});

test('a blocked / corrupt store reads as 0 and never throws', () => {
  withStorage({ [G.GEMS_KEY]: '{not json' }, () => {
    assert.equal(G.getGems(), 0);
  });
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  try {
    assert.equal(G.getGems(), 0);
    assert.doesNotThrow(() => G.grantGems(1, 'drop'));
  } finally {
    globalThis.localStorage = saved;
  }
});

test('drops: 1 in 15, then 1–3 gems — injectable rng; the menu never drops', () => {
  assert.equal(G.rollGemDrop(seq(0.5)), 0);
  assert.equal(G.rollGemDrop(seq(1 / 15)), 0, 'the chance is strict');
  assert.equal(G.rollGemDrop(seq(0, 0)), 1);
  assert.equal(G.rollGemDrop(seq(0, 0.5)), 2);
  assert.equal(G.rollGemDrop(seq(0, 0.999)), 3);
  // the long-run rate: 1/15 × mean 2 = 0.1333 gems per word
  let s = 0x9e3779b9;
  const rng = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  let total = 0;
  const N = 150000;
  for (let i = 0; i < N; i++) total += G.rollGemDrop(rng);
  assert.ok(Math.abs(total / N - 2 / 15) < 0.006, `per word ${total / N}`);
  withStorage({}, () => {
    G.setGemRng(seq(0, 0.999));
    assert.equal(G.dropGemsForWord({ mode: 'menu' }), 0);
    assert.equal(G.dropGemsForWord({ mode: 'fuse' }), 3);
    assert.equal(G.gemsLedger()[0].reason, 'drop');
  });
});

test('HOOK: every accepted game word goes through awardWordXp, which rolls the drop', () => {
  withStorage({}, () => {
    G.setGemRng(seq(0, 0.5)); // always drops 2
    for (const mode of ['word-bomb', 'category-blitz', 'sat-rush', 'chain', 'fuse', 'word-race']) {
      const r = awardWordXp({ mode, wordLength: 5, weight: 1, word: 'gizmo' });
      assert.equal(r.gems, 2, mode);
    }
    assert.equal(G.getGems(), 12);
    G.setGemRng(seq(0.9));
    assert.equal(awardWordXp({ mode: 'chain', wordLength: 5 }).gems, 0, 'no drop');
  });
});

test('game results: bots only → BOT_WIN on a win; people → 5 per person beaten; a loss can still beat some', () => {
  const bot = (id) => ({ id, isBot: true });
  const human = (id, beaten = false) => ({ id, isBot: false, beaten });
  assert.deepEqual(G.gameResultPayout({ iWon: true, rivals: [bot('a'), bot('b')] }).lines, [{ reason: 'bot', amount: 5 }]);
  assert.equal(G.gameResultPayout({ iWon: false, rivals: [bot('a')] }).total, 0);
  assert.equal(G.gameResultPayout({ iWon: true, rivals: [human('a'), human('b'), human('c')] }).total, 15, 'placement scales it');
  assert.equal(G.gameResultPayout({ iWon: false, rivals: [human('a', true), human('b'), human('c', true)] }).total, 10, '2nd of 4 beat two');
  assert.equal(G.gameResultPayout({ iWon: true, rivals: [human('a'), bot('b')] }).total, 5, 'a bot in a people game is not a person beaten');
  assert.equal(G.gameResultPayout({ iWon: true, rivals: [human('tab2')], selfIds: ['tab2'] }).total, 0, 'another tab of this browser never pays');
  assert.equal(G.gameResultPayout({ iWon: true, rivals: [], streak: 0 }).total, 0, 'nobody there');
});

test('win streak: +1 per win in a row before this one; a loss ends it', () => {
  const bots = [{ id: 'b', isBot: true }];
  const a = G.gameResultPayout({ iWon: true, rivals: bots, streak: 0 });
  assert.equal(a.total, 5);
  assert.equal(a.streak, 1);
  const b = G.gameResultPayout({ iWon: true, rivals: bots, streak: 1 });
  assert.deepEqual(b.lines, [{ reason: 'bot', amount: 5 }, { reason: 'streak', amount: 1 }]);
  assert.equal(G.gameResultPayout({ iWon: true, rivals: bots, streak: 4 }).total, 9);
  assert.equal(G.gameResultPayout({ iWon: false, rivals: bots, streak: 4 }).streak, 0);
});

test('payGameResult pays once per game key and carries the streak in storage', () => {
  withStorage({}, () => {
    const bots = [{ id: 'b', isBot: true }];
    assert.equal(G.payGameResult({ key: 'g1', iWon: true, rivals: bots }).total, 5);
    assert.equal(G.payGameResult({ key: 'g1', iWon: true, rivals: bots }).total, 0, 'a re-delivered game over pays nothing');
    assert.equal(G.payGameResult({ key: 'g2', iWon: true, rivals: bots }).total, 6);
    assert.equal(G.getWinStreak(), 2);
    assert.equal(G.payGameResult({ key: 'g3', iWon: false, rivals: bots }).total, 0);
    assert.equal(G.getWinStreak(), 0);
    assert.equal(G.payGameResult({ key: 'g4', iWon: true, rivals: [] }).total, 0, 'a game alone pays nothing');
    assert.equal(G.getGems(), 11);
    assert.deepEqual(G.sumGems(G.gemsLedger()).by, { bot: 10, streak: 1 });
  });
});

test('level up: +2 per level past the save high-water mark (a re-climb pays only past the old peak)', () => {
  withStorage({ [G.GEMS_KEY]: migrated({ peak: 10 }) }, () => {
    assert.equal(G.noteLevelReached(9), 0);
    assert.equal(G.noteLevelReached(10), 0);
    assert.equal(G.noteLevelReached(13), 6);
    assert.equal(G.noteLevelReached(1), 0, 'a rebirth reset never pays');
    assert.equal(G.noteLevelReached(14), 2);
    assert.equal(G.getGems(), 8);
  });
  withStorage({}, () => {
    assert.equal(G.noteLevelReached(50), 0, 'nothing pays before the starting grant stamps the mark');
  });
});

test('HOOK: xp.saveProgress pays the level-up; stars.rebirthWithStars pays +20', () => {
  withStorage({ [G.GEMS_KEY]: migrated() }, () => {
    saveProgress({ level: 4, frac: 0 });
    assert.equal(G.getGems(), 6, 'LV1 → LV4 = 3 levels');
    saveProgress({ level: 4, frac: 0.5 });
    assert.equal(G.getGems(), 6, 'no level, no gems');
    saveProgress({ level: 15, frac: 0 });
    const before = G.getGems();
    assert.equal(before, 28);
    rebirthWithStars();
    const by = G.sumGems(G.gemsLedger()).by;
    assert.equal(by.rebirth, 20);
    assert.equal(G.getGems(), before + 20, 'the reset to LV1 pays nothing; the rebirth pays 20');
  });
});
