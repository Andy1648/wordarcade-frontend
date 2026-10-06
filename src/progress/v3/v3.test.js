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

test('XP per letter = 10 × 2.5^POWER × 2^R × (1 + ★) × MARK (FINAL, frozen)', () => {
  assert.deepEqual([E.XP_BASE, E.POWER_XP_STEP, E.REBIRTH_STEP], [10, 2.5, 2]);
  reset();
  assert.equal(X.levelXpPerLetter(0, 0, 1, 0), 10);
  near(X.levelXpPerLetter(3, 2, 1, 0), 10 * 2.5 ** 3 * 4);
  near(X.levelXpPerLetter(1, 1, 1.5, 0), 10 * 2.5 * 2 * 1.5);
  ST3.saveStarsV3(2);
  near(X.levelXpPerLetter(0, 0, 1, 0), 30);
  near(E.xpPerLetter({ power: 2, rebirths: 3, stars: 4, mark: 1.1 }), 10 * 2.5 ** 2 * 8 * 5 * 1.1);
  assert.ok(Number.isFinite(X.levelXpPerLetter(5000, 5000, 1, 0)), 'finite at absurd tiers');
});

test('XP for the next level = 400 × 1.06^(n−1); a credit of any size is O(1) and exactly additive', () => {
  for (const L of [1, 2, 10, 100, 1000, 5000]) near(X.need(L), 400 * 1.06 ** (L - 1), 1e-9);
  assert.equal(X.need(1), 400);
  // levels reach the thousands: the gain that lands LV 3,001 from LV1 — no per-level loop
  const t0 = process.hrtime.bigint();
  const big = X.creditXp({ level: 1, frac: 0 }, CV.cumXp(3001) * (1 + 1e-12));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.equal(big.level, 3001);
  assert.ok(ms < 20, `${ms} ms`);
  const huge = X.creditXp({ level: 1, frac: 0 }, 1e299);
  assert.ok(Number.isFinite(huge.level) && huge.level <= CV.LEVEL_MAX && huge.level > 10000, `level ${huge.level}`);
  // exactly 400 XP is LV2; less is not
  assert.equal(X.creditXp({ level: 1, frac: 0 }, 400).level, 2);
  assert.equal(X.creditXp({ level: 1, frac: 0 }, 399.99).level, 1);
  // additive: credit(a) then credit(b) == credit(a + b)
  const a = X.creditXp(X.creditXp({ level: 37, frac: 0.25 }, 123456).state, 7890123);
  const b = X.creditXp({ level: 37, frac: 0.25 }, 123456 + 7890123);
  assert.equal(a.level, b.level);
  near(a.state.frac, b.state.frac, 1e-6);
  // at LV 2,000 a credit worth exactly 3 levels (+ a sliver) lands 3 levels up — precision is relative to need(L)
  const at = X.creditXp({ level: 2000, frac: 0 }, X.need(2000) + X.need(2001) + X.need(2002) + 1e-6 * X.need(2003));
  assert.equal(at.level, 2003);
  for (const L of [2, 26, 100, 1000, 4000]) {
    assert.equal(CV.levelAtCum(CV.cumXp(L) * (1 + 1e-12)), L);
    assert.equal(CV.levelAtCum(CV.cumXp(L) * (1 - 1e-9) - 1e-3), L - 1);
  }
  const s = X.creditXp({ level: 10, frac: 0 }, 10);
  assert.deepEqual([s.level, s.leveledUp], [10, false]);
});

test('WINS per word = 22 × length/5 × MODE × 2^R × (1 + ★) × MARK; MODE WB/Blitz 1 · RACE 1.5 · CHAIN 2 · SAT 3 · FUSE 1', () => {
  reset();
  assert.equal(W.perWordWins({ mode: 'wordBomb', wordLength: 5, rebirthCount: 0 }), 22);
  assert.equal(W.perWordWins({ mode: 'wordBomb', wordLength: 10, rebirthCount: 0 }), 44);
  assert.equal(W.perWordWins({ mode: 'blitz', wordLength: 5, rebirthCount: 0 }), 22);
  assert.equal(W.perWordWins({ mode: 'wordRace', wordLength: 5, rebirthCount: 0 }), 33);
  assert.equal(W.perWordWins({ mode: 'chain', wordLength: 5, rebirthCount: 3 }), 22 * 2 * 8);
  assert.equal(W.perWordWins({ mode: 'satRush', wordLength: 5, rebirthCount: 0 }), 66);
  assert.equal(W.perWordWins({ mode: 'fuse', wordLength: 5, rebirthCount: 0 }), 22);
  assert.deepEqual(['word-bomb', 'category-blitz', 'word-race', 'chain', 'sat-rush', 'fuse'].map((m) => X.modePower(m)), [1, 1, 1.5, 2, 3, 1], 'the receipt reads the FINAL table');
  ST3.saveStarsV3(1);
  assert.equal(W.perWordWins({ mode: 'wordBomb', wordLength: 5, rebirthCount: 0 }), 44);
  assert.equal(W.perWordFactors({ mode: 'wordBomb', rebirthCount: 0 }).rebirth, 2, 'the receipt REBIRTH row carries (1 + ★)');
});

test('POWER: P → P+1 costs 300 × 8^P wins, ×2.5 XP a tier, one at a time', () => {
  reset();
  assert.deepEqual([0, 1, 2, 3, 4].map((p) => X.keyTierCost(p)), [300, 2400, 19200, 153600, 1228800]);
  near(X.keyXpMult(4), 2.5 ** 4);
  W.saveWins(300 + 2400);
  const r1 = SH.buyKeyPower();
  const r2 = SH.buyKeyPower();
  assert.deepEqual([r1.ok, r1.tier, r2.ok, r2.tier], [true, 1, true, 2]);
  assert.equal(W.getWins(), 0);
  assert.equal(ST3.readCounters().power, 2);
});

test('REBIRTH: needs LV > 25 × (R+1), SPENDS those levels (keeps the rest), ×2, POWER kept, no gems, no ★', () => {
  assert.deepEqual([0, 1, 4, 9].map((r) => X.rebirthThreshold(r)), [26, 51, 126, 251]);
  assert.deepEqual([0, 1, 4].map((r) => E.rebirthCost(r)), [25, 50, 125]);
  reset();
  X.saveKeyTier(4);
  X.saveProgress({ level: 25, frac: 0 });
  assert.equal(X.loadProgress().level < X.rebirthThreshold(0), true, 'LV25 is not past the R1 gate');
  X.saveProgress({ level: 40, frac: 0.6 });
  let r = STARS.rebirthWithStars();
  assert.deepEqual(r, { rc: 1, stars: 0 });
  assert.equal(X.loadProgress().level, 15, 'LV40 − 25 = LV15 kept');
  assert.equal(X.getKeyTier(), 4, 'POWER is kept through a rebirth');
  assert.equal(G.getGems(), 0, 'a rebirth pays no gems (games only)');
  assert.equal(X.rebirthMult(1), 2);
  X.saveProgress({ level: 51, frac: 0 });
  r = STARS.rebirthWithStars();
  assert.equal(r.rc, 2);
  assert.equal(X.loadProgress().level, 1, 'LV51 − 50 = LV1');
  assert.equal(ST3.readCounters().reb, 2);
  assert.equal(STARS.starsForRebirth(10000, 2), 0);
  assert.deepEqual(C.listClaims(), []);
  assert.equal(STARS.buyPerk('autoKey', 5).ok, false);
  assert.deepEqual(STARS.runAutomation({ buyKey: () => ({ ok: true }) }), { keys: 0, forges: 0 });
});

test('ASCEND at R = 10 + 5 × ★: R, POWER → 0, LV → 1, ★ + 1 (never R − 9) — and ★ multiplies XP and wins', () => {
  reset();
  X.saveRebirths(9);
  assert.equal(S.V3.hooks.ascend().ok, false, 'R9 cannot ascend');
  X.saveRebirths(12);
  X.saveKeyTier(7);
  X.saveProgress({ level: 500, frac: 0.3 });
  assert.deepEqual(S.V3.hooks.ascend(), { ok: true, stars: 1, added: 1 });
  assert.deepEqual([X.getRebirths(), X.getKeyTier(), X.loadProgress().level], [0, 0, 1]);
  assert.equal(X.levelXpPerLetter(0, 0, 1, 0), E.XP_BASE * 2);
  X.saveRebirths(14);
  assert.equal(S.V3.hooks.ascend().ok, false, '★1 needs R15');
  X.saveRebirths(15);
  assert.equal(S.V3.hooks.ascend().stars, 2);
  assert.deepEqual([0, 1, 2, 5].map((st) => E.ascendAt(st)), [10, 15, 20, 35]);
  assert.equal(E.starsForAscend(10, 0), 1);
  assert.equal(E.starsForAscend(40, 0), 1, 'one ★ per ascension, however far past');
  assert.equal(E.starsForAscend(14, 1), 0);
  // a server-granted ascension lands on the server's ★ total
  X.saveRebirths(20);
  assert.equal(S.V3.hooks.ascend(9).stars, 9);
});

test('UNLOCKS: start ROLL + INDEX · R1 AUTO ROLL · R2 AUTO REBIRTH · R5 2nd MARK · R7 LUCK ×1.25 · R10 ASCEND (pure + live)', () => {
  const at = Object.fromEntries(U.UNLOCKS.map((u) => [u.id, u.at]));
  assert.deepEqual(at, { rollScreen: 0, autoRoll: 1, autoRebirth: 2, mark2: 5, luck: 7, ascend: 10 });
  assert.equal(U.unlocked('rollScreen', { rebirths: 0 }), true, 'ROLL + INDEX from the start');
  assert.equal(U.unlocked('autoRoll', { rebirths: 0 }), false);
  assert.equal(U.unlocked('autoRoll', { rebirths: 1 }), true);
  assert.equal(U.unlocked('autoRebirth', { rebirths: 1 }), false);
  assert.equal(U.unlocked('autoRebirth', { rebirths: 2 }), true);
  assert.equal(U.unlocked('mark2', { rebirths: 4 }), false);
  assert.equal(U.unlocked('mark2', { rebirths: 5 }), true);
  assert.equal(U.unlocked('luck', { rebirths: 0, stars: 1 }), true, 'kept through ascension');
  assert.equal(U.unlocked('ascend', { rebirths: 0, stars: 3 }), false, 'ASCEND needs the climb');
  assert.equal(U.unlocked('ascend', { rebirths: 10 }), true);
  assert.equal(U.unlocked('ascend', { rebirths: 10, stars: 1 }), false, '★1 ascends at R15');
  assert.equal(U.unlocked('ascend', { rebirths: 15, stars: 1 }), true);
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
