import test from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateEconomyV10,
  migrateEconomyV11,
  ECON_VERSION,
  ECON_VERSION_KEY,
  PV10_NOTICE_KEY,
  rebirthRushConvert,
  RR_NOTICE_KEY,
} from './econMigrate.js';
import { needV9, loadProgress, getRebirths, getKeyTier } from './xp.js';

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
  try { return fn(map); } finally { if (saved === undefined) delete globalThis.localStorage; else globalThis.localStorage = saved; }
}
const v10 = (lv, f, rc) => JSON.stringify({ lv, f, rc, v: 10 });

test('ECON_VERSION is 12 (Rebirth Rush)', () => {
  assert.equal(ECON_VERSION, 12);
});

// ---- REBIRTH RUSH one-time conversion (PROGRESSION FINAL "EXISTING PLAYERS") -----------------------------
test('rebirthRushConvert: L ≥ 15 + 18R → +floor((L − gate)/18) + 1 rebirths and LV1; below the gate keeps', () => {
  assert.deepEqual(rebirthRushConvert(195, 4), { rebirths: 11, level: 1, added: 7 }); // gate 87
  assert.deepEqual(rebirthRushConvert(168, 8), { rebirths: 9, level: 1, added: 1 }); // gate 159
  assert.deepEqual(rebirthRushConvert(156, 7), { rebirths: 8, level: 1, added: 1 }); // gate 141
  assert.deepEqual(rebirthRushConvert(144, 9), { rebirths: 9, level: 144, added: 0 }); // gate 177
  assert.deepEqual(rebirthRushConvert(126, 10), { rebirths: 10, level: 126, added: 0 }); // gate 195
  assert.deepEqual(rebirthRushConvert(14, 0), { rebirths: 0, level: 14, added: 0 });
  assert.deepEqual(rebirthRushConvert(15, 0), { rebirths: 1, level: 1, added: 1 });
  // edges: exactly one step past the gate adds 2; one short of it adds 1
  assert.deepEqual(rebirthRushConvert(33, 0), { rebirths: 2, level: 1, added: 2 });
  assert.deepEqual(rebirthRushConvert(32, 0), { rebirths: 1, level: 1, added: 1 });
  // garbage reads as LV1 / R0
  assert.deepEqual(rebirthRushConvert(NaN, -1), { rebirths: 0, level: 1, added: 0 });
  assert.deepEqual(rebirthRushConvert(undefined, undefined), { rebirths: 0, level: 1, added: 0 });
});

test('a v10/v11 save above its gate converts to rebirths: LV1, KEY tier kept, wins kept, peak recorded, no notice', () => {
  withStorage({ 'taw.xp': v10(195, 0.5, 4), 'taw.xpv10': v10(195, 0.5, 4), 'taw.econ': '11', 'taw.rebirths': '4', 'taw.keytier': '6', 'taw.wins': '1e9' }, (map) => {
    const r = migrateEconomyV11();
    assert.equal(r.migrated, true);
    assert.equal(r.rebirthRush.added, 7);
    assert.equal(getRebirths(), 11);
    const p = loadProgress();
    assert.equal(p.level, 1);
    assert.equal(p.frac, 0);
    assert.equal(JSON.parse(map.get('taw.xp')).rc, 11);
    assert.equal(getKeyTier(), 6, 'the KEY tier number is kept by the conversion');
    assert.equal(map.get('taw.wins'), '1e9', 'nobody loses wins');
    assert.equal(JSON.parse(map.get('taw.records')).maxLevel, 195, 'the run peak is recorded first');
    assert.equal(map.get(ECON_VERSION_KEY), '12');
    assert.equal(map.has(RR_NOTICE_KEY), false, 'silent: no notice flag (the ONE-NOTICE rule)');
  });
});

test('a save below its gate keeps its level AND fraction (R9 LV144, R10 LV126), no notice', () => {
  for (const [lv, rc] of [[144, 9], [126, 10]]) {
    withStorage({ 'taw.xp': v10(lv, 0.437, rc), 'taw.xpv10': v10(lv, 0.437, rc), 'taw.econ': '11', 'taw.rebirths': String(rc), 'taw.keytier': '17' }, (map) => {
      const r = migrateEconomyV11();
      assert.equal(r.rebirthRush.added, 0);
      assert.equal(getRebirths(), rc);
      const p = loadProgress();
      assert.equal(p.level, lv, 'nobody loses levels');
      assert.ok(Math.abs(p.frac - 0.437) < 1e-12, 'the bar sits at the same fraction');
      assert.equal(map.get('taw.keytier'), '17');
      assert.equal(map.has(RR_NOTICE_KEY), false);
      assert.equal(map.get(ECON_VERSION_KEY), '12');
    });
  }
});

test('the conversion runs ONCE per save, and re-runs for a restored blob that carries an old stamp', () => {
  withStorage({ 'taw.xp': v10(15, 0, 0), 'taw.xpv10': v10(15, 0, 0), 'taw.econ': '11' }, (map) => {
    assert.equal(migrateEconomyV11().rebirthRush.added, 1);
    assert.equal(getRebirths(), 1);
    // The player climbs back above the gate under the new stamp: no second conversion.
    map.set('taw.xp', v10(60, 0.2, 1));
    map.set('taw.xpv10', v10(60, 0.2, 1));
    const again = migrateEconomyV11();
    assert.equal(again.migrated, false);
    assert.equal(again.rebirthRush, undefined);
    assert.equal(getRebirths(), 1);
    assert.equal(loadProgress().level, 60);
    // A cloud restore of an OLD save (its own stamp 11) converts like any other pre-Rebirth-Rush save.
    map.set('taw.xp', v10(168, 0.3, 8));
    map.set('taw.xpv10', v10(168, 0.3, 8));
    map.set('taw.rebirths', '8');
    map.set('taw.econ', '11');
    const restored = migrateEconomyV11();
    assert.equal(restored.rebirthRush.added, 1);
    assert.equal(getRebirths(), 9);
    assert.equal(loadProgress().level, 1);
    // ...and a restored blob with NO stamp (importSave drops it) converts too.
    map.set('taw.xp', v10(156, 0.3, 7));
    map.set('taw.xpv10', v10(156, 0.3, 7));
    map.set('taw.rebirths', '7');
    map.delete('taw.econ');
    assert.equal(migrateEconomyV11().rebirthRush.added, 1);
    assert.equal(getRebirths(), 8);
    assert.equal(map.get(ECON_VERSION_KEY), '12');
  });
});

test('a fresh player is just stamped 12 (no conversion, no notice, no gate)', () => {
  withStorage({}, (map) => {
    const r = migrateEconomyV10();
    assert.equal(r.converted, false);
    assert.equal(r.rebirthRush.added, 0);
    assert.equal(map.get(ECON_VERSION_KEY), '12');
    assert.equal(map.has(PV10_NOTICE_KEY), false);
    assert.equal(map.has(RR_NOTICE_KEY), false);
    assert.equal(map.has('taw.rbgate'), false);
    assert.equal(map.has('taw.xp'), false);
    assert.equal(migrateEconomyV10().migrated, false, 'runs once');
  });
});

test('storage blocked: the migration never throws', () => {
  const saved = globalThis.localStorage;
  const boom = () => {
    throw new Error('blocked');
  };
  globalThis.localStorage = { getItem: boom, setItem: boom, removeItem: boom };
  try {
    assert.doesNotThrow(() => migrateEconomyV11());
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
});

// ---- the legacy (pre-v10) shape conversion still runs first, then Rebirth Rush ----------------------------
test('legacy save: NO wins cap — balance, KEY tier kept; the level is converted, then Rebirth Rush applies', () => {
  // LV125 R6: gate 15 + 108 = 123 → +1 rebirth, LV1.
  withStorage({ 'taw.wins': String(2.4e15), 'taw.winsLifetime': String(9e15), 'taw.keytier': '12', 'taw.rebirths': '6', 'taw.xp': JSON.stringify({ lv: 125, into: 0 }) }, (map) => {
    const r = migrateEconomyV10();
    assert.equal(r.migrated, true);
    assert.equal(r.converted, true);
    assert.equal(map.get('taw.wins'), String(2.4e15), 'nobody loses wins');
    assert.equal(map.get('taw.winsLifetime'), String(9e15));
    assert.equal(map.get('taw.keytier'), '12');
    assert.equal(map.get('taw.rebirths'), '7');
    assert.equal(map.get(ECON_VERSION_KEY), '12');
    assert.equal(JSON.parse(map.get('taw.xp')).lv, 1);
    assert.equal(JSON.parse(map.get('taw.xp')).v, 10);
    assert.equal(map.has('taw.rbgate'), false, 'the old one-time gate is dropped (one rule for everyone)');
    assert.equal(migrateEconomyV10().migrated, false, 'runs once');
  });
});

test('legacy save below its gate keeps the bar where it was (fraction against the frozen v9 curve)', () => {
  // LV140 R7: gate 141 → kept.
  const into = Math.round(needV9(140) * 0.4);
  withStorage({ 'taw.xp': JSON.stringify({ lv: 140, into }), 'taw.keytier': '9', 'taw.rebirths': '7', 'taw.econ': '9' }, (map) => {
    migrateEconomyV10();
    const st = JSON.parse(map.get('taw.xp'));
    assert.equal(st.lv, 140);
    assert.ok(Math.abs(st.f - into / needV9(140)) < 1e-12);
    assert.equal(st.rc, 7);
    assert.equal(map.get('taw.xpv10'), map.get('taw.xp'));
    assert.ok(Math.abs(loadProgress().frac - 0.4) < 1e-3);
    assert.equal(map.has('taw.rbgate'), false);
  });
});

test('the ONE-NOTICE rule: no notice flag is ever set, and a stale one an older build left is deleted', () => {
  withStorage({ 'taw.xp': JSON.stringify({ lv: 3, into: 0 }) }, (map) => {
    migrateEconomyV10();
    assert.equal(map.has(PV10_NOTICE_KEY), false);
    assert.equal(map.has(RR_NOTICE_KEY), false);
  });
  withStorage({ 'taw.econ': '12', [PV10_NOTICE_KEY]: '1', [RR_NOTICE_KEY]: '3' }, (map) => {
    migrateEconomyV11();
    assert.equal(map.has(PV10_NOTICE_KEY), false);
    assert.equal(map.has(RR_NOTICE_KEY), false);
  });
});

test('a stale legacy write after the v10 stamp never raises the level (shadow kept)', () => {
  const sh = v10(40, 0.25, 2); // R2 gate 51: LV40 is kept
  withStorage({ 'taw.xp': JSON.stringify({ lv: 400, into: 5 }), 'taw.xpv10': sh, 'taw.econ': '10', 'taw.rebirths': '2' }, (map) => {
    migrateEconomyV11();
    const st = JSON.parse(map.get('taw.xp'));
    assert.equal(st.lv, 40);
    assert.equal(st.v, 10);
    assert.equal(map.get(ECON_VERSION_KEY), '12');
    assert.equal(loadProgress().level, 40);
    assert.equal(getRebirths(), 2, 'the stale LV400 never feeds the conversion');
  });
});

// The ONE-NOTICE rule: neither a converted save nor one below its gate gets a notice flag.
test('Rebirth Rush conversion sets no notice, above or below the gate', () => {
  withStorage({ 'taw.xp': JSON.stringify({ lv: 195, into: 0 }), 'taw.rebirths': '4' }, (map) => {
    const r = migrateEconomyV11();
    assert.ok(r.rebirthRush.added > 0);
    assert.equal(map.has(PV10_NOTICE_KEY), false);
    assert.equal(map.has(RR_NOTICE_KEY), false);
  });
  withStorage({ 'taw.xp': JSON.stringify({ lv: 10, into: 0 }), 'taw.rebirths': '1' }, (map) => {
    const r = migrateEconomyV11(); // gate 33: nothing converts
    assert.equal(r.rebirthRush.added, 0);
    assert.equal(map.has(PV10_NOTICE_KEY), false);
  });
});
