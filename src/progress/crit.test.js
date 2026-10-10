// crit.test.js — CRIT (Andy oct8): the gear tier table, ★ pips × SHINY scaling, summing the worn gears, the 50% cap,
// the per-key rng roll, the exact batch total, and the words the STATS row / the gear card print.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLL_MARKS, PERMANENT_MARKS, CRIT_BY_TIER, CRIT_BASE_POWER, CRIT_RATE_CAP, CRIT_BASE_RATE, critStatsOf, critTotals, freshState,
  MAX_PIPS, DUPES_PER_PIP, SHINY_MULT,
} from './markRolls.js';
import { MARKS_EQUIPPED_KEY } from './marks.js';
import { MARK_ROLLS_STORE_KEY } from './markPerks.js';
import { rollCrit, critKey, critBatch, critAvgGain, critOneIn } from './crit.js';
import { critLines, critSummary } from './critText.js';
import { mulberry32 } from './luck.js';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);
const byTier = (t) => ROLL_MARKS.find((m) => m.tier === t);
const own = (marks) => ({ ...freshState(), marks });

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
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

test('the tier table is Andy\'s (no COMMON — GEAR POOL v2): RARE +3% · EPIC +6% +0.5× · LEGENDARY +9% +1× · MYTHIC +14% +2× · SECRET +20% +3× (GEAR OP)', () => {
  assert.equal(CRIT_BY_TIER.common, undefined);
  assert.deepEqual({ ...CRIT_BY_TIER.rare }, { rate: 0.03, power: 0 });
  assert.deepEqual({ ...CRIT_BY_TIER.epic }, { rate: 0.06, power: 0.5 });
  assert.deepEqual({ ...CRIT_BY_TIER.legendary }, { rate: 0.09, power: 1 });
  assert.deepEqual({ ...CRIT_BY_TIER.mythic }, { rate: 0.14, power: 2 });
  assert.deepEqual({ ...CRIT_BY_TIER.secret }, { rate: 0.2, power: 3 });
  assert.equal(CRIT_BASE_POWER, 2);
  assert.equal(CRIT_RATE_CAP, 0.5);
  // every rollable gear reads its tier's row at ★0 (no state)
  for (const m of ROLL_MARKS) assert.deepEqual(critStatsOf(m.id, null), { ...CRIT_BY_TIER[m.tier] }, m.id);
  // EARNED gears carry the LEGENDARY crit; unknown ids none
  for (const p of PERMANENT_MARKS) assert.deepEqual(critStatsOf(p.id, null), { ...CRIT_BY_TIER.legendary }, p.id);
  assert.deepEqual(critStatsOf('mk-nope', null), { rate: 0, power: 0 });
  assert.deepEqual(critStatsOf(null, null), { rate: 0, power: 0 });
});

test('★ pips × SHINY scale the crit stats exactly as they scale the MAIN stat', () => {
  const leg = byTier('legendary');
  const n5 = 1 + DUPES_PER_PIP.legendary * MAX_PIPS; // ★5 = ×2
  const st = own({ [leg.id]: { n: n5 } });
  const c = critStatsOf(leg.id, st);
  near(c.rate, 0.18, '★5 legendary rate');
  near(c.power, 2, '★5 legendary power');
  const shiny = own({ [leg.id]: { n: n5, shiny: true } });
  const s = critStatsOf(leg.id, shiny);
  near(s.rate, 0.09 * 2 * SHINY_MULT, '★5 shiny rate');
  near(s.power, 1 * 2 * SHINY_MULT, '★5 shiny power');
});

test('critTotals: BASE 1% · ×2, SUMS the worn MAIN + the 2nd slot, caps the rate at 50%', () => {
  const st = own({});
  assert.deepEqual(critTotals({ markId: null, mark2Id: null, state: st }), { rate: CRIT_BASE_RATE, power: 2, rawRate: CRIT_BASE_RATE, every: 0, ids: [] });
  const leg = byTier('legendary');
  const myth = byTier('mythic');
  const one = critTotals({ markId: leg.id, mark2Id: null, state: st });
  near(one.rate, 0.1, 'legendary alone (+ the 1% base)');
  near(one.power, 3, 'legendary power ×3');
  const two = critTotals({ markId: leg.id, mark2Id: myth.id, state: st });
  near(two.rate, 0.24, 'legendary + mythic rate (+1% base)');
  near(two.power, 2 + 1 + 2, 'legendary + mythic power');
  // the same gear twice counts once
  near(critTotals({ markId: leg.id, mark2Id: leg.id, state: st }).rate, 0.1, 'no double count');
  // the cap: a ★5 shiny secret = 20% × 4 = 80% (+ an earned 9% + 1%) → 50%
  const sec = byTier('secret');
  const big = own({ [sec.id]: { n: 1 + DUPES_PER_PIP.secret * MAX_PIPS, shiny: true } });
  const capped = critTotals({ markId: sec.id, mark2Id: 'mk-ironhand', state: big });
  assert.equal(capped.rate, CRIT_RATE_CAP);
  near(capped.rawRate, 0.2 * 4 + 0.09 + 0.01, 'uncapped sum kept');
  near(capped.power, 2 + 3 * 4 + 1, 'power is never capped');
});

test('critTotals reads the worn MAIN from storage (season 1: no 2nd slot)', () => {
  const leg = byTier('legendary');
  const st = own({ [leg.id]: { n: 1 } });
  withStorage({ [MARK_ROLLS_STORE_KEY]: JSON.stringify(st), [MARKS_EQUIPPED_KEY]: leg.id }, () => {
    const t = critTotals();
    near(t.rate, 0.1, 'worn legendary (+1% base)');
    near(t.power, 3, 'worn legendary power');
    assert.deepEqual(t.ids, [leg.id]);
  });
  withStorage({}, () => assert.deepEqual(critTotals(), { rate: CRIT_BASE_RATE, power: 2, rawRate: CRIT_BASE_RATE, every: 0, ids: [] }));
});

test('rollCrit: rng() < rate — 0% never (rng untouched), 100% always, and the rng decides in between', () => {
  let calls = 0;
  const spy = () => { calls += 1; return 0; };
  assert.equal(rollCrit(0, spy), false);
  assert.equal(calls, 0, 'a 0% rate never consumes the rng');
  assert.equal(rollCrit(1, () => 0.999999), true);
  assert.equal(rollCrit(0.06, () => 0.0599), true);
  assert.equal(rollCrit(0.06, () => 0.06), false);
  assert.equal(rollCrit(NaN, () => 0), false);
  // over many seeded keys the hit rate lands on the rate
  const rng = mulberry32(42);
  let hits = 0;
  const N = 200000;
  for (let i = 0; i < N; i++) if (rollCrit(0.12, rng)) hits += 1;
  assert.ok(Math.abs(hits / N - 0.12) < 0.004, `observed ${hits / N}`);
});

test('critKey: a crit pays perKey × POWER, a miss pays perKey', () => {
  assert.deepEqual(critKey(4, { rate: 0.5, power: 2.5 }, () => 0.1), { gain: 10, crit: true });
  assert.deepEqual(critKey(4, { rate: 0.5, power: 2.5 }, () => 0.9), { gain: 4, crit: false });
  assert.deepEqual(critKey(4, { rate: 0, power: 9 }, () => 0), { gain: 4, crit: false });
});

test('critBatch: every key rolls on its own and the total is EXACTLY the sum of the per-key gains', () => {
  const crit = { rate: 0.15, power: 3.5 };
  const a = mulberry32(7);
  const b = mulberry32(7);
  const n = 5000;
  const per = 2;
  let sum = 0;
  let crits = 0;
  for (let i = 0; i < n; i++) {
    const k = critKey(per, crit, a);
    sum += k.gain;
    if (k.crit) crits += 1;
  }
  const batch = critBatch(n, per, crit, b);
  assert.equal(batch.crits, crits, 'same rng stream → same crits: one roll per key');
  assert.equal(batch.total, (n - crits) * per + crits * per * 3.5);
  near(batch.total, sum, 'batch total = Σ per-key gains');
  assert.deepEqual(critBatch(0, per, crit, b), { total: 0, crits: 0 });
});

test('the average gain and the words the STATS row prints', () => {
  near(critAvgGain({ rate: 0.12, power: 2.5 }), 0.18, '12% · ×2.5 → +18%');
  assert.equal(critOneIn(0.12), 8);
  assert.equal(critOneIn(0), null);
  const on = critSummary({ rate: 0.12, power: 2.5 });
  assert.equal(on.head, 'CRIT 12% · ×2.5');
  assert.equal(on.sub, '1 KEY IN 8 CRITS · +18% XP ON AVERAGE');
  const off = critSummary({ rate: 0, power: 2 });
  assert.equal(off.on, false);
  assert.equal(off.head, 'CRIT 0% · ×2');
  assert.equal(off.sub, 'ROLL A RARE+ GEAR');
  // the cap shows as 50%
  assert.equal(critSummary({ rate: 0.5, power: 8.5 }).head, 'CRIT 50% · ×8.5');
});

test('the detail sheet / roll result lines (the tile shows a pip per line — GEAR TILE v2)', () => {
  assert.deepEqual(critLines({ rate: 0.06, power: 0.5 }).map((l) => `${l.num} ${l.kind}`), ['+6% CRIT RATE', '+0.5× CRIT POWER']);
  assert.deepEqual(critLines({ rate: 0.02, power: 0 }).map((l) => `${l.num} ${l.kind}`), ['+2% CRIT RATE']);
  assert.deepEqual(critLines({ rate: 0, power: 0 }), []);
});
