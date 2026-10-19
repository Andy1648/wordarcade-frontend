// notify.test.js — P7 POPUP PURGE WITH THE SEASON2 FLAG ON (its own process: the flag is fixed at module load).
// Rank-ups pay nothing and are said once at the TOP edge; unlocks are said once as RIGHT-edge toasts; the menu fx
// plays no centre card; nothing enters a claim inbox (the menu's claim popup has nothing to show). The flag-OFF side
// (nothing changes) is ../popupPurge.off.test.js.
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
globalThis.location = { search: '?season2=1' };

const S = await import('../season.js');
await import('./install.js');
const N = await import('./notify.js');
const RK = await import('./ranks.js');
const C = await import('../claims.js');
const ACH = await import('../achievements.js');
const W = await import('../wins.js');
const G = await import('../gemsCore.js');

const reset = () => mem.clear();

test('the flag is on', () => {
  assert.equal(S.SEASON2, true);
});

test('rankNews: up only, old → new with the v3 names (INKLING … ENDGAME); never a drop, never a repeat', () => {
  assert.deepEqual(N.rankNews(0, 2), { from: { name: 'INKLING', req: 'R0' }, to: { name: 'CLACKER', req: 'R2' } });
  assert.deepEqual(N.rankNews(10, 11).to, { name: 'VOIDTYPER', req: '★1' });
  assert.equal(N.rankNews(3, 3), null);
  assert.equal(N.rankNews(5, 2), null);
  assert.equal(N.rankNews(NaN, 2), null);
  assert.deepEqual(N.rankNews(14, 99).to.name, 'ENDGAME', 'clamped to the ladder');
});

test('unlockNews: every rebirth unlock open and not yet said, in ladder order, with its R code', () => {
  assert.deepEqual(N.unlockNews([], { rebirths: 0, stars: 0 }), []);
  const r3 = N.unlockNews([], { rebirths: 3, stars: 0 });
  assert.deepEqual(r3.map((u) => [u.code, u.label]), [['R1', 'AUTO ROLL'], ['R2', 'AUTO REBIRTH']], 'ROLL + INDEX is open from the start — never news');
  assert.ok(r3.every((u) => u.tile && u.icon), 'each toast has a tile colour and a kit icon');
  assert.deepEqual(N.unlockNews(['autoRoll'], { rebirths: 3, stars: 0 }).map((u) => u.id), ['autoRebirth']);
  // ASCEND needs the climb; the others are kept by ★
  assert.deepEqual(N.unlockNews([], { rebirths: 0, stars: 1 }).map((u) => u.id), ['autoRoll', 'autoRebirth', 'mark2', 'luck', 'odLong', 'powerSale', 'drop2']);
});

test('checkNews: the first look is silent; a rebirth then says RANK UP + its unlock ONCE; nothing pays', () => {
  reset();
  const store = globalThis.localStorage;
  const first = N.checkNews({ state: { rebirths: 0, stars: 0 }, best: 0, store });
  assert.deepEqual(first, { rank: null, unlocks: [] }, 'a fresh season save announces nothing');
  const wins0 = W.getWins();
  const gems0 = G.getGems();
  const after = N.checkNews({ state: { rebirths: 1, stars: 0 }, best: 0, store });
  assert.deepEqual(after.rank, { from: { name: 'INKLING', req: 'R0' }, to: { name: 'TYPO', req: 'R1' } });
  assert.deepEqual(after.unlocks.map((u) => u.label), ['AUTO ROLL']);
  assert.equal(W.getWins(), wins0, 'a rank-up pays no wins');
  assert.equal(G.getGems(), gems0, 'a rank-up pays no gems');
  assert.deepEqual(N.checkNews({ state: { rebirths: 1, stars: 0 }, best: 0, store }), { rank: null, unlocks: [] }, 'said once');
  // a save that arrives already past things (the first look) never replays them
  reset();
  assert.deepEqual(N.checkNews({ state: { rebirths: 7, stars: 0 }, best: 7, store }), { rank: null, unlocks: [] });
  // the shown rank is the best ever (an ascension resets rebirths but every ★ rank sits above R10)
  const asc = N.checkNews({ state: { rebirths: 0, stars: 1 }, best: 7, store });
  assert.equal(asc.rank.to.name, 'VOIDTYPER');
  assert.equal(asc.rank.from.name, 'CAPSLOCK');
});

test('checkNews survives blocked storage (says nothing it cannot remember, never throws)', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(N.checkNews({ state: { rebirths: 2, stars: 0 }, best: 0, store: broken }), { rank: null, unlocks: [] });
});

test('wrapFx: every CENTRE card but LEVEL N is gone; unlock-ish cards become edge toasts; per-key motion passes through', () => {
  const calls = [];
  const api = {};
  for (const k of ['letterPop', 'tapPop', 'edgePulse', 'celebrate', 'milestoneBusyMs', 'announce', 'tierUp', 'rebirthCelebration', 'rebirthRush', 'winsStamp', 'winsHint']) {
    api[k] = (...a) => calls.push([k, ...a]);
  }
  const toasts = [];
  const fx = N.wrapFx(api, (t) => toasts.push(t));
  fx.letterPop('A', '+1');
  fx.tapPop('+1');
  fx.edgePulse('#fff');
  fx.celebrate(12);
  fx.rebirthCelebration(2);
  fx.rebirthRush(3, 5);
  fx.winsStamp(500);
  fx.winsHint();
  assert.equal(fx.milestoneBusyMs(), 0);
  // the LEVEL N card is the one centre card kept (Andy oct9: the old level-up, restored); every other centre card is gone
  assert.deepEqual(calls.map((c) => c[0]), ['letterPop', 'tapPop', 'edgePulse', 'celebrate'], 'only the level-up card reaches the live handle');
  fx.tierUp('STEEL');
  fx.announce('SMITH II', 'MARK UPGRADED', 'blurb');
  fx.announce('AUTOMATION', '+3 KEY TIER', 'BOUGHT WHILE YOU PLAYED');
  assert.deepEqual(toasts.map((t) => [t.head || 'UNLOCKED', t.label, t.icon]), [
    ['UNLOCKED', 'STEEL FRAME', 'levels'],
    ['MARK UPGRADED', 'SMITH II', 'index'],
    ['+3 KEY TIER', 'AUTOMATION', 'power'],
  ]);
  assert.equal(calls.length, 4, 'the toasts never fall back to the centre card');
});

test('no menu claim notification can exist: achievement / rank / layer / welcome claims never enter the inbox', () => {
  reset();
  for (const kind of ['achievement', 'rank', 'layer', 'collection', 'welcome']) {
    C.queueClaim({ id: `t-${kind}`, kind, label: kind, amount: 100 });
  }
  assert.equal(C.listClaims().length, 0, 'the inbox (ClaimPopup, the REWARDS count) stays empty');
  assert.equal(C.pendingCount(), 0);
  assert.deepEqual(ACH.checkAchievements(), [], 'the live achievements never pop in season 2');
  assert.deepEqual(ACH.checkRankClaims(), [], 'no wins for ranking up');
});

test('the RANK banner names come from the v3 ladder (16 ranks, R0 … ★20)', () => {
  assert.equal(RK.RANKS_V3.length, 16);
  assert.equal(RK.RANKS_V3[0].name, 'INKLING');
  assert.equal(RK.RANKS_V3[15].name, 'ENDGAME');
});

test('ACHIEVEMENT POP-UPS (Andy oct19): a tier that becomes claimable is said ONCE; the first look is silent; quiet notes it', async () => {
  reset();
  const A = await import('./achievements.js');
  const store = globalThis.localStorage;
  const rows = (c, claimed = {}) => A.achRows({ words: 0, bots: 0, mp: 0, reb: 0, epic: 0, chain: 0, power: 0, marks: [], ...c }, claimed);
  // a save that already has a ready tier: noted silently, never a burst on the first look
  assert.deepEqual(N.checkAchNews({ rows: rows({ words: 150 }), store }), []);
  assert.deepEqual(N.checkAchNews({ rows: rows({ words: 150 }), store }), [], 'and not on the next look either');
  // BEAT BOTS I becomes ready → one toast, then never again
  const t = N.checkAchNews({ rows: rows({ words: 150, bots: 10 }), store });
  assert.deepEqual(t.map((x) => [x.head, x.code, x.label, x.icon]), [['READY TO CLAIM', 'I', 'BEAT BOTS', 'achievements']]);
  assert.deepEqual(N.checkAchNews({ rows: rows({ words: 150, bots: 10 }), store }), []);
  // claimed I, then II reached → II is news
  assert.deepEqual(N.checkAchNews({ rows: rows({ bots: 50 }, { bots: 1 }), store }).map((x) => x.code), ['II']);
  // quiet (the ACHIEVEMENTS screen is open): noted, not said — and not said later either
  assert.deepEqual(N.checkAchNews({ rows: rows({ bots: 250 }, { bots: 2 }), store, quiet: true }), []);
  assert.deepEqual(N.checkAchNews({ rows: rows({ bots: 250 }, { bots: 2 }), store }), []);
  // nothing pays: the pure half has no side effects beyond its own key
  assert.deepEqual(N.achNews(rows({ bots: 10 }), { bots: 1 }), []);
  assert.equal(N.achNews(rows({ bots: 10 }), {}).length, 1);
});

test('checkAchNews survives blocked storage (silent, never throws)', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(N.checkAchNews({ rows: [{ id: 'bots', name: 'BEAT BOTS', ready: true, tier: 0 }], store: broken }), []);
});
