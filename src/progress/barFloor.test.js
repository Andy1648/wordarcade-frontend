// node --test — OPTION F, the GAME-WORD BAR FLOOR (barFloor.js, claude/finetune/bar-movement.md), and its
// PROGRESSION v11 state: OFF (claude/econ-oct2/v11-spec.md — the bar is credited level XP on one fixed
// curve, so no word is a sliver of a level). The pure floor math is still pinned (with on = true) so the
// one-constant fallback works if the CI sim ever shows a dead bar; the live award must never floor; the
// receipt's XP headline is the level XP the bar was credited.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  floorFrac,
  barFloorXp,
  applyBarFloor,
  formatFloorPct,
  takeBarFloorStamp,
  takeLevelXpStamp,
  BAR_FLOOR_ON,
  BAR_FLOOR_FRAC,
  BAR_FLOOR_TAPER_FROM,
  BAR_FLOOR_TAPER,
} from './barFloor.js';
import { need, needAt, loadProgress, XP_KEY, XP_SHADOW_KEY, ECON_STAMP_KEY, REBIRTH_KEY, KEYTIER_KEY } from './xp.js';
import { awardWordXp, perWordXp, perWordWins, getWins, getWinsLifetime } from './wins.js';
import { buildPayout } from './payout.js';

function withStorage(seed, fn) {
  const saved = globalThis.localStorage;
  const map = new Map(Object.entries(seed || {}));
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  try {
    return fn(map);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
}
// A v10-shaped save at a level/fraction with a KEY tier and rebirth count.
function save({ lv, f = 0, rc = 0, kt = 0 }) {
  const v = JSON.stringify({ lv, f, rc, v: 10 });
  return { [XP_KEY]: v, [XP_SHADOW_KEY]: v, [ECON_STAMP_KEY]: '11', [REBIRTH_KEY]: String(rc), [KEYTIER_KEY]: String(kt) };
}
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
// A top-8-like word: 5-letter Word Bomb, no rarity/combo/lucky weight, no forge, no streak.
const WB = { mode: 'word-bomb', difficulty: 'easy', wordLength: 5, weight: 1, word: 'hello', streakMult: 1 };

test('constants: the shipped block — OFF under PROGRESSION v11', () => {
  assert.equal(BAR_FLOOR_ON, false);
  assert.equal(BAR_FLOOR_FRAC, 0.005);
  assert.equal(BAR_FLOOR_TAPER_FROM, 250);
  assert.equal(BAR_FLOOR_TAPER, 1.028);
});

test('floorFrac (fallback math, on = true): 0.5% through LV250, then ×1.028⁻¹ per level; off → 0', () => {
  assert.equal(floorFrac(1, true), 0.005);
  assert.equal(floorFrac(250, true), 0.005);
  assert.ok(close(floorFrac(251, true), 0.005 / 1.028, 1e-15));
  assert.ok(close(floorFrac(300, true), 0.005 * Math.pow(1.028, -50), 1e-15));
  assert.equal(floorFrac(NaN, true), 0.005);
  assert.equal(floorFrac(175), 0, 'default = the shipped switch (off)');
  assert.equal(floorFrac(175, false), 0);
  assert.equal(barFloorXp(175, 1e6), 0);
});

test('barFloorXp is floorFrac × need(L) — the v10 power argument is ignored', () => {
  for (const [L, P] of [[1, 1], [175, 50], [250, 1e9], [300, 3]]) {
    assert.ok(close(barFloorXp(L, P, true), floorFrac(L, true) * need(L), need(L) * 1e-12), `LV${L} P${P}`);
  }
  const f = applyBarFloor({ gain: 1, level: 175, power: 1e9, on: true });
  assert.equal(f.floored, true);
  assert.ok(close(f.pct, 0.5, 1e-9));
  const big = applyBarFloor({ gain: needAt(150) * 0.02, level: 150, on: true });
  assert.equal(big.floored, false);
  assert.ok(close(big.pct, 2, 1e-9));
});

test('v11: the top-8-like save that v10 starved (LV175, R4, KEY T7, ×1 stack) moves ≥ 0.2% a word with NO floor', () => {
  withStorage(save({ lv: 175, f: 0.2, rc: 4, kt: 7 }), () => {
    for (let i = 0; i < 5; i++) {
      const before = loadProgress();
      const res = awardWordXp(WB);
      const after = loadProgress();
      assert.equal(res.floor, null, 'the floor never fires');
      assert.equal(res.credited, res.levelXp);
      assert.equal(res.gain, perWordXp(WB), 'gain (the wins basis) is the real wins product');
      assert.ok(after.frac - before.frac >= 0.002, `word ${i}: moved ${(after.frac - before.frac) * 100}%`);
    }
  });
});

test('v11: no game mode floors (WB, Blitz, SAT, CHAIN, FUSE, RACE); menu never did', () => {
  for (const mode of ['word-bomb', 'category-blitz', 'sat-rush', 'chain', 'fuse', 'word-race', 'menu']) {
    withStorage(save({ lv: 300, f: 0, rc: 0, kt: 0 }), () => {
      const res = awardWordXp({ ...WB, mode });
      assert.equal(res.floor, null, mode);
      assert.ok(close(loadProgress().frac, res.levelXp / need(300), 1e-12), mode);
    });
  }
});

test('wins are unchanged by the bar: the award never pays wins; a word still pays its wins product ÷ 10', () => {
  withStorage(save({ lv: 175, rc: 4, kt: 7 }), () => {
    const w0 = getWins();
    const l0 = getWinsLifetime();
    const res = awardWordXp(WB);
    assert.equal(getWins(), w0);
    assert.equal(getWinsLifetime(), l0);
    assert.equal(perWordWins(WB), res.gain / 10);
  });
});

test('receipt: the XP headline is the LEVEL XP the bar was credited; no LEVEL FLOOR row; stamps are one-shot', () => {
  withStorage(save({ lv: 175, f: 0.1, rc: 4, kt: 7 }), () => {
    const res = awardWordXp(WB);
    const p = buildPayout({ base: 5, factors: { mode: 2 }, total: 10 });
    assert.equal(p.levelFloor, null);
    assert.equal(p.paid, 10, 'the wins line is the product of the rows');
    assert.equal(p.xp, res.levelXp, 'the XP headline = what the bar moved');
    assert.ok(close((loadProgress().frac - 0.1) * need(175), p.xp, 1e-6));
    // consumed: the next receipt does not inherit it
    assert.equal(takeLevelXpStamp(), null);
    assert.equal(takeBarFloorStamp(), null);
    assert.equal(buildPayout({ base: 5, factors: { mode: 2 } }).xp, 100, 'a bare pure call falls back to wins × 10');
    // an explicit levelXp wins over the fallback
    assert.equal(buildPayout({ base: 5, factors: {}, levelXp: 42 }).xp, 42);
  });
});

test('receipt: a floor stamp (fallback switched on) still renders as its own LEVEL FLOOR row', () => {
  const p = buildPayout({ base: 5, factors: {}, levelFloor: { pct: 0.5, rawPct: 0.01, xp: 123 } });
  assert.equal(p.levelFloor.label, 'LEVEL FLOOR');
  assert.equal(p.levelFloor.pct, 0.5);
  assert.equal(p.rows.some((r) => r.label === 'LEVEL FLOOR'), false, 'never a multiplier row');
});

test('formatFloorPct', () => {
  assert.equal(formatFloorPct(0.5), '+0.5%');
  assert.equal(formatFloorPct(0.1257), '+0.13%');
  assert.equal(formatFloorPct(1e-9), '+<0.01%');
  assert.equal(formatFloorPct(0), '');
});
