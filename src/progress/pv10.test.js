// node --test — PROGRESSION v10 (claude/econ-oct2/v10-spec.md): the power-scaled curve, the fraction
// storage, the legacy conversion, stale-tab protection, the finite-need guards and the grandfathered gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  need,
  needAt,
  needV9,
  powerOf,
  currentPower,
  round10,
  creditXp,
  loadProgress,
  saveProgress,
  progressOf,
  resolveXpState,
  storedLevel,
  doRebirth,
  rebirthThreshold,
  tableRebirthThreshold,
  keyTierXp,
  rebirthMult,
  clampFrac,
  FRAC_MAX,
  CURVE_BASE,
  EARLY_CURVE_EXP,
  XP_KEY,
  XP_SHADOW_KEY,
  REBIRTH_GATE_KEY,
} from './xp.js';
import { migrateEconomyV10 } from './econMigrate.js';
import { progressScoreFromKeys } from '../save/cloudSave.js';

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
const legacy = (lv, into) => JSON.stringify({ lv, into });
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ---- the curve ------------------------------------------------------------------------------------
test('v10 curve: at P = 1 the first 30 levels are exactly v9; above LV30 it is the chosen two-segment tail', () => {
  for (let n = 1; n <= 30; n++) assert.equal(needAt(n, 1), needV9(n), `LV${n}`);
  const b30 = round10(CURVE_BASE * Math.pow(EARLY_CURVE_EXP, 29));
  // the probe's formula (v10-probe-2seg.sh K=10 R=1.028 R2=1.018 B2=225), with the K ramp over LV30–40
  const probe = (n, P) => {
    const pw = Math.pow(P, 0.95);
    const k = Math.pow(10, Math.min(1, (n - 30) / 10));
    const seg = n <= 225 ? Math.pow(1.028, n - 30) : Math.pow(1.028, 195) * Math.pow(1.018, n - 225);
    return round10(b30 * k * seg * pw);
  };
  for (const P of [1, 2.5, 37.5, 1469 * 5]) {
    for (const n of [31, 35, 40, 41, 100, 195, 225, 226, 400, 1000]) assert.equal(needAt(n, P), probe(n, P), `LV${n} P${P}`);
  }
  // power scaling: need ∝ P^0.95 (P = 10 → ×10^0.95)
  assert.ok(close(needAt(100, 10) / needAt(100, 1), Math.pow(10, 0.95), 1e-4));
});

test('v10 curve: K ramps in over LV30–40 (no ×10 cliff at LV31) and every level costs more than the last', () => {
  const step31 = needAt(31, 1) / needAt(30, 1);
  assert.ok(step31 < 1.35, `LV31 step ×${step31} (no ×10 cliff)`);
  assert.ok(close(needAt(40, 1) / needAt(30, 1), 10 * Math.pow(1.028, 10), 1e-3), 'K = 10 fully in by LV40');
  for (let n = 2; n <= 3000; n++) assert.ok(needAt(n, 1) > needAt(n - 1, 1), `need(${n}) > need(${n - 1})`);
  // the tail never flattens below r2 per level
  assert.ok(needAt(500, 1) / needAt(499, 1) > 1.017);
});

test('P = KEY tier XP/10 × rebirth multiplier, ≥ 1, capped at 1e300', () => {
  assert.equal(powerOf(0, 0), 1);
  assert.equal(powerOf(4, 3), (keyTierXp(4) / 10) * rebirthMult(3));
  assert.equal(powerOf(0, 1e305), 1e300, 'capped at 1e300');
  assert.ok(Number.isFinite(powerOf(1000, 4)) && powerOf(1000, 4) >= 1, 'T1000 is finite');
  assert.equal(powerOf(NaN, NaN), 1);
  withStorage({ 'taw.keytier': '5', 'taw.rebirths': '2' }, () => {
    assert.equal(currentPower(), powerOf(5, 2));
    assert.equal(need(50), needAt(50, powerOf(5, 2)));
  });
});

// ---- must-fix 2: finite need + loop guard -------------------------------------------------------------
test('need is ALWAYS finite and > 0 — KEY tier 1000, LV 1e6, Infinity / NaN inputs', () => {
  const cases = [
    [1, powerOf(1000, 0)],
    [1000, powerOf(1000, 50)],
    [1e6, 1],
    [1e6, 1e300],
    [Infinity, 1],
    [1, Infinity],
    [Infinity, Infinity],
    [NaN, NaN],
    [-5, -5],
    [40000, 1],
  ];
  for (const [n, P] of cases) {
    const v = needAt(n, P);
    assert.ok(Number.isFinite(v) && v > 0, `needAt(${n}, ${P}) = ${v}`);
  }
  withStorage({ 'taw.keytier': '1000', 'taw.rebirths': '4' }, () => {
    for (const n of [1, 30, 31, 225, 1e6]) assert.ok(Number.isFinite(need(n)) && need(n) > 0);
  });
});

test('creditXp terminates at the extremes (Infinity / huge gains, LV 1e6, T1000)', () => {
  const t0 = Date.now();
  const a = creditXp({ level: 1e6, frac: 0.5 }, Number.MAX_VALUE, 1);
  assert.ok(a.state.level >= 1e6 && Number.isFinite(a.state.level));
  assert.ok(a.state.frac >= 0 && a.state.frac < 1);
  const b = creditXp({ level: 1, intoLevel: 0 }, Infinity, 1); // non-finite gain = 0
  assert.equal(b.state.level, 1);
  const c = creditXp({ level: 1, intoLevel: 0 }, 1e300, powerOf(1000, 9));
  assert.ok(Number.isFinite(c.state.level) && c.state.frac < 1);
  const d = creditXp({ level: 1, intoLevel: 0 }, 1e300, 1); // ~38k levels at P = 1
  assert.ok(d.state.level > 1000 && Number.isFinite(d.state.level));
  assert.ok(Date.now() - t0 < 5000, 'no runaway loop');
});

test('creditXp across a level boundary carries the remainder exactly', () => {
  const P = powerOf(3, 1);
  const L = 57;
  const start = { level: L, frac: 0.75 };
  const gain = needAt(L, P) * 0.25 + needAt(L + 1, P) * 0.4;
  const r = creditXp(start, gain, P);
  assert.equal(r.state.level, L + 1);
  assert.equal(r.leveledUp, true);
  assert.ok(close(r.state.frac, 0.4, 1e-9), `frac ${r.state.frac}`);
  // two boundaries in one credit
  const r2 = creditXp({ level: L, frac: 0 }, needAt(L, P) + needAt(L + 1, P) + 10, P);
  assert.equal(r2.state.level, L + 2);
  assert.ok(close(r2.state.intoLevel, 10, 1e-6));
});

// ---- must-fix 1: fraction storage + legacy conversion ---------------------------------------------------
test('legacy conversion: LV195 R4 at 99% stays LV195 at 99%', () => {
  const into = Math.floor(needV9(195) * 0.99);
  withStorage({ [XP_KEY]: legacy(195, into), 'taw.rebirths': '4', 'taw.keytier': '10' }, (map) => {
    migrateEconomyV10();
    const p = loadProgress();
    assert.equal(p.level, 195);
    assert.ok(close(p.frac, into / needV9(195), 1e-12), `frac ${p.frac}`);
    assert.ok(p.frac > 0.989);
    const st = JSON.parse(map.get(XP_KEY));
    assert.deepEqual(Object.keys(st).sort(), ['f', 'lv', 'rc', 'v']);
    assert.equal(st.rc, 4);
    // the bar shows XP numbers on the NEW curve: into = f × need
    assert.ok(close(progressOf(p).intoLevel, p.frac * need(195), 1e-3 * need(195)));
  });
});

test('legacy conversion: a high-level T0 R0 save (the new tail is CHEAPER there) neither zeroes nor bursts', () => {
  // at P = 1 v10 is cheaper than v9 above ~LV31, so into ≥ need(new) — the old clamp zeroed this bar
  const into = Math.floor(needV9(400) * 0.9);
  assert.ok(into > needAt(400, 1), 'the case under test: old into exceeds the new cost');
  withStorage({ [XP_KEY]: legacy(400, into) }, () => {
    migrateEconomyV10();
    const p = loadProgress();
    assert.equal(p.level, 400, 'no free levels');
    assert.ok(close(p.frac, 0.9, 1e-6), `frac ${p.frac} — not zeroed`);
    // the next small credit moves the bar a little; it does not carry levels
    const r = creditXp(p, 10);
    assert.equal(r.state.level, 400);
  });
  // a corrupt over-full legacy bar clamps just under full, never zero, never a level
  withStorage({ [XP_KEY]: legacy(50, 1e30) }, () => {
    const p = loadProgress();
    assert.equal(p.level, 50);
    assert.equal(p.frac, FRAC_MAX);
  });
});

test('a KEY buy mid-level keeps the fraction (P rises, the bar does not move)', () => {
  withStorage({ 'taw.keytier': '4', 'taw.rebirths': '2' }, (map) => {
    saveProgress({ level: 80, frac: 0.5 });
    const before = progressOf(loadProgress());
    map.set('taw.keytier', '5'); // the buy
    const after = progressOf(loadProgress());
    assert.equal(after.level, 80);
    assert.equal(after.frac, before.frac);
    assert.ok(after.cost > before.cost, 'the level costs more at the higher power');
    // a credit after the buy only moves the bar forward
    const r = creditXp(loadProgress(), 100);
    assert.ok(r.state.frac > 0.5 && r.state.level === 80);
  });
});

test('a P DROP (restore / reset of the KEY tier or rebirths) keeps the fraction — no burst', () => {
  withStorage({ 'taw.keytier': '12', 'taw.rebirths': '9' }, (map) => {
    saveProgress({ level: 150, frac: 0.97 });
    map.set('taw.keytier', '0');
    map.set('taw.rebirths', '0');
    const p = loadProgress();
    assert.equal(p.level, 150);
    assert.ok(close(p.frac, 0.97));
    const r = creditXp(p, 1);
    assert.equal(r.state.level, 150, 'no burst of levels');
  });
});

test('a fraction is never ≥ 1 or negative', () => {
  assert.equal(clampFrac(1), FRAC_MAX);
  assert.equal(clampFrac(Infinity), FRAC_MAX);
  assert.equal(clampFrac(-0.2), 0);
  assert.equal(clampFrac(NaN), 0);
});

// ---- must-fix 3: stale tabs / old bundles -------------------------------------------------------------
test('a legacy-shaped write AFTER the v10 stamp never raises the level (the v10 shadow is kept)', () => {
  withStorage({ [XP_KEY]: legacy(120, 0), 'taw.rebirths': '3' }, (map) => {
    migrateEconomyV10();
    saveProgress({ level: 121, frac: 0.3 });
    // an old bundle farms the old curve and writes {lv, into}
    map.set(XP_KEY, legacy(400, 5));
    assert.equal(resolveXpState((k) => map.get(k) ?? null).source, 'stale');
    assert.equal(storedLevel(), 121);
    const p = loadProgress();
    assert.equal(p.level, 121);
    assert.ok(close(p.frac, 0.3));
    assert.equal(JSON.parse(map.get(XP_KEY)).v, 10, 'rewritten in the v10 shape');
    // the boot migration sees it too
    map.set(XP_KEY, legacy(999, 0));
    assert.equal(migrateEconomyV10().migrated, false);
    assert.equal(JSON.parse(map.get(XP_KEY)).lv, 121);
    // and the cloud progress score reads the authoritative level, not the stale one
    map.set(XP_KEY, legacy(999, 0));
    const score = progressScoreFromKeys(Object.fromEntries(map));
    assert.equal(score, progressScoreFromKeys({ 'taw.rebirths': '3', [XP_KEY]: JSON.stringify({ lv: 121, f: 0.3, rc: 3, v: 10 }) }));
  });
});

test('a rebirth done in a stale bundle is honoured (taw.rebirths > rc), never above the shadow level', () => {
  withStorage({ [XP_KEY]: legacy(120, 0), 'taw.rebirths': '3' }, (map) => {
    migrateEconomyV10();
    // the old bundle rebirths (level → 1, rebirths 4) and farms to LV9 on the old curve
    map.set('taw.rebirths', '4');
    map.set(XP_KEY, legacy(9, 0));
    const p = loadProgress();
    assert.equal(p.level, 9);
    assert.equal(JSON.parse(map.get(XP_KEY)).rc, 4);
    // ...but a stale level above the pre-rebirth shadow is clamped to it
  });
  withStorage({ [XP_KEY]: legacy(20, 0), 'taw.rebirths': '1' }, (map) => {
    migrateEconomyV10();
    map.set('taw.rebirths', '2');
    map.set(XP_KEY, legacy(300, 0));
    assert.equal(loadProgress().level, 20);
  });
});

test('a legacy save is detected by SHAPE: no stamp → converted; v10 shape → used as is whatever the stamp', () => {
  withStorage({ [XP_KEY]: legacy(60, 100), 'taw.econ': '10' }, () => {
    // stamped but no shadow (e.g. an import kept the stamp): still converted, never trusted raw
    assert.equal(resolveXpState((k) => globalThis.localStorage.getItem(k)).source, 'legacy');
    assert.equal(loadProgress().level, 60);
  });
  withStorage({ [XP_KEY]: JSON.stringify({ lv: 77, f: 0.25, rc: 0, v: 10 }) }, () => {
    const p = loadProgress();
    assert.equal(p.level, 77);
    assert.equal(p.frac, 0.25);
  });
});

test('doRebirth writes the v10 shape with the NEW rebirth count', () => {
  withStorage({ 'taw.rebirths': '2' }, (map) => {
    saveProgress({ level: 40, frac: 0.6 });
    doRebirth();
    const st = JSON.parse(map.get(XP_KEY));
    assert.deepEqual(st, { lv: 1, f: 0, rc: 3, v: 10 });
    assert.equal(map.get(XP_SHADOW_KEY), map.get(XP_KEY));
  });
});

// ---- must-fix 5: the grandfathered rebirth gate --------------------------------------------------------
test('the grandfathered rebirth gate: min(table, LV + 25) for the NEXT rebirth, used once', () => {
  // Tangie: R10 LV126 → the table wants LV225 for R11; grandfathered at 151
  withStorage({ [XP_KEY]: legacy(126, 0), 'taw.rebirths': '10' }, (map) => {
    const r = migrateEconomyV10();
    assert.deepEqual(r.gate, { rc: 10, lv: 151 });
    assert.equal(tableRebirthThreshold(10), 225);
    assert.equal(rebirthThreshold(10), 151);
    assert.equal(rebirthThreshold(11), tableRebirthThreshold(11), 'only the NEXT rebirth');
    migrateEconomyV10();
    assert.equal(rebirthThreshold(10), 151, 'a second boot does not move it');
    doRebirth();
    assert.equal(map.has(REBIRTH_GATE_KEY), false, 'spent');
    assert.equal(rebirthThreshold(11), 260);
    map.set('taw.rebirths', '10'); // even back at R10, the gate is gone
    assert.equal(rebirthThreshold(10), 225);
  });
  // no gate when the table is already within 25 levels, or for a fresh player
  withStorage({ [XP_KEY]: legacy(50, 0), 'taw.rebirths': '3' }, (map) => {
    migrateEconomyV10();
    assert.equal(map.has(REBIRTH_GATE_KEY), false);
    assert.equal(rebirthThreshold(3), 60);
  });
  withStorage({}, (map) => {
    migrateEconomyV10();
    assert.equal(map.has(REBIRTH_GATE_KEY), false);
  });
});
