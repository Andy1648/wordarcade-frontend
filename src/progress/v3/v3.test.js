// v3.test.js — PROGRESSION FINAL WITH THE SEASON2 FLAG ON (claude/progression-FINAL.md "Numbers"). The flag is
// fixed at module load, so this file sets globalThis.__TAW_SEASON2__ BEFORE importing anything (node --test runs
// each file in its own process). Flag OFF is pinned in ../season.test.js.
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
await import('./install.js'); // main.jsx does this before the first render
const E = await import('./econ.js');
const CV = await import('./curve.js');
const U = await import('./unlocks.js');
const RK = await import('./ranks.js');
const A = await import('./achievements.js');
const ST3 = await import('./store.js');
const X = await import('../xp.js');
const W = await import('../wins.js');
const G = await import('../gemsCore.js');
const GM = await import('../gems.js');
const SH = await import('../shop.js');
const STARS = await import('../stars.js');
const C = await import('../claims.js');
const ACH = await import('../achievements.js');
const R = await import('../rank.js');
const BO = await import('../boost.js');
const MR = await import('../markRolls.js');

const reset = () => mem.clear();
const near = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);

test('the flag is ON and the season keeps its own save (taw.s2.*)', () => {
  assert.equal(S.SEASON2, true);
  assert.equal(S.V3.hooks.s2MapKey('taw.xp'), 'taw.s2.xp');
  assert.equal(S.V3.hooks.s2MapKey(G.GEMS_KEY), 'taw.s2.gems');
  reset();
  X.saveProgress({ level: 5, frac: 0.5 });
  X.saveRebirths(2);
  X.saveKeyTier(3);
  W.saveWins(1234);
  assert.ok([...mem.keys()].every((k) => k.startsWith('taw.s2.')), [...mem.keys()].join(','));
  assert.equal(mem.get('taw.xp'), undefined);
  assert.equal(mem.get('taw.rebirths'), undefined);
});

test('XP per letter = 1 × 2^T × 3^R × MARK (FINAL v3) — a menu key ×0.2, whole XP, floor 1', () => {
  assert.deepEqual([E.XP_BASE, E.KEY_STEP, E.REBIRTH_STEP], [1, 2, 3]);
  reset();
  assert.equal(X.levelXpPerLetter(0, 0, 1, 0), 1);
  near(X.levelXpPerLetter(3, 2, 1, 0), 8 * 9);
  near(X.levelXpPerLetter(1, 1, 1.5, 0), 2 * 3 * 1.5);
  near(X.keyXpMult(11), 2 ** 11);
  near(X.levelXpPerLetter(0, 0, 1, 20), 3); // a MYTHIC +20 BASE mark: ×(10 + 20)/10, never 1 + 20
  ST3.saveStarsV3(2);
  near(X.levelXpPerLetter(0, 0, 1, 0), 1); // ★ multiply nothing (ascension hidden)
  near(E.xpPerLetter({ power: 2, rebirths: 3, mark: 1.1 }), 4 * 27 * 1.1);
  assert.equal(X.xpPerInput({ mode: 'menu', keyTier: 0, rebirthCount: 0, markMult: 1, baseAdd: 0 }), 1, 'a menu key pays 1 at the start');
  assert.ok(Number.isFinite(X.levelXpPerLetter(5000, 5000, 1, 0)), 'finite at absurd tiers');
});

test('XP for the next level = 100 × 1.15^(n−1); a credit of any size is O(1) and exactly additive', () => {
  assert.equal(E.CURVE_GROWTH, 1.15);
  for (const L of [1, 2, 10, 100, 1000, 3000]) near(X.need(L), 100 * 1.15 ** (L - 1), 1e-9);
  assert.equal(X.need(1), 100);
  const t0 = process.hrtime.bigint();
  const big = X.creditXp({ level: 1, frac: 0 }, CV.cumXp(1001) * (1 + 1e-12));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.equal(big.level, 1001);
  assert.ok(ms < 20, `${ms} ms`);
  const huge = X.creditXp({ level: 1, frac: 0 }, 1e299);
  assert.ok(Number.isFinite(huge.level) && huge.level <= CV.LEVEL_MAX && huge.level > 4000, `level ${huge.level}`);
  // exactly 100 XP is LV2; less is not
  assert.equal(X.creditXp({ level: 1, frac: 0 }, 100).level, 2);
  assert.equal(X.creditXp({ level: 1, frac: 0 }, 99.99).level, 1);
  // additive: credit(a) then credit(b) == credit(a + b)
  const a = X.creditXp(X.creditXp({ level: 37, frac: 0.25 }, 123456).state, 7890123);
  const b = X.creditXp({ level: 37, frac: 0.25 }, 123456 + 7890123);
  assert.equal(a.level, b.level);
  near(a.state.frac, b.state.frac, 1e-6);
  const at = X.creditXp({ level: 500, frac: 0 }, X.need(500) + X.need(501) + X.need(502) + 1e-6 * X.need(503));
  assert.equal(at.level, 503);
  for (const L of [2, 26, 100, 1000, 3000]) {
    assert.equal(CV.levelAtCum(CV.cumXp(L) * (1 + 1e-12)), L);
    assert.equal(CV.levelAtCum(CV.cumXp(L) * (1 - 1e-9) - 1e-3), L - 1);
  }
  const s = X.creditXp({ level: 10, frac: 0 }, 10);
  assert.deepEqual([s.level, s.leveledUp], [10, false]);
});

test('KEY: T → T+1 costs 150 × 5^T wins, ×2^T on XP, one at a time', () => {
  reset();
  assert.deepEqual([0, 1, 2, 3, 4].map((p) => X.keyTierCost(p)), [150, 750, 3750, 18750, 93750]);
  assert.equal(X.keyXpMult(4), 16);
  W.saveWins(150 + 750);
  const r1 = SH.buyKeyPower();
  const r2 = SH.buyKeyPower();
  assert.deepEqual([r1.ok, r1.tier, r2.ok, r2.tier], [true, 1, true, 2]);
  assert.equal(W.getWins(), 0);
  assert.equal(ST3.readCounters().power, 2);
});

test('REBIRTH: at LV 15 + 18·R → LV 1, ×3, KEY kept, no gems, no ★', () => {
  assert.deepEqual([0, 1, 4, 9].map((r) => X.rebirthThreshold(r)), [15, 33, 87, 177]);
  assert.equal(E.rebirthGate(4), 15 + 18 * 4);
  reset();
  X.saveKeyTier(4);
  X.saveProgress({ level: 14, frac: 0 });
  assert.equal(X.loadProgress().level < X.rebirthThreshold(0), true, 'LV14 is below the R1 gate');
  X.saveProgress({ level: 40, frac: 0.6 });
  let r = STARS.rebirthWithStars();
  assert.deepEqual(r, { rc: 1, stars: 0 });
  assert.equal(X.loadProgress().level, 1, 'back to LV 1');
  assert.equal(X.getKeyTier(), 4, 'KEY is kept through a rebirth');
  assert.equal(G.getGems(), 0, 'a rebirth pays no gems (games only)');
  assert.equal(X.rebirthMult(1), 3);
  assert.equal(X.rebirthMult(2), 9);
  X.saveProgress({ level: 38, frac: 0 });
  r = STARS.rebirthWithStars();
  assert.equal(r.rc, 2);
  assert.equal(X.loadProgress().level, 1);
  assert.equal(ST3.readCounters().reb, 2);
  assert.equal(STARS.starsForRebirth(10000, 2), 0);
  assert.deepEqual(C.listClaims(), []);
  assert.equal(STARS.buyPerk('autoKey', 5).ok, false);
  assert.deepEqual(STARS.runAutomation({ buyKey: () => ({ ok: true }) }), { keys: 0, forges: 0 });
});

test('ASCENSION is HIDDEN (FINAL v2): no save can ascend locally, at any R', () => {
  reset();
  assert.equal(E.ASCENSION_ON, false);
  for (const rb of [9, 10, 15, 40]) {
    X.saveRebirths(rb);
    assert.equal(S.V3.hooks.ascend().ok, false, `R${rb}`);
    assert.equal(E.canAscend(rb, 0), false);
    assert.equal(E.starsForAscend(rb, 0), 0);
  }
  assert.equal(ST3.getStarsV3(), 0);
});

test('UNLOCKS: start ROLL + INDEX · R1 AUTO ROLL · R2 AUTO REBIRTH · R5 2nd MARK · R7 LUCK ×1.25 (no ASCEND) (pure + live)', () => {
  const at = Object.fromEntries(U.UNLOCKS.map((u) => [u.id, u.at]));
  assert.deepEqual(at, { rollScreen: 0, autoRoll: 1, autoRebirth: 2, mark2: 5, luck: 7 });
  assert.equal(U.unlocked('rollScreen', { rebirths: 0 }), true, 'ROLL + INDEX from the start');
  assert.equal(U.unlocked('autoRoll', { rebirths: 0 }), false);
  assert.equal(U.unlocked('autoRoll', { rebirths: 1 }), true);
  assert.equal(U.unlocked('autoRebirth', { rebirths: 1 }), false);
  assert.equal(U.unlocked('autoRebirth', { rebirths: 2 }), true);
  assert.equal(U.unlocked('mark2', { rebirths: 4 }), false);
  assert.equal(U.unlocked('mark2', { rebirths: 5 }), true);
  assert.equal(U.unlocked('ascend', { rebirths: 99 }), false, 'ascension is hidden');
  assert.equal(U.unlocked('boost2', { rebirths: 99 }), false, 'no 2nd boost slot in FINAL');
  reset();
  assert.equal(U.unlockLuckMult(), 1);
  X.saveRebirths(7);
  assert.equal(U.unlockLuckMult(), 1.25);
  const st = MR.normalize(null);
  near(MR.luck(st, { permanentOwned: 0, markLuck: 0 }), 1.25);
});

test('AUTO REBIRTH: a toggle that opens at R2 (refused below); no 2nd boost slot', () => {
  reset();
  X.saveRebirths(1);
  assert.equal(S.V3.hooks.setAutoRebirth(true), false, 'locked below R2');
  assert.equal(S.V3.hooks.autoRebirthOn(), false);
  X.saveRebirths(2);
  assert.equal(S.V3.hooks.setAutoRebirth(true), true);
  assert.equal(S.V3.hooks.autoRebirthOn(), true);
  assert.equal(S.V3.hooks.setAutoRebirth(false), false);
  const now = Date.UTC(2026, 9, 5);
  X.saveRebirths(9);
  BO.startBoost(3, 10, now);
  BO.startBoost(2, 10, now); // extends slot 1 at the higher mult — never a 2nd slot
  assert.equal(BO.codeBoostMult(now + 1000), 3);
});

test('MARKS (FINAL): COMMON ×1.1 · RARE ×1.25 · EPIC ×1.5 · LEGENDARY ×2 · MYTHIC ×3 · SECRET ×5; pity EPIC+ 50, LEGENDARY+ 500', async () => {
  const M = await import('../marks.js');
  const MRC = await import('../markRollsCore.js');
  const want = { common: 1.1, rare: 1.25, epic: 1.5, legendary: 2, mythic: 3, secret: 5 };
  for (const [t, m] of Object.entries(want)) {
    near(1 + M.MARK_TIERS[t].bonus, m);
    near(MRC.TIER_MAIN[t], m);
    assert.equal(MRC.TIER_PCT[t], Math.round((m - 1) * 100));
  }
  assert.deepEqual(MRC.TIER_ODDS, { common: 2, rare: 10, epic: 100, legendary: 1000, mythic: 10000, secret: 100000 });
  assert.equal(MR.PITY.epic.hard, 50);
  assert.equal(MR.PITY.legendary.hard, 500);
  assert.equal(G.ROLL_PRICE_GEMS, 75);
});

test('RANKS by rebirths then stars — monotonic, never by level', () => {
  const t = (rebirths, stars = 0) => RK.rankForV3({ rebirths, stars }).name;
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => t(r)), ['INKLING', 'TYPO', 'CLACKER', 'HOTKEY', 'INKSTORM', 'WORDSMITH', 'KEYFIEND', 'CAPSLOCK', 'OVERCLOCK', 'GLYPHLORD', 'LEXIBEAST']);
  assert.equal(t(14), 'LEXIBEAST');
  assert.deepEqual([1, 2, 3, 5, 9, 10, 19, 20, 99].map((s) => t(0, s)), ['VOIDTYPER', 'VOIDTYPER', 'ASCENDANT', 'OMNIKEY', 'OMNIKEY', 'FINAL BOSS', 'FINAL BOSS', 'ENDGAME', 'ENDGAME']);
  // monotonic along a real path: R0 → R10 → ascend (R0 ★1) → R5 ★1 → ascend (★7)
  const path = [[0, 0], [3, 0], [10, 0], [0, 1], [5, 1], [0, 7]].map(([r, s]) => RK.rankIndexV3({ rebirths: r, stars: s }));
  for (let i = 1; i < path.length; i++) assert.ok(path[i] >= path[i - 1], JSON.stringify(path));
  reset();
  X.saveRebirths(4);
  assert.equal(R.rankTitle(1), 'INKSTORM');
  assert.equal(R.rankTitle(999999), 'INKSTORM', 'the level is ignored');
  X.saveRebirths(0); // a reset row (e.g. the board lowered it) never lowers the rank shown
  assert.equal(R.rankTitle(1), 'INKSTORM');
  assert.equal(S.V3.ranks.RANKS_V3, RK.RANKS_V3);
});

test('REWARDS: no wins for ranking up, no menu claims — the inbox reads empty and every inbox kind is cut', () => {
  reset();
  for (const k of ['achievement', 'rank', 'layer', 'collection', 'welcome']) assert.equal(C.claimPolicy(k), 'cut', k);
  assert.equal(C.claimPolicy('code'), 'instant');
  assert.equal(C.queueClaim({ id: 'ach-x', kind: 'achievement', amount: 999 }), null);
  assert.equal(C.queueClaim({ id: 'rank-x', kind: 'rank', amount: 999 }), null);
  assert.deepEqual(C.listClaims(), []);
  assert.equal(C.pendingCount(), 0);
  X.saveProgress({ level: 500, frac: 0 });
  assert.deepEqual(ACH.checkAchievements(), []);
  assert.deepEqual(ACH.checkRankClaims(), []);
  assert.equal(W.getWins(), 0, 'nothing paid wins');
  // a season-1 inbox in storage is left exactly as it was
  mem.set('taw.claims', JSON.stringify([{ id: 'ach-old', kind: 'achievement', amount: 5 }]));
  C.claimAll();
  assert.equal(JSON.parse(mem.get('taw.claims')).length, 1);
});

test('ACHIEVEMENTS pay GEMS (40–200), one tier per claim, from season-2 play only', () => {
  reset();
  for (const a of A.ACHIEVEMENTS_V3) for (const r of a.R) assert.ok(r >= 40 && r <= 200, `${a.id} ${r}`);
  assert.equal(A.readyCountV3(), 0);
  assert.equal(A.claimAchievementV3('type').ok, false);
  ST3.bumpCounter('words', 1200);
  const rows = A.achievementsV3();
  const type = rows.find((r) => r.id === 'type');
  assert.deepEqual([type.ready, type.need, type.reward], [true, 100, 40]);
  const c1 = A.claimAchievementV3('type');
  assert.deepEqual(c1, { ok: true, gems: 40, tier: 1 });
  assert.equal(G.getGems(), 40);
  const c2 = A.claimAchievementV3('type');
  assert.deepEqual(c2, { ok: true, gems: 60, tier: 2 });
  assert.equal(A.claimAchievementV3('type').ok, false, 'tier III needs 5,000');
  assert.equal(G.getGems(), 100);
  assert.deepEqual(A.tierCountsV3(), { done: 2, all: 38 });
  // counters move with play: a word, a bot win, a people win, CHAIN, POWER, rolls
  W.awardWordXp({ mode: 'word-bomb', wordLength: 5 });
  assert.equal(ST3.readCounters().words, 1201);
  GM.payGameResult({ key: 'g1', iWon: true, rivals: [{ id: 'b', isBot: true }] });
  GM.payGameResult({ key: 'g2', iWon: true, rivals: [{ id: 'p', isBot: false }] });
  assert.deepEqual([ST3.readCounters().bots, ST3.readCounters().mp], [1, 1]);
  W.bankWordWins({ mode: 'chain', prevWords: 11, nowWords: 12 });
  assert.equal(ST3.readCounters().chain, 12);
  // a maxed ladder
  ST3.maxCounter('chain', 100);
  for (let i = 0; i < 5; i++) assert.equal(A.claimAchievementV3('chain').ok, true);
  const chain = A.achievementsV3().find((r) => r.id === 'chain');
  assert.equal(chain.maxed, true);
  assert.equal(A.claimAchievementV3('chain').reason, 'maxed');
});

test('GEMS: 75 a roll; drops 1 in 15 for 3–12; bot win +18; +15 per player beaten; streak +4; no LEVEL UP gems', () => {
  assert.equal(G.ROLL_PRICE_GEMS, 75);
  // the drop: under 1/15 drops, from 3 (v = 0) to 12 (v → 1); above it, nothing
  assert.equal(G.rollGemDrop(() => 0.066), 3);
  assert.equal(G.rollGemDrop(() => 0.067), 0);
  assert.equal(G.rollGemDrop(() => 0.5), 0);
  const seq = [0.01, 0.999];
  assert.equal(G.rollGemDrop(() => seq.shift()), 12);
  const bot = GM.gameResultPayout({ iWon: true, rivals: [{ id: 'b', isBot: true }], streak: 5 });
  assert.deepEqual(bot.lines, [{ reason: 'bot', amount: 18 }, { reason: 'streak', amount: 4 }]);
  const mp = GM.gameResultPayout({ iWon: true, rivals: [{ id: 'p1' }, { id: 'p2' }] });
  assert.deepEqual(mp.lines, [{ reason: 'placement', amount: 30 }]);
  reset();
  G.stampGemsMigrated({ peak: 1 });
  X.saveProgress({ level: 5000, frac: 0 });
  assert.equal(G.getGems(), 0, 'levels pay no gems in v3');
  assert.equal(G.dropGemsForWord({ mode: 'menu', rng: () => 0 }), 0, 'menu typing gives no gems');
});

test('WINS BUY ONLY POWER: cosmetics cost gems', () => {
  reset();
  W.saveWins(1e9);
  assert.equal(S.V3.hooks.itemGemPrice('chrome'), 75);
  assert.equal(SH.buy('chrome').ok, false, 'a billion wins buys no cosmetic');
  assert.equal(W.getWins(), 1e9);
  G.grantGems(80, 'drop');
  const r = SH.buy('chrome');
  assert.equal(r.ok, true);
  assert.equal(G.getGems(), 5);
  assert.equal(SH.canAffordAny(1e9, SH.getOwned()), true, 'POWER is still a wins buy');
});

test('the eager modules carry v3 values as literals (v3/econ.js is lazy) — every one equals econ.js', async () => {
  const RN = await import('../rebirthNow.js');
  assert.equal(S.V3.ready, true);
  assert.equal(G.ROLL_PRICE_GEMS, E.ROLL_PRICE);
  assert.equal(S.V3.hooks.gemsSwap.c, E.ROLL_PRICE);
  assert.equal(X.keyTierXp(), (E.WINS_BASE * 10) / E.WORD_REF);
  assert.equal(W.wordWinsBase({ wordLength: 5, markId: null }), E.WINS_BASE);
  assert.match(RN.REBIRTH_READY_COPY, new RegExp(`×${E.REBIRTH_STEP} FOREVER`));
});
