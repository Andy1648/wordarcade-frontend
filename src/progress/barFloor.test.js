// node --test — OPTION F, the GAME-WORD BAR FLOOR (barFloor.js, claude/finetune/bar-movement.md):
// every accepted game word moves the bar ≥ floorFrac(L) of the current level; wins never change;
// menu typing is never floored; the receipt's LEVEL FLOOR row is the number the bar moved.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  floorFrac,
  barFloorXp,
  applyBarFloor,
  formatFloorPct,
  takeBarFloorStamp,
  BAR_FLOOR_ON,
  BAR_FLOOR_FRAC,
  BAR_FLOOR_TAPER_FROM,
  BAR_FLOOR_TAPER,
} from './barFloor.js';
import { needAt, currentPower, loadProgress, XP_KEY, XP_SHADOW_KEY, ECON_STAMP_KEY, REBIRTH_KEY, KEYTIER_KEY } from './xp.js';
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
// A v10 save at a level/fraction with a KEY tier and rebirth count.
function save({ lv, f = 0, rc = 0, kt = 0 }) {
  const v = JSON.stringify({ lv, f, rc, v: 10 });
  return { [XP_KEY]: v, [XP_SHADOW_KEY]: v, [ECON_STAMP_KEY]: '10', [REBIRTH_KEY]: String(rc), [KEYTIER_KEY]: String(kt) };
}
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
// A top-8-like word: 5-letter Word Bomb, no rarity/combo/lucky weight, no forge.
const WB = { mode: 'word-bomb', difficulty: 'easy', wordLength: 5, weight: 1, word: 'hello' };

test('constants: the shipped block, ON on this branch', () => {
  assert.equal(BAR_FLOOR_ON, true);
  assert.equal(BAR_FLOOR_FRAC, 0.005);
  assert.equal(BAR_FLOOR_TAPER_FROM, 250);
  assert.equal(BAR_FLOOR_TAPER, 1.028);
});

test('floorFrac: 0.5% through LV250, then ×1.028⁻¹ per level', () => {
  assert.equal(floorFrac(1), 0.005);
  assert.equal(floorFrac(150), 0.005);
  assert.equal(floorFrac(250), 0.005);
  assert.ok(close(floorFrac(251), 0.005 / 1.028, 1e-15));
  assert.ok(close(floorFrac(300), 0.005 * Math.pow(1.028, -50), 1e-15));
  assert.ok(close(floorFrac(300), 0.001257, 1e-6)); // ≈ 0.126%
  assert.ok(close(floorFrac(1000), 0.005 * Math.pow(1.028, -750), 1e-20));
  assert.ok(floorFrac(1000) > 0 && floorFrac(1000) < 1e-10);
  // garbage level → LV1; feature off → 0
  assert.equal(floorFrac(NaN), 0.005);
  assert.equal(floorFrac(175, false), 0);
  assert.equal(barFloorXp(175, 1e6, false), 0);
});

test('barFloorXp is floorFrac × needAt(L, P) at any power', () => {
  for (const [L, P] of [[1, 1], [175, 50], [250, 1e9], [300, 3]]) {
    assert.ok(close(barFloorXp(L, P), floorFrac(L) * needAt(L, P), needAt(L, P) * 1e-12), `LV${L} P${P}`);
  }
});

test('top-8-like save (LV175, R4, KEY T7, ×1 stack): every game word moves the bar ≥ 0.5%', () => {
  withStorage(save({ lv: 175, f: 0.2, rc: 4, kt: 7 }), () => {
    const P = currentPower();
    const gain = perWordXp(WB);
    // Without the floor this word is a sliver of the level (the bug Andy felt).
    assert.ok(gain / needAt(175, P) < 0.0001, `raw share ${gain / needAt(175, P)}`);
    for (let i = 0; i < 5; i++) {
      const before = loadProgress();
      const res = awardWordXp(WB);
      const after = loadProgress();
      assert.equal(after.level, 175);
      assert.ok(after.frac - before.frac >= 0.005 - 1e-9, `word ${i}: moved ${after.frac - before.frac}`);
      assert.ok(res.floor, 'floor reported');
      assert.ok(close(res.floor.pct, 0.5, 1e-9));
      assert.equal(res.gain, gain, 'gain (the wins basis) is the real word XP');
      assert.ok(res.credited > res.gain);
    }
  });
});

test('every game mode is floored (WB, Blitz, SAT, CHAIN, FUSE, RACE)', () => {
  for (const mode of ['word-bomb', 'category-blitz', 'sat-rush', 'chain', 'fuse', 'word-race']) {
    withStorage(save({ lv: 175, f: 0, rc: 4, kt: 7 }), () => {
      const res = awardWordXp({ ...WB, mode });
      assert.ok(res.floor, mode);
      assert.ok(loadProgress().frac >= 0.005 - 1e-9, mode);
    });
  }
});

test('a crossing carries through creditXp with fraction storage {lv, f, rc, v:10}', () => {
  withStorage(save({ lv: 175, f: 0.998, rc: 4, kt: 7 }), (map) => {
    const P = currentPower();
    const res = awardWordXp(WB);
    assert.equal(res.level, 176);
    assert.equal(res.leveledUp, true);
    // 0.998 + 0.005 = 1.003 of LV175 → 0.003 × need(175) carried into LV176.
    const want = (0.003 * needAt(175, P)) / needAt(176, P);
    const stored = JSON.parse(map.get(XP_KEY));
    assert.equal(stored.lv, 176);
    assert.equal(stored.v, 10);
    assert.ok(close(stored.f, want, 1e-6), `carried f ${stored.f} vs ${want}`);
  });
});

test('a strong player whose real gain beats the floor is unchanged', () => {
  // Pure: gain above the floor → credited = gain, not floored.
  const L = 150;
  const P = 10;
  const big = needAt(L, P) * 0.02; // a 2% word
  const f = applyBarFloor({ gain: big, level: L, power: P });
  assert.equal(f.floored, false);
  assert.equal(f.credited, big);
  assert.ok(close(f.pct, 2, 1e-9));
  // Live: an early-game save, where a word is several % of the level.
  withStorage(save({ lv: 5, f: 0 }), () => {
    const P0 = currentPower();
    const gain = perWordXp(WB);
    assert.ok(gain / needAt(5, P0) > 0.005);
    const res = awardWordXp(WB);
    assert.equal(res.floor, null);
    assert.equal(res.credited, res.gain);
    assert.ok(close(loadProgress().frac, gain / needAt(5, P0), 1e-9));
  });
});

test('menu typing is NOT floored', () => {
  withStorage(save({ lv: 175, f: 0.2, rc: 4, kt: 7 }), () => {
    const P = currentPower();
    const res = awardWordXp({ mode: 'menu', wordLength: 5, weight: 1 });
    assert.equal(res.floor, null);
    assert.equal(res.credited, res.gain);
    const moved = loadProgress().frac - 0.2;
    assert.ok(close(moved, res.gain / needAt(175, P), 1e-12), `menu moved ${moved}`);
    assert.ok(moved < 0.005);
  });
  // no mode at all is the menu default
  withStorage(save({ lv: 175, rc: 4, kt: 7 }), () => assert.equal(awardWordXp({ wordLength: 5 }).floor, null));
});

test('wins are unchanged: the award never pays wins, and the wins basis is the real word XP', () => {
  withStorage(save({ lv: 175, rc: 4, kt: 7 }), () => {
    const w0 = getWins();
    const l0 = getWinsLifetime();
    const res = awardWordXp(WB);
    assert.ok(res.floor, 'the floor fired');
    assert.equal(getWins(), w0, 'balance untouched by the floor');
    assert.equal(getWinsLifetime(), l0);
    assert.equal(perWordWins(WB), res.gain / 10, 'a word still pays its real XP ÷ 10, not the floor');
    assert.ok(perWordWins(WB) < res.credited / 10);
  });
});

test('receipt: LEVEL FLOOR row = what the bar moved; paid / XP headline unchanged; stamp is one-shot', () => {
  withStorage(save({ lv: 175, f: 0.1, rc: 4, kt: 7 }), () => {
    const res = awardWordXp(WB);
    const factors = { mode: 2 };
    const p = buildPayout({ base: 5, factors, total: 10 });
    assert.ok(p.levelFloor);
    assert.equal(p.levelFloor.label, 'LEVEL FLOOR');
    assert.ok(close(p.levelFloor.pct, res.floor.pct, 1e-12));
    assert.ok(close(p.levelFloor.pct, (loadProgress().frac - 0.1) * 100, 1e-6), 'row = bar movement');
    assert.equal(p.paid, 10);
    assert.equal(p.xp, 100);
    assert.equal(p.rows.some((r) => r.label === 'LEVEL FLOOR'), false, 'never a multiplier row');
    // consumed: the next receipt does not inherit it
    assert.equal(buildPayout({ base: 5, factors }).levelFloor, null);
    assert.equal(takeBarFloorStamp(), null);
  });
  // A non-floored word clears any previous stamp.
  withStorage(save({ lv: 175, rc: 4, kt: 7 }), () => awardWordXp(WB));
  withStorage(save({ lv: 5 }), () => {
    awardWordXp(WB);
    assert.equal(buildPayout({ base: 5, factors: {} }).levelFloor, null);
  });
});

test('formatFloorPct', () => {
  assert.equal(formatFloorPct(0.5), '+0.5%');
  assert.equal(formatFloorPct(0.1257), '+0.13%');
  assert.equal(formatFloorPct(1e-9), '+<0.01%');
  assert.equal(formatFloorPct(0), '');
});
