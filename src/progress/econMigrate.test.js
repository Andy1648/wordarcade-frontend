import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateEconomyV10, ECON_VERSION, ECON_VERSION_KEY, PV10_NOTICE_KEY, pv10NoticePending } from './econMigrate.js';
import { needV9, loadProgress } from './xp.js';

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
  try { return fn(map); } finally { if (saved === undefined) delete globalThis.localStorage; else globalThis.localStorage = saved; }
}

test('v10 migration: NO wins cap — a huge balance, the KEY tier and rebirths are kept exactly (must-fix 6)', () => {
  withStorage({ 'taw.wins': String(2.4e15), 'taw.winsLifetime': String(9e15), 'taw.keytier': '12', 'taw.rebirths': '6', 'taw.xp': JSON.stringify({ lv: 125, into: 0 }) }, (map) => {
    const r = migrateEconomyV10();
    assert.equal(r.migrated, true);
    assert.equal(map.get('taw.wins'), String(2.4e15), 'nobody loses wins');
    assert.equal(map.get('taw.winsLifetime'), String(9e15));
    assert.equal(map.get('taw.keytier'), '12');
    assert.equal(map.get('taw.rebirths'), '6');
    assert.equal(map.get(ECON_VERSION_KEY), String(ECON_VERSION));
    assert.equal(ECON_VERSION, 10);
    assert.equal(JSON.parse(map.get('taw.xp')).lv, 125, 'the level is kept');
    assert.equal(JSON.parse(map.get('taw.xp')).v, 10);
    assert.equal(migrateEconomyV10().migrated, false, 'runs once');
  });
});

test('a pre-v9 stamp is not capped either; a fresh player is just stamped (no notice, no gate)', () => {
  withStorage({ 'taw.wins': '1e14', 'taw.econ': '8', 'taw.xp': JSON.stringify({ lv: 20, into: 5 }) }, (map) => {
    migrateEconomyV10();
    assert.equal(map.get('taw.wins'), '1e14');
  });
  withStorage({}, (map) => {
    const r = migrateEconomyV10();
    assert.equal(r.converted, false);
    assert.equal(map.get(ECON_VERSION_KEY), '10');
    assert.equal(map.has(PV10_NOTICE_KEY), false);
    assert.equal(map.has('taw.rbgate'), false);
  });
});

test('the conversion keeps the bar where it was (fraction against the frozen v9 curve)', () => {
  const into = Math.round(needV9(150) * 0.4);
  withStorage({ 'taw.xp': JSON.stringify({ lv: 150, into }), 'taw.keytier': '9', 'taw.rebirths': '7', 'taw.econ': '9' }, (map) => {
    migrateEconomyV10();
    const st = JSON.parse(map.get('taw.xp'));
    assert.equal(st.lv, 150);
    assert.ok(Math.abs(st.f - into / needV9(150)) < 1e-12);
    assert.equal(st.rc, 7);
    assert.equal(map.get('taw.xpv10'), map.get('taw.xp'));
    assert.ok(Math.abs(loadProgress().frac - 0.4) < 1e-3);
  });
});

test('the one-time notice is set for a player with progress, and only once', () => {
  withStorage({ 'taw.xp': JSON.stringify({ lv: 3, into: 0 }) }, (map) => {
    migrateEconomyV10();
    assert.equal(map.get(PV10_NOTICE_KEY), '1');
    assert.equal(pv10NoticePending(), true);
    map.delete(PV10_NOTICE_KEY);
    migrateEconomyV10();
    assert.equal(map.has(PV10_NOTICE_KEY), false);
  });
});
