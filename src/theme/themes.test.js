// themes.test.js — pins the theme catalog, ownership (bought + level-unlocked), the buy flow,
// and equipped-theme persistence/fallback. applyTheme's DOM write is exercised in the browser
// (e2e); here we test the pure logic + storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  THEMES,
  themeById,
  getOwnedThemes,
  isThemeOwned,
  syncThemeUnlocks,
  buyTheme,
  getEquippedTheme,
  setEquippedTheme,
  equippedPopColors,
  DEFAULT_THEME_ID,
} from './themes.js';

function withStorage(fn) {
  const saved = globalThis.localStorage;
  const map = new Map();
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

// A minimal wins API for buyTheme (mirrors wins.js get/save).
function winsApi(map) {
  return {
    getWins: () => Number(map.get('taw.wins') || 0),
    saveWins: (n) => map.set('taw.wins', String(n)),
  };
}

test('catalog: 5 themes, unique stable ids, default is free at price 0', () => {
  assert.equal(THEMES.length, 5);
  const ids = THEMES.map((t) => t.id);
  assert.deepEqual(ids, ['default', 'midnight', 'inferno', 'toxic', 'prism']);
  assert.equal(new Set(ids).size, 5);
  assert.equal(themeById('default').price, 0);
  // Prices + level gates per spec.
  assert.equal(themeById('midnight').price, 600);
  assert.equal(themeById('midnight').unlockLevel, 10);
  assert.equal(themeById('inferno').price, 2500);
  assert.equal(themeById('toxic').price, 8000);
  assert.equal(themeById('toxic').unlockLevel, 30);
  assert.equal(themeById('prism').price, 25000);
  // Each theme carries a full var map + a 4-swatch preview + 4 pop colours.
  for (const t of THEMES) {
    assert.equal(t.swatch.length, 4);
    assert.equal(t.pops.length, 4);
    assert.ok(t.vars['--theme-bg'] && t.vars['--theme-ink']);
  }
});

test('ownership: default always owned; others not until bought or unlocked', () => {
  withStorage(() => {
    assert.equal(isThemeOwned('default'), true);
    assert.equal(isThemeOwned('midnight'), false);
    assert.equal(isThemeOwned('prism'), false);
  });
});

test('buyTheme: deducts wins, grants ownership; rejects owned/unaffordable', () => {
  withStorage((map) => {
    const api = winsApi(map);
    api.saveWins(3000);
    // unaffordable (prism 25000)
    assert.equal(buyTheme('prism', api).ok, false);
    // affordable (inferno 2500)
    const r = buyTheme('inferno', api);
    assert.equal(r.ok, true);
    assert.equal(r.wins, 500); // 3000 - 2500
    assert.equal(isThemeOwned('inferno'), true);
    // already owned
    assert.equal(buyTheme('inferno', api).reason, 'owned');
  });
});

test('syncThemeUnlocks: LV10 grants MIDNIGHT free, LV30 grants TOXIC; idempotent + persisted', () => {
  withStorage(() => {
    assert.deepEqual(syncThemeUnlocks(9), []); // below the first gate
    assert.deepEqual(syncThemeUnlocks(10), ['midnight']); // MIDNIGHT unlocks at 10
    assert.equal(isThemeOwned('midnight'), true);
    assert.deepEqual(syncThemeUnlocks(10), []); // idempotent — already granted
    assert.deepEqual(syncThemeUnlocks(30), ['toxic']); // TOXIC at 30
    assert.equal(isThemeOwned('toxic'), true);
    // Survives a rebirth (level drops back to 1) — the grant is persisted, not recomputed.
    assert.equal(isThemeOwned('midnight'), true);
    assert.equal(isThemeOwned('toxic'), true);
  });
});

test('a level-unlocked theme needs no purchase but a NON-gated one still costs wins', () => {
  withStorage((map) => {
    const api = winsApi(map);
    api.saveWins(0);
    syncThemeUnlocks(30); // free midnight + toxic
    assert.equal(isThemeOwned('midnight'), true);
    assert.equal(isThemeOwned('toxic'), true);
    // inferno/prism are not level-gated → still locked with 0 wins.
    assert.equal(isThemeOwned('inferno'), false);
    assert.equal(buyTheme('inferno', api).reason, 'unaffordable');
  });
});

test('equipped theme: persists, falls back to default when the stored id is not owned', () => {
  withStorage(() => {
    assert.equal(getEquippedTheme(), DEFAULT_THEME_ID); // fresh
    // Can't equip an unowned theme.
    assert.equal(setEquippedTheme('prism'), false);
    assert.equal(getEquippedTheme(), DEFAULT_THEME_ID);
    // Own it, then equip.
    syncThemeUnlocks(10);
    assert.equal(setEquippedTheme('midnight'), true);
    assert.equal(getEquippedTheme(), 'midnight');
  });
});

test('equippedPopColors: returns the equipped theme\'s 4 pop colours', () => {
  withStorage(() => {
    assert.deepEqual(equippedPopColors(), themeById('default').pops);
    syncThemeUnlocks(10);
    setEquippedTheme('midnight');
    assert.deepEqual(equippedPopColors(), themeById('midnight').pops);
  });
});
