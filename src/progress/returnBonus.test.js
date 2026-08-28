// returnBonus.test.js (Job 6) — the >=6h gate, the 12h cap, once-per-calendar-day, the × rebirth
// scaling, and that a fresh visitor (no last-seen) never triggers it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  returnBonusWins,
  pendingReturnBonus,
  claimReturnBonus,
  MIN_AWAY_HOURS,
  CAP_HOURS,
  PER_HOUR_WINS,
  RETURN_CLAIM_KEY,
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

test('returnBonusWins: below 6h pays 0; scales 100/hr; caps at 12h; × rebirth', () => {
  withStorage({ 'taw.rebirths': '0' }, () => {
    assert.equal(returnBonusWins(5), 0); // under the gate
    assert.equal(returnBonusWins(6), 6 * PER_HOUR_WINS); // 600
    assert.equal(returnBonusWins(12), 12 * PER_HOUR_WINS); // 1200
    assert.equal(returnBonusWins(48), 12 * PER_HOUR_WINS); // capped at 12h → still 1200
  });
  withStorage({ 'taw.rebirths': '2' }, () => {
    assert.equal(returnBonusWins(12), 12 * PER_HOUR_WINS * 2); // R2 → ×2 = 2400
  });
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

test('a first-time visitor (no last-seen) never triggers a bonus', () => {
  const now = Date.now();
  withStorage({}, () => {
    assert.equal(pendingReturnBonus(0, now).eligible, false);
    assert.equal(claimReturnBonus(0, now), null);
    assert.equal(pendingReturnBonus(NaN, now).eligible, false);
  });
});

test('never rivals active play: max R0 grant (1200) is <25% of a typical session', () => {
  // A "typical" established session ≈ 60 words at a mixed ~100 wins/word (rarity/combo/mode) ≈ 6000
  // wins at R0. Both the bonus and session earnings scale ×rebirth, so the ratio is rebirth-stable.
  const maxGrantR0 = returnBonusWins(CAP_HOURS, 0); // 1200
  const typicalSession = 6000;
  assert.ok(maxGrantR0 / typicalSession < 0.25, `${maxGrantR0}/${typicalSession} must be <25%`);
});
