// returnBonus.test.js — the >=6h gate, the SCALING (no longer flat) grant curve + its hard ceiling,
// once-per-calendar-day, the × rebirth scaling, the absence label, and that a fresh visitor (no
// last-seen) never triggers it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  returnBonusWins,
  absenceLabel,
  pendingReturnBonus,
  claimReturnBonus,
  PER_HOUR_WINS,
  BASE_MAX,
  MAX_RETURN_WINS,
} from './returnBonus.js';
import { getWins } from './wins.js';

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

const HOUR = 3600000;
const DAY = 24 * HOUR;

test('returnBonusWins: below 6h pays 0; accrues 100/hr for the first 12h', () => {
  withStorage({ 'taw.rebirths': '0' }, () => {
    assert.equal(returnBonusWins(5), 0); // under the gate
    assert.equal(returnBonusWins(6), 6 * PER_HOUR_WINS); // 600
    assert.equal(returnBonusWins(12), BASE_MAX); // 1200 — the base once the ramp saturates
  });
});

test('returnBonusWins: SCALES beyond 12h (a longer absence pays more), bounded by the ceiling', () => {
  withStorage({ 'taw.rebirths': '0' }, () => {
    // Published curve at R0 (see returnBonus.js): each step pays strictly more than the last.
    assert.equal(returnBonusWins(6), 600);
    assert.equal(returnBonusWins(12), 1200);
    assert.equal(returnBonusWins(24), 1260); // 1 day
    assert.equal(returnBonusWins(72), 1360); // 3 days
    assert.equal(returnBonusWins(168), 1410); // 7 days
    assert.equal(returnBonusWins(336), 1440); // 14 days
    // Monotonic, and never exceeds the hard ceiling no matter how long you're gone.
    assert.ok(returnBonusWins(72) > returnBonusWins(24));
    assert.ok(returnBonusWins(336) > returnBonusWins(72));
    assert.equal(returnBonusWins(100000), MAX_RETURN_WINS); // 1480 ceiling
    assert.ok(returnBonusWins(9e9) <= MAX_RETURN_WINS);
  });
});

test('returnBonusWins: the grant scales × rebirth multiplier', () => {
  withStorage({ 'taw.rebirths': '2' }, () => {
    assert.equal(returnBonusWins(12), BASE_MAX * 2); // R2 → ×2 = 2400
  });
});

test('absenceLabel coarsens with the length of the absence', () => {
  assert.equal(absenceLabel(1), '1 HOUR');
  assert.equal(absenceLabel(8), '8 HOURS');
  assert.equal(absenceLabel(24), '1 DAY');
  assert.equal(absenceLabel(72), '3 DAYS');
  assert.equal(absenceLabel(14 * 24), '2 WEEKS');
  assert.equal(absenceLabel(21 * 24), '3 WEEKS');
  assert.equal(absenceLabel(70 * 24), '2 MONTHS');
  assert.equal(absenceLabel(0), '1 HOUR'); // never "0 HOURS"
});

test('pendingReturnBonus gates on >=6h away and not-yet-claimed-today', () => {
  const now = Date.UTC(2026, 7, 28, 12, 0, 0);
  withStorage({}, () => {
    // 3h away → not eligible.
    assert.equal(pendingReturnBonus(now - 3 * HOUR, now).eligible, false);
    // 8h away → eligible.
    const p = pendingReturnBonus(now - 8 * HOUR, now);
    assert.equal(p.eligible, true);
    assert.equal(p.wins, 8 * PER_HOUR_WINS);
  });
});

test('claimReturnBonus grants once, then is blocked the same calendar day', () => {
  const now = Date.UTC(2026, 7, 28, 12, 0, 0);
  withStorage({ 'taw.rebirths': '0' }, () => {
    const before = getWins();
    const first = claimReturnBonus(now - 10 * HOUR, now);
    assert.ok(first);
    assert.equal(first.wins, 10 * PER_HOUR_WINS); // 1000
    assert.equal(getWins() - before, 1000);
    // Same day, another eligible-looking return → blocked (already claimed today).
    const second = claimReturnBonus(now - 9 * HOUR, now + HOUR);
    assert.equal(second, null);
    // Next calendar day → allowed again.
    const nextDay = now + 26 * HOUR;
    const third = claimReturnBonus(nextDay - 7 * HOUR, nextDay);
    assert.ok(third);
    assert.equal(third.wins, 7 * PER_HOUR_WINS);
  });
});

test('claimReturnBonus reports the REAL (uncapped) hoursAway for the card copy', () => {
  const now = Date.UTC(2026, 7, 28, 12, 0, 0);
  withStorage({ 'taw.rebirths': '0' }, () => {
    const r = claimReturnBonus(now - 14 * DAY, now);
    assert.ok(r);
    assert.ok(Math.abs(r.hoursAway - 14 * 24) < 0.001); // real absence, not clamped to 12h
    assert.equal(absenceLabel(r.hoursAway), '2 WEEKS');
  });
});

test('a first-time visitor (no last-seen) never triggers a bonus', () => {
  const now = Date.now();
  withStorage({}, () => {
    assert.equal(pendingReturnBonus(0, now).eligible, false);
    assert.equal(claimReturnBonus(0, now), null);
    assert.equal(pendingReturnBonus(NaN, now).eligible, false);
  });
});

test('never rivals active play: the MAX grant (1480 at R0) is <25% of a typical session', () => {
  // A "typical" established session ≈ 60 words at a mixed ~100 wins/word (rarity/combo/mode) ≈ 6000
  // wins at R0. Both the bonus ceiling and session earnings scale ×rebirth, so the ratio is
  // rebirth-stable. The ceiling is the largest the grant can EVER be, at any absence length.
  const maxGrantR0 = returnBonusWins(9e9, 0); // saturates to MAX_RETURN_WINS = 1480
  const typicalSession = 6000;
  assert.equal(maxGrantR0, MAX_RETURN_WINS);
  assert.ok(maxGrantR0 / typicalSession < 0.25, `${maxGrantR0}/${typicalSession} must be <25%`);
});
