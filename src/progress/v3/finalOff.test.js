// finalOff.test.js — WITH THE SEASON2 FLAG OFF, PROGRESSION FINAL CHANGES NOTHING. The live (season-1) economy keeps
// every number: the 100 × 1.15^(n−1) curve, BASE 10 × KEY 2.5^T × 5^R XP a letter, 10 wins a word × the live MODE table
// (SAT ×5), KEY prices 48 × 6^(T−1), the LV 25 × (R+1) gate with rebirth → LV1, the menu's per-key 2 XP, the live mark
// ladder (LEGENDARY ×3 · MYTHIC ×10 · SECRET ×25), and the live rebirth server rule (season 0). Pure FINAL modules
// (econ / curve) may be imported without touching any of it — only v3/install.js (season 2) applies them.
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

const S = await import('../season.js');
const X = await import('../xp.js');
const W = await import('../wins.js');
const STARS = await import('../stars.js');
const M = await import('../marks.js');
const MRC = await import('../markRollsCore.js');
const G = await import('../gemsCore.js');
// the FINAL modules, imported but NOT installed
const E = await import('./econ.js');
await import('./curve.js');
const RR = await import('../../leaderboard/rebirthRules.js');

const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('flag OFF: the season is off and nothing FINAL is installed', () => {
  assert.equal(S.SEASON2, false);
  assert.equal(S.V3.ready, undefined);
  assert.equal(E.XP_BASE, 1, '(econ.js is importable on its own — FINAL v3: BASE 1)');
});

test('flag OFF: the live curve, XP per letter, wins per word, MODE table and KEY prices are unchanged', () => {
  mem.clear();
  assert.deepEqual([1, 2, 3, 10].map((n) => X.need(n)), [100, 110, 130, 350]);
  assert.equal(X.levelXpPerLetter(0, 0, 1, 0), 10);
  assert.equal(X.levelXpPerLetter(1, 1, 1, 0), 10 * X.keyXpMult(1) * X.rebirthXpMult(1));
  assert.equal(X.rebirthMult(1), 5);
  assert.equal(W.perWordWins({ mode: 'wordBomb', wordLength: 5, rebirthCount: 0 }), 10);
  assert.equal(W.perWordWins({ mode: 'satRush', wordLength: 5, rebirthCount: 0 }), 50);
  assert.deepEqual(['word-bomb', 'word-race', 'chain', 'sat-rush', 'fuse'].map((m) => X.modePower(m)), [1, 1.5, 2, 5, 1]);
  assert.deepEqual([0, 1, 2].map((t) => X.keyTierCost(t)), [50, 290, 1730]);
  assert.equal(X.xpPerInput({ mode: 'menu', markMult: 1, baseAdd: 0 }), 2, 'the menu still pays 2 XP a key');
});

test('flag OFF: the live rebirth — gate LV 25 × (R+1), level → 1 (no spend), and the live mark ladder', () => {
  mem.clear();
  assert.deepEqual([0, 1, 4].map((r) => X.rebirthThreshold(r)), [25, 50, 125]);
  X.saveProgress({ level: 40, frac: 0 });
  const r = STARS.rebirthWithStars();
  assert.equal(r.rc, 1);
  assert.equal(X.loadProgress().level, 1, 'season 1 rebirths to LV1');
  assert.deepEqual(['legendary', 'mythic', 'secret'].map((t) => M.MARK_TIERS[t].bonus), [2, 9, 24]);
  assert.deepEqual(['legendary', 'mythic', 'secret'].map((t) => MRC.TIER_PCT[t]), [200, 900, 2400]);
  assert.equal(mem.has('taw.s2.xp'), false, 'no season-2 key written');
  void G;
});

test('flag OFF: the server rule for season 0 is 021 exactly (≥ gate → LV1)', () => {
  const ok = RR.decideRebirth({ level: 25, rebirths: 0 }, { requestId: UUID(1), season: 0 }, [], 1e12);
  assert.deepEqual(ok.result, { ok: true, rebirths: 1, level: 1 });
  const no = RR.decideRebirth({ level: 24, rebirths: 0 }, { requestId: UUID(2), season: 0 }, [], 1e12);
  assert.deepEqual(no.result, { ok: false, reason: 'gate', gate: 25, level: 24, rebirths: 0 });
});
