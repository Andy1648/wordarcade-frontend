// node --test — the pure XP model: level curve, level-from-xp derivation, the anti-mash
// rate cap, the creditable-key filter, and the storage-failure fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  need,
  levelFromXp,
  creditXp,
  createRateLimiter,
  isCreditableKey,
  loadProgress,
  saveProgress,
  getTaps,
  saveTaps,
  XP_MULTIPLIERS,
  xpPerInput,
  rebirthThreshold,
  rebirthMult,
  canRebirth,
  doRebirth,
  getRebirths,
  keyPowerCost,
  keyPowerBaseXp,
  getKeyPower,
} from './xp.js';

// A fresh in-memory localStorage installed as the global for a test body.
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
// cumulative XP to REACH a level (sum need(1..L-1)).
function cumCost(level) {
  let acc = 0;
  for (let k = 1; k < level; k++) acc += need(k);
  return acc;
}

// ---- level cost curve (exponential) ----
test('need() matches the pinned anchor values', () => {
  assert.equal(need(1), 118);
  assert.equal(need(5), 229);
  assert.equal(need(10), 523);
  assert.equal(need(20), 2739);
  assert.equal(need(30), 14337);
});

test('XP_MULTIPLIERS are the sanctioned per-mode values', () => {
  assert.equal(XP_MULTIPLIERS.menu, 1);
  assert.equal(XP_MULTIPLIERS['word-bomb'], 2);
  assert.equal(XP_MULTIPLIERS['category-blitz'], 2);
  assert.equal(XP_MULTIPLIERS['sat-rush'], 3);
  assert.equal(XP_MULTIPLIERS.chain, 4);
  assert.equal(XP_MULTIPLIERS.fuse, 5);
});

// ---- Key Power ----
test('keyPowerCost grows 15%/level: lv0=50, lv5=101, lv20=818', () => {
  assert.equal(keyPowerCost(0), 50);
  assert.equal(keyPowerCost(5), 101);
  assert.equal(keyPowerCost(20), 818);
});

test('keyPowerBaseXp = 10 + 2·level', () => {
  assert.equal(keyPowerBaseXp(0), 10);
  assert.equal(keyPowerBaseXp(20), 50);
});

// ---- level derived from cumulative xp, swept 0..100000 ----
test('level derived from cumulative xp is correct across a 0..100000 sweep', () => {
  // Independent oracle: precompute cumulative thresholds cum[L] = XP needed to REACH L.
  const cum = [0, 0]; // cum[1] = 0 (level 1 starts at 0 xp)
  let acc = 0;
  let L = 1;
  while (acc <= 100000) {
    acc += need(L);
    L += 1;
    cum[L] = acc;
  }
  for (let xp = 0; xp <= 100000; xp++) {
    const r = levelFromXp(xp);
    // cum[level] <= xp < cum[level+1]
    assert.ok(cum[r.level] <= xp, `xp=${xp}: cum[${r.level}]=${cum[r.level]} !<= ${xp}`);
    assert.ok(xp < cum[r.level + 1], `xp=${xp}: ${xp} !< cum[${r.level + 1}]=${cum[r.level + 1]}`);
    // progress fields stay internally consistent
    assert.equal(r.intoLevel, xp - cum[r.level]);
    assert.equal(r.cost, need(r.level));
    assert.equal(r.toNext, r.cost - r.intoLevel);
    assert.ok(r.intoLevel >= 0 && r.intoLevel < r.cost);
    assert.ok(r.frac >= 0 && r.frac < 1);
  }
});

test('levelFromXp: worked example at level 7 (curve-independent)', () => {
  const r = levelFromXp(cumCost(7) + 100); // 100 xp into level 7
  assert.equal(r.level, 7);
  assert.equal(r.cost, need(7));
  assert.equal(r.intoLevel, 100);
  assert.equal(r.toNext, need(7) - 100);
});

test('the XP stack (single source): key power × mode × rebirth', () => {
  // key power 0 + menu (×1) + R0 (×1) = 10.
  assert.equal(xpPerInput({ mode: 'menu', keyPowerLevel: 0, rebirthCount: 0 }), 10);
  // key power 20 + sat-rush (×3) + R1 (×1.5) = (10+40)·3·1.5 = 225.
  assert.equal(xpPerInput({ mode: 'sat-rush', keyPowerLevel: 20, rebirthCount: 1 }), 225);
});

test('rebirth thresholds: rebirths 0→15, 1→18, 2→21; multipliers 1.5/2.0/2.5', () => {
  assert.equal(rebirthThreshold(0), 15);
  assert.equal(rebirthThreshold(1), 18);
  assert.equal(rebirthThreshold(2), 21);
  assert.equal(rebirthMult(1), 1.5);
  assert.equal(rebirthMult(2), 2.0);
  assert.equal(rebirthMult(3), 2.5);
});

test('rebirth is refused at LV14 and allowed at LV15', () => {
  const xp14 = cumCost(14); // exactly at the start of level 14
  const xp15 = cumCost(15); // exactly at the start of level 15
  assert.equal(levelFromXp(xp14).level, 14);
  assert.equal(levelFromXp(xp15).level, 15);
  assert.equal(canRebirth(xp14, 0), false);
  assert.equal(canRebirth(xp15, 0), true);
});

test('doRebirth zeroes xp and preserves wins/owned/equipped/lifetimeLetters/rebirths+1', () => {
  withStorage(
    {
      'taw.xp': String(cumCost(20)),
      'taw.letters': '1234',
      'taw.wins': '500',
      'taw.winsLifetime': '900',
      'taw.owned': JSON.stringify(['classic', 'thock', 'prism']),
      'taw.equipped': JSON.stringify({ popStyle: 'prism', soundPack: 'thock' }),
      'taw.rebirths': '1',
      'taw.taps': '42',
      'taw.keypower': '7',
    },
    (map) => {
      const rc = doRebirth();
      assert.equal(rc, 2); // rebirth count bumped
      assert.equal(getRebirths(), 2);
      assert.equal(loadProgress().xp, 0); // xp zeroed
      assert.equal(loadProgress().lifetimeLetters, 1234); // preserved
      // everything else untouched (their own keys)
      assert.equal(map.get('taw.wins'), '500');
      assert.equal(map.get('taw.winsLifetime'), '900');
      assert.equal(map.get('taw.owned'), JSON.stringify(['classic', 'thock', 'prism']));
      assert.equal(map.get('taw.equipped'), JSON.stringify({ popStyle: 'prism', soundPack: 'thock' }));
      assert.equal(map.get('taw.taps'), '42');
      assert.equal(map.get('taw.keypower'), '7'); // Key Power SURVIVES rebirth
      assert.equal(getKeyPower(), 7);
    }
  );
  // a from-scratch rebirth (empty storage) still works and doesn't throw.
  withStorage({}, () => {
    assert.doesNotThrow(() => saveProgress({ xp: 0, lifetimeLetters: 0 }));
  });
});

test('a tap credits xp but NOT lifetimeLetters (rawKeys 0)', () => {
  const r = creditXp({ xp: 0, lifetimeLetters: 7 }, 10, 0); // a tap worth +10
  assert.equal(r.state.xp, 10); // +10 xp
  assert.equal(r.state.lifetimeLetters, 7); // unchanged — taps never bump lifetimeLetters
});

test('getTaps defaults to 0 and survives storage failure; saveTaps never throws', () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  try {
    assert.equal(getTaps(), 0);
    assert.doesNotThrow(() => saveTaps(5));
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
});

test('creditXp reports a level-up exactly when the boundary is crossed', () => {
  const a = creditXp({ xp: 110, lifetimeLetters: 0 }, 10, 1); // 110 -> 120 crosses L1->2 (need(1)=118)
  assert.equal(a.state.xp, 120);
  assert.equal(a.state.lifetimeLetters, 1); // raw keystroke count, unmultiplied
  assert.equal(a.leveledUp, true);
  const b = creditXp({ xp: 120, lifetimeLetters: 5 }, 10, 1); // 120 -> 130, still L2 (L2 ends at 257)
  assert.equal(b.leveledUp, false);
  assert.equal(b.state.lifetimeLetters, 6);
});

// ---- rate cap ----
test('60 keystrokes in one 1000ms window credit exactly 30 (the shipped cap)', () => {
  const rl = createRateLimiter({ capacity: 30, windowMs: 1000 });
  let credited = 0;
  for (let i = 0; i < 60; i++) if (rl.tryConsume(0)) credited++;
  assert.equal(credited, 30);
});

test('createRateLimiter defaults to the shipped cap of 30', () => {
  const rl = createRateLimiter();
  let credited = 0;
  for (let i = 0; i < 60; i++) if (rl.tryConsume(0)) credited++;
  assert.equal(credited, 30);
});

test('rate cap is rolling: the window slides forward', () => {
  const rl = createRateLimiter({ capacity: 8, windowMs: 1000 });
  for (let i = 0; i < 8; i++) assert.ok(rl.tryConsume(0)); // fill the window at t=0
  assert.equal(rl.tryConsume(500), false); // still full mid-window
  assert.equal(rl.tryConsume(1000), true); // t=0 stamp has aged out (1000-0 !< 1000)
});

// ---- creditable-key filter ----
test('e.repeat keystrokes credit 0 (are not creditable)', () => {
  assert.equal(isCreditableKey({ key: 'a', repeat: true }), false);
});

test('a keystroke while an input is focused credits 0', () => {
  assert.equal(isCreditableKey({ key: 'a', target: { tagName: 'INPUT' } }), false);
  assert.equal(isCreditableKey({ key: 'a', target: { tagName: 'TEXTAREA' } }), false);
  assert.equal(isCreditableKey({ key: 'a', target: { isContentEditable: true } }), false);
});

test('modifier chords and non-single-char keys are not creditable; plain a-z/0-9 are', () => {
  assert.equal(isCreditableKey({ key: 'a', ctrlKey: true }), false);
  assert.equal(isCreditableKey({ key: 'a', metaKey: true }), false);
  assert.equal(isCreditableKey({ key: 'a', altKey: true }), false);
  assert.equal(isCreditableKey({ key: 'Enter' }), false);
  assert.equal(isCreditableKey({ key: ' ' }), false);
  assert.equal(isCreditableKey({ key: '-' }), false);
  assert.equal(isCreditableKey({ key: 'a' }), true);
  assert.equal(isCreditableKey({ key: 'Z' }), true);
  assert.equal(isCreditableKey({ key: '7' }), true);
});

// ---- storage failure ----
test('localStorage failure does not throw and defaults to 0', () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() {
      throw new Error('storage blocked');
    },
    setItem() {
      throw new Error('storage blocked');
    },
  };
  try {
    const p = loadProgress();
    assert.deepEqual(p, { xp: 0, lifetimeLetters: 0 });
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
});
