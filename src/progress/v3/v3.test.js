// v3.test.js — PROGRESSION v3 WITH THE SEASON2 FLAG ON (claude/mockups/v2/progression-v3.md "Numbers"). The flag is
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

test('XP per letter = XP_BASE × POWER_XP_STEP^POWER × 2^R × (1 + ★) × MARK (spec 7 × 1.8^P, CI-tuned)', () => {
  const B = E.XP_BASE;
  const K = E.POWER_XP_STEP;
  assert.ok(Math.abs(B / 7 - 1) <= 0.2 && Math.abs(K / 1.8 - 1) <= 0.2 && Math.abs(E.POWER_COST_STEP / 4 - 1) <= 0.2, 'tuning stays within ±20% of the spec');
  reset();
  assert.equal(X.levelXpPerLetter(0, 0, 1, 0), B);
  near(X.levelXpPerLetter(3, 2, 1, 0), B * K ** 3 * 4);
  near(X.levelXpPerLetter(1, 1, 1.5, 0), B * K * 2 * 1.5);
  ST3.saveStarsV3(2);
  near(X.levelXpPerLetter(0, 0, 1, 0), B * 3);
  near(E.xpPerLetter({ power: 2, rebirths: 3, stars: 4, mark: 1.1 }), B * K ** 2 * 8 * 5 * 1.1);
  assert.ok(Number.isFinite(X.levelXpPerLetter(5000, 5000, 1, 0)), 'finite at absurd tiers');
});

test('XP for the next level = 40 × √level; a credit of any size is O(1) and exactly additive', () => {
  for (const L of [1, 2, 10, 100, 1e4, 1e6, 1e9]) near(X.need(L), 40 * Math.sqrt(L), L < 10 ? 0.02 : L < 100 ? 2e-4 : 1e-5);
  near(X.need(100), 400, 1e-5);
  // levels reach millions: 1e12 XP is ~11.2M levels — and it must not loop per level
  const t0 = process.hrtime.bigint();
  const big = X.creditXp({ level: 1, frac: 0 }, 1e12);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(big.level > 1e7 && big.level < 1.2e7, `level ${big.level}`);
  assert.ok(ms < 50, `${ms} ms`);
  const huge = X.creditXp({ level: 1, frac: 0 }, 1e250);
  assert.ok(Number.isFinite(huge.level) && huge.level <= CV.LEVEL_MAX);
  // additive: credit(a) then credit(b) == credit(a + b)
  const a = X.creditXp(X.creditXp({ level: 37, frac: 0.25 }, 123456).state, 7890123);
  const b = X.creditXp({ level: 37, frac: 0.25 }, 123456 + 7890123);
  assert.equal(a.level, b.level);
  near(a.state.frac, b.state.frac, 1e-6);
  // the cumulative inverts: reaching LV L takes cumXp(L)
  for (const L of [2, 100, 9766, 381470, 953675]) {
    assert.equal(CV.levelAtCum(CV.cumXp(L)), L);
    assert.equal(CV.levelAtCum(CV.cumXp(L) - 1e-3), L - 1);
  }
  // a small credit stays inside the level
  const s = X.creditXp({ level: 10, frac: 0 }, 10);
  assert.equal(s.level, 10);
  assert.equal(s.leveledUp, false);
});

test('WINS per word = 15 × length/5 × MODE × 2^R × (1 + ★) × MARK; POWER costs 100 × STEP^P and buys ×POWER_XP_STEP', () => {
  reset();
  assert.equal(W.perWordWins({ mode: 'wordBomb', wordLength: 5, rebirthCount: 0 }), 15);
  assert.equal(W.perWordWins({ mode: 'wordBomb', wordLength: 10, rebirthCount: 0 }), 30);
  assert.equal(W.perWordWins({ mode: 'chain', wordLength: 5, rebirthCount: 3 }), 15 * 2 * 8);
  ST3.saveStarsV3(1);
  assert.equal(W.perWordWins({ mode: 'wordBomb', wordLength: 5, rebirthCount: 0 }), 30);
  assert.equal(W.perWordFactors({ mode: 'wordBomb', rebirthCount: 0 }).rebirth, 2, 'the receipt REBIRTH row carries (1 + ★)');
  assert.deepEqual([0, 1, 2, 3].map((p) => X.keyTierCost(p)), [0, 1, 2, 3].map((p) => Math.round((100 * E.POWER_COST_STEP ** p) / 10) * 10));
  near(X.keyXpMult(4), E.POWER_XP_STEP ** 4);
  reset();
  W.saveWins(100 + X.keyTierCost(1));
  const r1 = SH.buyKeyPower();
  const r2 = SH.buyKeyPower();
  assert.deepEqual([r1.ok, r1.tier, r2.ok, r2.tier], [true, 1, true, 2]);
  assert.equal(W.getWins(), 0);
  assert.equal(ST3.readCounters().power, 2);
});

test('REBIRTH: gate LV ⌈100 × 2.5^R⌉, levels → 1, ×2, +7 gems × R, POWER kept, no ★', () => {
  assert.deepEqual([0, 1, 2, 5, 9, 10].map((r) => X.rebirthThreshold(r)), [100, 250, 625, 9766, 381470, 953675]);
  reset();
  X.saveKeyTier(4);
  X.saveProgress({ level: 100, frac: 0 });
  let r = STARS.rebirthWithStars();
  assert.deepEqual(r, { rc: 1, stars: 0 });
  assert.equal(X.loadProgress().level, 1);
  assert.equal(X.getKeyTier(), 4, 'POWER is kept through a rebirth');
  assert.equal(G.getGems(), 7);
  assert.equal(X.rebirthMult(1), 2);
  X.saveProgress({ level: 250, frac: 0 });
  r = STARS.rebirthWithStars();
  assert.equal(r.rc, 2);
  assert.equal(G.getGems(), 7 + 14);
  assert.equal(ST3.readCounters().reb, 2);
  assert.equal(STARS.starsForRebirth(10000, 2), 0);
  // no layer claim, no star perks, no AUTO-KEY
  assert.deepEqual(C.listClaims(), []);
  assert.equal(STARS.buyPerk('autoKey', 5).ok, false);
  assert.deepEqual(STARS.runAutomation({ buyKey: () => ({ ok: true }) }), { keys: 0, forges: 0 });
});

test('ASCEND at R10: rebirths, levels and POWER reset; ★ += R − 9 — and ★ multiplies XP and wins', () => {
  reset();
  X.saveRebirths(9);
  assert.equal(S.V3.hooks.ascend().ok, false, 'R9 cannot ascend');
  X.saveRebirths(12);
  X.saveKeyTier(7);
  X.saveProgress({ level: 5000, frac: 0.3 });
  const a = S.V3.hooks.ascend();
  assert.deepEqual(a, { ok: true, stars: 3, added: 3 });
  assert.deepEqual([X.getRebirths(), X.getKeyTier(), X.loadProgress().level], [0, 0, 1]);
  assert.equal(ST3.getStarsV3(), 3);
  assert.equal(X.levelXpPerLetter(0, 0, 1, 0), E.XP_BASE * 4);
  // a server-granted ascension lands on the server's ★ total
  X.saveRebirths(10);
  assert.equal(S.V3.hooks.ascend(9).stars, 9);
  assert.equal(E.starsForAscend(10), 1);
  assert.equal(E.starsForAscend(15), 6);
});

test('UNLOCKS: R1 ROLL · R2 AUTO ROLL · R3 2nd boost · R5 2nd MARK · R7 LUCK ×1.25 · R10 ASCEND (pure + live)', () => {
  const at = Object.fromEntries(U.UNLOCKS.map((u) => [u.id, u.at]));
  assert.deepEqual(at, { rollScreen: 1, autoRoll: 2, boost2: 3, mark2: 5, luck: 7, ascend: 10 });
  assert.equal(U.unlocked('rollScreen', { rebirths: 0 }), false);
  assert.equal(U.unlocked('rollScreen', { rebirths: 1 }), true);
  assert.equal(U.unlocked('mark2', { rebirths: 4 }), false);
  assert.equal(U.unlocked('mark2', { rebirths: 5 }), true);
  assert.equal(U.unlocked('luck', { rebirths: 0, stars: 1 }), true, 'kept through ascension');
  assert.equal(U.unlocked('ascend', { rebirths: 0, stars: 3 }), false, 'ASCEND needs R10 in the climb');
  assert.equal(U.unlocked('ascend', { rebirths: 10 }), true);
  assert.equal(U.unlocked('nope', { rebirths: 99 }), false);
  reset();
  assert.equal(U.unlockLuckMult(), 1);
  X.saveRebirths(7);
  assert.equal(U.unlockLuckMult(), 1.25);
  const st = MR.normalize(null);
  near(MR.luck(st, { permanentOwned: 0, markLuck: 0 }), 1.25);
});

test('2nd boost slot (R3): a second boost runs alongside and multiplies', () => {
  reset();
  const now = Date.UTC(2026, 9, 5);
  X.saveRebirths(2);
  BO.startBoost(3, 10, now);
  BO.startBoost(2, 10, now); // R2: extends slot 1 at the higher mult
  assert.equal(BO.codeBoostMult(now + 1000), 3);
  reset();
  X.saveRebirths(3);
  BO.startBoost(3, 10, now);
  const s2 = BO.startBoost(2, 5, now);
  assert.equal(s2.slot, 2);
  assert.equal(BO.codeBoostMult(now + 1000), 6);
  assert.equal(BO.codeBoostMult(now + 6 * 60000), 3, 'slot 2 ran out first');
});

test('RANKS by rebirths then stars — monotonic, never by level', () => {
  const t = (rebirths, stars = 0) => RK.rankForV3({ rebirths, stars }).name;
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => t(r)), ['KEYMASH', 'TYPO', 'CLACKER', 'HOTKEY', 'INKSTORM', 'WORDSMITH', 'KEYFIEND', 'CAPSLOCK', 'OVERCLOCK', 'GLYPHLORD', 'LEXIBEAST']);
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
