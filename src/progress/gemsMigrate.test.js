// gemsMigrate.test.js — the one-time GEMS starting grant: wins held ÷ the old roll price → rolls' worth of gems,
// at least 1 roll once rolls are open, capped at 100 rolls, once per save (stamped), and a restored blob without
// taw.gems gets its own grant.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startingGems, migrateGems, legacyRollPrice, START_CAP_ROLLS, LEGACY_ROLL_WORDS } from './gemsMigrate.js';
import { GEMS_KEY, getGems, loadGemState, resetGemsLedger, gemsLedger, noteLevelReached } from './gems.js';
import { importSave, exportSave } from '../save/saveBackup.js';
import { xpPerWord } from './xp.js';
import { gameKey, WORD_LEN_REF } from './wins.js';

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
  const st = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  globalThis.localStorage = st;
  resetGemsLedger();
  try {
    return fn(map, st);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
}

test('PURE: rolls worth = floor(wins ÷ old price) × 10 gems, ≥ 1 roll once rolls are open, ≤ 100 rolls', () => {
  assert.equal(startingGems({ wins: 0, price: 720, rollsOpen: false }), 0, 'a new player: 0 (the free roll waits)');
  assert.equal(startingGems({ wins: 0, price: 720, rollsOpen: true }), 10, 'rolls open: at least one roll');
  assert.equal(startingGems({ wins: 7199, price: 720, rollsOpen: true }), 90);
  assert.equal(startingGems({ wins: 7200, price: 720, rollsOpen: true }), 100);
  assert.equal(startingGems({ wins: 1e300, price: 720, rollsOpen: true }), START_CAP_ROLLS * 10, 'a whale is capped');
  assert.equal(startingGems({ wins: 5000, price: 720, rollsOpen: false }), 60, 'wins buy their rolls even before LV10');
  assert.equal(START_CAP_ROLLS, 100);
  assert.equal(LEGACY_ROLL_WORDS, 72);
});

test('the old price is exactly the shipped one: 72 × the reference word at this save\'s rate', () => {
  withStorage({}, () => {
    const rate = xpPerWord({ mode: gameKey('wordBomb'), wordLength: WORD_LEN_REF, bonusMult: 1 }) / 10;
    assert.equal(legacyRollPrice(), Math.max(1, Math.round(72 * rate)));
  });
});

test('runs ONCE per save; never touches the wins; levels already reached never pay LEVEL_UP', () => {
  withStorage({ 'taw.wins': '1000000', 'taw.records': JSON.stringify({ maxLevel: 120 }), 'taw.rebirths': '3' }, (m) => {
    const price = legacyRollPrice();
    const want = Math.min(100, Math.floor(1000000 / price)) * 10;
    assert.equal(migrateGems(), want);
    assert.equal(getGems(), want);
    assert.equal(m.get('taw.wins'), '1000000', 'nobody loses: the wins stay');
    assert.equal(loadGemState().mig, 1);
    assert.equal(loadGemState().peak, 120);
    assert.equal(gemsLedger()[0].reason, 'start');
    assert.equal(migrateGems(), 0, 'stamped: never twice');
    assert.equal(getGems(), want);
    assert.equal(noteLevelReached(100), 0, 'below the old peak: nothing');
    assert.equal(noteLevelReached(121), 2, 'a new peak pays');
  });
});

test('a fresh save: 0 gems, stamped, and its levels pay from LV2', () => {
  withStorage({}, () => {
    assert.equal(migrateGems(), 0);
    assert.equal(loadGemState().mig, 1);
    assert.equal(noteLevelReached(2), 2);
  });
});

test('RESTORED SAVES: a blob without taw.gems drops this browser\'s gems and gets its own grant; a blob with it keeps it', () => {
  withStorage({ 'taw.wins': '50', [GEMS_KEY]: JSON.stringify({ v: 1, bal: 999, peak: 5, streak: 0, mig: 1 }) }, (m, st) => {
    // an OLD code (no taw.gems): the local balance goes, the next boot grants from the blob's own wins
    const old = btoa(JSON.stringify({ format: 'taw-save', v: 1, keys: { 'taw.wins': '1000000', 'taw.rebirths': '1' } }));
    assert.equal(importSave(old, st).ok, true);
    assert.equal(m.get(GEMS_KEY), undefined, 'taw.gems removed (REMOVE_IF_ABSENT)');
    const g = migrateGems();
    assert.ok(g > 0 && g <= 1000);
    // a NEW code carries its balance + stamp
    const code = exportSave(st);
    m.set(GEMS_KEY, JSON.stringify({ v: 1, bal: 1, peak: 1, streak: 0, mig: 1 }));
    importSave(code, st);
    assert.equal(getGems(), g);
    assert.equal(migrateGems(), 0, 'the stamp came with it');
  });
});
