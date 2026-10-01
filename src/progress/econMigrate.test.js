import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateEconomyV9, ECON_VERSION_KEY, MIGRATE_WINS_TIERS } from './econMigrate.js';
import { keyTierCostAt } from './xp.js';

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
  try { return fn(map); } finally { if (saved === undefined) delete globalThis.localStorage; else globalThis.localStorage = saved; }
}

test('a v8 save with an inflated balance keeps its tiers and gets a v9-sized balance, once', () => {
  withStorage({ 'taw.wins': String(2.4e12), 'taw.keytier': '15', 'taw.rebirths': '6', 'taw.xp': JSON.stringify({ lv: 125, into: 0 }) }, (map) => {
    let cap = 0;
    for (let i = 1; i <= MIGRATE_WINS_TIERS; i++) cap += keyTierCostAt(15 + i, 6);
    const r = migrateEconomyV9();
    assert.equal(r.migrated, true);
    assert.equal(Number(map.get('taw.wins')), cap);
    assert.equal(map.get('taw.keytier'), '15');
    assert.equal(map.get('taw.rebirths'), '6');
    assert.equal(map.get(ECON_VERSION_KEY), '9');
    map.set('taw.wins', '999999999');
    assert.equal(migrateEconomyV9().migrated, false, 'runs once');
    assert.equal(map.get('taw.wins'), '999999999');
  });
});

test('a small balance is untouched; a fresh player is just stamped', () => {
  withStorage({ 'taw.wins': '50' }, (map) => {
    migrateEconomyV9();
    assert.equal(map.get('taw.wins'), '50');
  });
  withStorage({}, (map) => {
    migrateEconomyV9();
    assert.equal(map.get(ECON_VERSION_KEY), '9');
  });
});
