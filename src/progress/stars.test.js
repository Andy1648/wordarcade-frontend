import test from 'node:test';
import assert from 'node:assert/strict';
import { starsForRebirth, rebirthAdvice, starStep, buyPerk, starsState, addStars, rebirthWithStars, starPowerMult, headStartLevel, runAutomation, perkCost } from './stars.js';
import { rebirthThreshold, loadProgress } from './xp.js';
import { listClaims, layerOpen } from './claims.js';
import { perWordWins } from './wins.js';

function withStorage(seed, fn) {
  const m = new Map(Object.entries(seed));
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try { return fn(m); } finally { globalThis.localStorage = prev; }
}

test('a rebirth pays more stars the further past the gate', () => {
  const gate = rebirthThreshold(0);
  const step = starStep(0);
  assert.equal(starsForRebirth(gate - 1, 0), 0);
  assert.equal(starsForRebirth(gate, 0), 1);
  assert.equal(starsForRebirth(gate + step, 0), 2);
  assert.equal(starsForRebirth(gate + 3 * step + 1, 0), 4);
});

test('the panel warns BAD TIME when the next star is 1-2 levels away', () => {
  const gate = rebirthThreshold(4);
  const step = starStep(4);
  const near = rebirthAdvice(gate + step - 1, 4);
  assert.equal(near.nextIn, 1);
  assert.equal(near.badTime, true);
  const fresh = rebirthAdvice(gate, 4);
  assert.equal(fresh.nextIn, step);
  assert.equal(fresh.badTime, step <= 2);
});

test('rebirthWithStars banks the stars and queues the layer reveals at R1 and R3', () => {
  withStorage({ 'taw.xp': JSON.stringify({ lv: rebirthThreshold(0) + 2 * starStep(0), into: 0 }), 'taw.rebirths': '0' }, (m) => {
    const r = rebirthWithStars();
    assert.equal(r.rc, 1);
    assert.equal(r.stars, 3);
    assert.equal(starsState().balance, 3);
    assert.ok(layerOpen('stars'), 'E4: STAR PERKS opens at once (no inbox)');
    m.set('taw.rebirths', '2');
    m.set('taw.xp', JSON.stringify({ lv: rebirthThreshold(2), into: 0 }));
    rebirthWithStars();
    assert.ok(layerOpen('auto'), 'E4: AUTOMATION opens at once');
    assert.equal(listClaims().length, 0);
  });
});

test('STAR POWER is uncapped, rising 1 star a level, and really pays', () => {
  withStorage({ 'taw.rebirths': '1' }, () => {
    addStars(100);
    const base = perWordWins({ mode: 'wordBomb', rebirthCount: 1, keyTier: 0, streakMult: 1, masteryMult: 1 });
    for (let i = 0; i < 12; i++) assert.equal(buyPerk('power', 1).ok, true);
    assert.equal(starPowerMult(), 1 + 0.1 * 12);
    assert.equal(perkCost('power', 12), 13);
    const now = perWordWins({ mode: 'wordBomb', rebirthCount: 1, keyTier: 0, streakMult: 1, masteryMult: 1 });
    assert.ok(Math.abs(now - base * 2.2) < 0.11, `${now} vs ${base} × 2.2`);
  });
});

test('automation is locked before R3, then buys for you', () => {
  withStorage({}, () => {
    addStars(10);
    assert.equal(buyPerk('autoKey', 2).locked, true);
    assert.equal(buyPerk('autoKey', 3).ok, true);
    let n = 0;
    const r = runAutomation({ buyKey: () => ({ ok: n++ < 4 }), buyForge: () => ({ ok: false }) });
    assert.deepEqual(r, { keys: 4, forges: 0 });
  });
});

test('HEAD START lifts the new climb, never past half the next gate', () => {
  withStorage({ 'taw.xp': JSON.stringify({ lv: rebirthThreshold(1), into: 0 }), 'taw.rebirths': '1' }, () => {
    addStars(20);
    for (let i = 0; i < 6; i++) buyPerk('head', 1);
    assert.equal(headStartLevel(2), Math.min(31, Math.floor(rebirthThreshold(2) / 2)));
    rebirthWithStars();
    assert.equal(loadProgress().level, headStartLevel(2));
  });
});
