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
  XP_MULTIPLIERS,
} from './xp.js';

// ---- level cost curve ----
test('need() matches the pinned anchor values', () => {
  assert.equal(need(1), 10);
  assert.equal(need(5), 112);
  assert.equal(need(10), 316);
  assert.equal(need(20), 894);
});

test('XP_MULTIPLIERS are the sanctioned per-source values', () => {
  assert.equal(XP_MULTIPLIERS.menu, 1);
  assert.equal(XP_MULTIPLIERS['word-bomb'], 2);
  assert.equal(XP_MULTIPLIERS['category-blitz'], 2);
  assert.equal(XP_MULTIPLIERS['sat-rush'], 3);
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

test('levelFromXp: the "LV 7 / 142 TO LV 8" worked example', () => {
  // cumCost to reach L7 = need(1..6) = 10+28+52+80+112+147 = 429; +43 into L7.
  const r = levelFromXp(429 + 43);
  assert.equal(r.level, 7);
  assert.equal(r.cost, need(7)); // 185
  assert.equal(r.toNext, 142);
  assert.equal(r.intoLevel, 43);
});

test('creditXp reports a level-up exactly when the boundary is crossed', () => {
  const a = creditXp({ xp: 9, lifetimeLetters: 0 }, 1, 1); // 9 -> 10 crosses L1->2
  assert.equal(a.state.xp, 10);
  assert.equal(a.state.lifetimeLetters, 1);
  assert.equal(a.leveledUp, true);
  const b = creditXp({ xp: 10, lifetimeLetters: 5 }, 1, 1); // 10 -> 11, still L2
  assert.equal(b.leveledUp, false);
  assert.equal(b.state.lifetimeLetters, 6);
});

// ---- rate cap ----
test('40 keystrokes in one 1000ms window credit exactly 16 (the shipped cap)', () => {
  const rl = createRateLimiter({ capacity: 16, windowMs: 1000 });
  let credited = 0;
  for (let i = 0; i < 40; i++) if (rl.tryConsume(0)) credited++;
  assert.equal(credited, 16);
});

test('createRateLimiter defaults to the shipped cap of 16', () => {
  const rl = createRateLimiter();
  let credited = 0;
  for (let i = 0; i < 40; i++) if (rl.tryConsume(0)) credited++;
  assert.equal(credited, 16);
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
