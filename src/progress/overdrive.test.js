// node --test — OVERDRIVE (PROGRESSION FINAL "Rebirth Rush"): ×5 (Andy oct11; was ×10) on XP and wins for 5 minutes. Since oct20
// it never starts at random: only the OVERCLOCK gear's play clock (15 min), FREE OVERDRIVE gear, the shop, drops and codes. It is a BOOST source: boostMult = code boost × OVERDRIVE,
// and XP per letter = 10 × KEY × 5^R × MARK × BOOST.
import test from 'node:test';
import assert from 'node:assert/strict';
import { notePlay, overdriveMult, overdriveRemaining, OVERDRIVE_KEY } from './overdrive.js';
import { MARK_ROLLS_STORE_KEY, MARK_WORN_KEY } from './markPerks.js';
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

// a save that owns and WEARS a gear (markPerks reads the worn MAIN + the rolls store)
const wear = (id) => ({
  [MARK_ROLLS_STORE_KEY]: JSON.stringify({ v: 1, marks: { [id]: { n: 1 } } }),
  [MARK_WORN_KEY]: id,
});

test('NO RANDOM OVERDRIVE (Andy oct20): without OVERCLOCK, play never starts one — however long', () => {
  for (const x of [0, 0.5, 1]) {
    withStorage({}, (map) => {
      assert.equal(playFor(180, () => x), null, `roll ${x}: 3 hours of play, no OVERDRIVE`);
      assert.equal(overdriveMult(T0 + 180 * MIN), 1);
      const st = JSON.parse(map.get(OVERDRIVE_KEY));
      assert.ok(st.playMs <= st.nextMs, 'the clock waits, capped at its trigger');
    });
  }
});

test('the OVERCLOCK gear (KRAKEN) still starts OVERDRIVE on its 15-minute play clock', () => {
  withStorage(wear('mk-kraken'), () => {
    const r = playFor(16, () => 0);
    assert.ok(r, 'an OVERDRIVE started');
    assert.ok(r.at <= 15, `by 15 min of play (at ${r.at})`);
    assert.equal(overdriveMult(r.now), 5);
  });
});

test('OVERCLOCK: the play-clock OVERDRIVE is ×5 for its full length, and play during it does not count', () => {
  withStorage({ ...wear('mk-kraken'), [OVERDRIVE_KEY]: JSON.stringify({ playMs: 15 * MIN - 5000, nextMs: 15 * MIN, until: 0, freeMs: 0 }) }, (map) => {
    assert.equal(notePlay(5000, T0, () => 0), true, 'reaches 15:00 → starts');
    assert.equal(overdriveMult(T0), 5);
    assert.ok(overdriveRemaining(T0) >= 5 * MIN, 'at least the 5 base minutes');
    assert.equal(JSON.parse(map.get(OVERDRIVE_KEY)).playMs, 0, 'the clock restarts');
    for (let i = 1; i <= 50; i++) notePlay(5000, T0 + i * 5000, () => 0);
    assert.equal(JSON.parse(map.get(OVERDRIVE_KEY)).playMs, 0, 'play inside the window does not count');
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

test('boostMult = code boost × OVERDRIVE (×3 × ×5 = ×15)', () => {
  withStorage({}, () => {
    const now = Date.now();
    assert.equal(boostMult(now), 1);
    startBoost(3, 10, now);
    assert.equal(codeBoostMult(now), 3);
    assert.equal(boostMult(now), 3);
    localStorage.setItem(OVERDRIVE_KEY, JSON.stringify({ playMs: 0, nextMs: 30 * MIN, until: now + 5 * MIN }));
    assert.equal(overdriveMult(now), 5);
    assert.equal(boostMult(now), 15);
    assert.equal(boostMult(now + 5 * MIN), 3, 'OVERDRIVE over, the code boost still runs');
    assert.equal(boostMult(now + 10 * MIN), 1);
  });
});

test('XP per letter = 10 × KEY × 5^R × MARK × BOOST (OVERDRIVE included)', () => {
  withStorage({ 'taw.keytier': '2', 'taw.rebirths': '1' }, () => {
    assert.equal(letterXpNow(), 250); // 10 × 5 × 5
    const until = Date.now() + 5 * MIN;
    localStorage.setItem(OVERDRIVE_KEY, JSON.stringify({ playMs: 0, nextMs: 30 * MIN, until }));
    assert.equal(letterXpNow(), 1250); // × OVERDRIVE 5
    startBoost(3, 10);
    assert.equal(letterXpNow(), 3750); // × code boost 3
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
    assert.equal(perWordWins(o), 50);
    assert.equal(perWordWins({ ...o, mode: 'satRush', rebirthCount: 2 }), 6250); // 10 × 5 × 25 × 5
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
