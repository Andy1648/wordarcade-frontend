// reveal.test.js — the first-run PROGRESSIVE REVEAL gate (reveal.js): the unlock order, the single teaser, the
// grandfathering of existing saves, monotonic reveals across a rebirth, and season 1 never gated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revealFor, liveReveal, readReveal, isVeteran, hasAnyProgress, REVEAL_KEY, CORE_LV, GEARS_LV, REBIRTH_NEAR } from './reveal.js';

function mem(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}
const FRESH = { level: 1, peak: 0, rebirths: 0, stars: 0, playedGame: false, canRoll: false, ownsGear: false, rebirthGate: 15 };

test('a brand-new save is the TITLE: nothing but play', () => {
  const r = revealFor(FRESH);
  assert.equal(r.title, true);
  assert.deepEqual([r.core, r.gears, r.rebirth, r.gear2], [false, false, false, false]);
  assert.equal(r.teaser, null, 'no padlock teaser on the title — one path only');
});

test('the core menu opens after the first game, or at LV3 by typing alone', () => {
  assert.equal(revealFor({ ...FRESH, playedGame: true }).core, true);
  assert.equal(revealFor({ ...FRESH, level: CORE_LV - 1 }).core, false);
  assert.equal(revealFor({ ...FRESH, level: CORE_LV }).core, true);
  const r = revealFor({ ...FRESH, playedGame: true });
  assert.equal(r.title, false);
  assert.equal(r.gears, false);
  assert.equal(r.teaser, 'gears', 'the NEXT step shows padlocked — and only that one');
});

test('gears open once a roll is affordable, a gear is owned, or LV6 — never before the core', () => {
  assert.equal(revealFor({ ...FRESH, canRoll: true }).gears, false, 'gems on a title screen still wait for the core');
  assert.equal(revealFor({ ...FRESH, playedGame: true, canRoll: true }).gears, true);
  assert.equal(revealFor({ ...FRESH, level: GEARS_LV }).gears, true);
  assert.equal(revealFor({ ...FRESH, level: GEARS_LV - 1 }).gears, false);
  const r = revealFor({ ...FRESH, level: GEARS_LV });
  assert.equal(r.rebirth, false);
  assert.equal(r.teaser, 'rebirth');
});

test('rebirth shows only when near its gate (or after any rebirth); the 2nd gear after the first rebirth', () => {
  const near = 15 - REBIRTH_NEAR;
  assert.equal(revealFor({ ...FRESH, level: near - 1 }).rebirth, false);
  assert.equal(revealFor({ ...FRESH, level: near }).rebirth, true);
  assert.equal(revealFor({ ...FRESH, level: near }).teaser, null);
  assert.equal(revealFor({ ...FRESH, level: near }).gear2, false);
  const r1 = revealFor({ ...FRESH, rebirths: 1 });
  assert.equal(r1.all, true, 'a rebirth is a veteran');
  assert.equal(r1.gear2, true);
});

test('the order is a ladder: each step implies the one before it', () => {
  for (let level = 1; level <= 30; level += 1) {
    for (const playedGame of [false, true]) {
      for (const canRoll of [false, true]) {
        const r = revealFor({ ...FRESH, level, playedGame, canRoll });
        if (r.gears) assert.ok(r.core, `gears without core at LV${level}`);
        if (r.rebirth && !r.all) assert.ok(r.gears, `rebirth without gears at LV${level}`);
      }
    }
  }
});

test('veterans see everything', () => {
  for (const s of [{ rebirths: 2 }, { stars: 1 }, { peak: 10 }, { ownsGear: true }]) {
    assert.equal(isVeteran({ ...FRESH, ...s }), true);
    assert.equal(revealFor({ ...FRESH, ...s }).all, true);
  }
  assert.equal(revealFor(FRESH, 'all').all, true);
});

test('first run grandfathers ANY progress to ALL; a fresh save starts the ladder', () => {
  const vet = mem();
  assert.equal(liveReveal({ ...FRESH, level: 2 }, vet, true).all, true);
  assert.equal(vet.getItem(REVEAL_KEY), 'all');
  assert.equal(hasAnyProgress({ ...FRESH, wins: 40 }), true);
  assert.equal(hasAnyProgress({ ...FRESH, gems: 10 }), true);
  assert.equal(hasAnyProgress(FRESH), false);

  const s = mem();
  const r = liveReveal(FRESH, s, true);
  assert.equal(r.title, true);
  assert.deepEqual(readReveal(s), []);
  // after the first game, wins in hand: the core opens — NOT grandfathered (the key already exists)
  const r2 = liveReveal({ ...FRESH, playedGame: true, wins: 40 }, s, true);
  assert.equal(r2.all, false);
  assert.equal(r2.core, true);
  assert.deepEqual(readReveal(s), ['core']);
});

test('reveals are monotonic: a rebirth-style level reset never hides a step again', () => {
  const s = mem();
  liveReveal(FRESH, s, true);
  liveReveal({ ...FRESH, level: GEARS_LV }, s, true);
  assert.deepEqual(readReveal(s), ['core', 'gears']);
  const back = liveReveal({ ...FRESH, level: 1 }, s, true);
  assert.equal(back.core, true);
  assert.equal(back.gears, true);
  assert.equal(back.title, false);
});

test('season 1 and blocked storage are never gated', () => {
  assert.equal(liveReveal(FRESH, mem(), false).all, true);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(liveReveal(FRESH, blocked, true).all, true);
});
