// node --test — OVERDRIVE (PROGRESSION FINAL "Rebirth Rush"): ×10 on XP and wins for 5 minutes, triggered by
// 30–60 minutes of PLAY (typing time, idle gaps capped). It is a BOOST source: boostMult = code boost × OVERDRIVE,
// and XP per letter = 10 × KEY × 5^R × MARK × BOOST.
import test from 'node:test';
import assert from 'node:assert/strict';
import { notePlay, overdriveMult, overdriveRemaining, isOverdriveActive, OVERDRIVE_KEY } from './overdrive.js';
import { boostMult, codeBoostMult, startBoost } from './boost.js';
import { letterXpNow, creditLetterXp, resetLetterXp } from './letterXp.js';
import { perWordWins } from './wins.js';

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
const MIN = 60000;
const T0 = 1_800_000_000_000;

// Type for `minutes` of play in 5 s flush gaps; returns the minute mark (to the gap) at which OVERDRIVE
// started, or null.
function playFor(minutes, rng, start = T0) {
  const steps = Math.round((minutes * MIN) / 5000);
  for (let i = 1; i <= steps; i++) {
    const now = start + i * 5000;
    if (notePlay(5000, now, rng)) return { at: (i * 5000) / MIN, now };
  }
  return null;
}

test('OVERDRIVE never triggers before 30 minutes of play (earliest roll)', () => {
  withStorage({}, () => {
    assert.equal(playFor(29.9, () => 0), null, '359 gaps = 29:55 of play');
    assert.equal(overdriveMult(T0 + 30 * MIN), 1);
    assert.equal(notePlay(4999, T0 + 30 * MIN, () => 0), false, 'one ms short of 30:00');
    assert.equal(notePlay(1, T0 + 30 * MIN + 1, () => 0), true, 'starts at exactly 30:00 of play');
    assert.equal(overdriveMult(T0 + 30 * MIN + 1), 10);
  });
});

test('OVERDRIVE always triggers by 60 minutes of play (latest roll), and in [30, 60] for any roll', () => {
  withStorage({}, () => {
    const r = playFor(61, () => 1);
    assert.ok(r, 'triggered');
    assert.equal(r.at, 60);
  });
  for (const x of [0, 0.01, 0.25, 0.5, 0.77, 0.999, 1]) {
    withStorage({}, () => {
      const r = playFor(61, () => x);
      assert.ok(r && r.at >= 30 && r.at <= 60, `roll ${x}: ${r && r.at}`);
    });
  }
  // the default (Math.random) roll lands in the same window
  for (let k = 0; k < 20; k++) {
    withStorage({}, () => {
      const r = playFor(61);
      assert.ok(r && r.at >= 30 && r.at <= 60, `random roll: ${r && r.at}`);
    });
  }
});

test('OVERDRIVE is ×10 for exactly 5 wall-clock minutes, then off', () => {
  withStorage({}, () => {
    const r = playFor(31, () => 0);
    assert.ok(r);
    assert.equal(isOverdriveActive(r.now), true);
    assert.equal(overdriveMult(r.now), 10);
    assert.equal(overdriveRemaining(r.now), 5 * MIN);
    assert.equal(overdriveMult(r.now + 5 * MIN - 1), 10);
    assert.equal(overdriveMult(r.now + 5 * MIN), 1);
    assert.equal(overdriveRemaining(r.now + 6 * MIN), 0);
  });
});

test('idle gaps are capped (5 s a gap): a long idle tab never counts as play', () => {
  withStorage({}, (map) => {
    assert.equal(notePlay(3 * 60 * MIN, T0, () => 0), false, 'a 3-hour gap is 5 s of play');
    assert.equal(JSON.parse(map.get(OVERDRIVE_KEY)).playMs, 5000);
    for (let i = 1; i <= 100; i++) assert.equal(notePlay(10 * MIN, T0 + i * 10 * MIN, () => 0), false);
    assert.equal(JSON.parse(map.get(OVERDRIVE_KEY)).playMs, 101 * 5000);
    // garbage counts nothing
    for (const bad of [0, -5, NaN, Infinity, undefined]) assert.equal(notePlay(bad, T0, () => 0), false);
    assert.equal(JSON.parse(map.get(OVERDRIVE_KEY)).playMs, 101 * 5000);
  });
});

test('play DURING an OVERDRIVE does not count toward the next; the clock restarts from zero', () => {
  withStorage({}, (map) => {
    const r = playFor(31, () => 0);
    assert.ok(r);
    assert.equal(JSON.parse(map.get(OVERDRIVE_KEY)).playMs, 0);
    for (let i = 1; i <= 50; i++) notePlay(5000, r.now + i * 5000, () => 0); // 4m10s inside the window
    assert.equal(JSON.parse(map.get(OVERDRIVE_KEY)).playMs, 0);
    // after it ends, the next one is again ≥ 30 min of play away
    const next = playFor(29.9, () => 0, r.now + 5 * MIN);
    assert.equal(next, null);
  });
});

test('storage blocked: no OVERDRIVE, never throws', () => {
  const saved = globalThis.localStorage;
  const boom = () => {
    throw new Error('blocked');
  };
  globalThis.localStorage = { getItem: boom, setItem: boom, removeItem: boom };
  try {
    assert.equal(overdriveMult(T0), 1);
    assert.doesNotThrow(() => notePlay(5000, T0));
    assert.equal(boostMult(T0), 1);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
});

test('boostMult = code boost × OVERDRIVE (×3 × ×10 = ×30)', () => {
  withStorage({}, () => {
    const now = Date.now();
    assert.equal(boostMult(now), 1);
    startBoost(3, 10, now);
    assert.equal(codeBoostMult(now), 3);
    assert.equal(boostMult(now), 3);
    localStorage.setItem(OVERDRIVE_KEY, JSON.stringify({ playMs: 0, nextMs: 30 * MIN, until: now + 5 * MIN }));
    assert.equal(overdriveMult(now), 10);
    assert.equal(boostMult(now), 30);
    assert.equal(boostMult(now + 5 * MIN), 3, 'OVERDRIVE over, the code boost still runs');
    assert.equal(boostMult(now + 10 * MIN), 1);
  });
});

test('XP per letter = 10 × KEY × 5^R × MARK × BOOST (OVERDRIVE included)', () => {
  withStorage({ 'taw.keytier': '2', 'taw.rebirths': '1' }, () => {
    assert.equal(letterXpNow(), 250); // 10 × 5 × 5
    const until = Date.now() + 5 * MIN;
    localStorage.setItem(OVERDRIVE_KEY, JSON.stringify({ playMs: 0, nextMs: 30 * MIN, until }));
    assert.equal(letterXpNow(), 2500); // × OVERDRIVE 10
    startBoost(3, 10);
    assert.equal(letterXpNow(), 7500); // × code boost 3
  });
  withStorage({ 'taw.keytier': '9', 'taw.rebirths': '2' }, () => {
    assert.equal(letterXpNow(), 250000); // 10 × 1000 × 25
  });
});

test('OVERDRIVE multiplies WINS too (it is in the BOOST row of the frozen formula)', () => {
  withStorage({}, () => {
    const o = { mode: 'wordBomb', rebirthCount: 0, keyTier: 0, wordLength: 5 };
    assert.equal(perWordWins(o), 10);
    localStorage.setItem(OVERDRIVE_KEY, JSON.stringify({ playMs: 0, nextMs: 30 * MIN, until: Date.now() + 5 * MIN }));
    assert.equal(perWordWins(o), 100);
    assert.equal(perWordWins({ ...o, mode: 'satRush', rebirthCount: 2 }), 12500); // 10 × 5 × 25 × 10
  });
});

test('creditLetterXp feeds OVERDRIVE’s play clock with the gap since the previous credit', () => {
  const realNow = Date.now;
  let t = T0;
  Date.now = () => t;
  try {
    withStorage({ 'taw.overdrive': JSON.stringify({ playMs: 0, nextMs: 30 * MIN, until: 0 }) }, (map) => {
      resetLetterXp();
      creditLetterXp(1, { mode: 'word-bomb' }); // the first credit only starts the clock
      assert.equal(JSON.parse(map.get(OVERDRIVE_KEY)).playMs, 0);
      t += 3000;
      creditLetterXp(1, { mode: 'word-bomb' });
      assert.equal(JSON.parse(map.get(OVERDRIVE_KEY)).playMs, 3000);
      t += 60 * MIN; // an hour idle counts as one capped gap
      creditLetterXp(1, { mode: 'word-bomb' });
      assert.equal(JSON.parse(map.get(OVERDRIVE_KEY)).playMs, 8000);
      resetLetterXp();
    });
  } finally {
    Date.now = realNow;
  }
});
