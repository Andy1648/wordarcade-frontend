// markPerks.test.js — the LEGENDARY / MYTHIC / SECRET mark perks (MARKS via ROLLS), each at its hook.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasMarkPerk, letterPerkMult, winnerPerkMult, rollsPerRoll, frenzyEveryMode, rebirthKeyKeep, overdrivePerkMinutes,
  MARK_ROLLS_STORE_KEY,
} from './markPerks.js';
import { frenzyMult, FRENZY_KEY, FRENZY_MULT } from './frenzy.js';
import { overdriveEveryMin, OVERDRIVE_EVERY_MIN } from './overdrive.js';
import { winnerPayout } from './payout.js';
import { doRebirth, getKeyTier, KEYTIER_KEY } from './xp.js';
import './wins.js'; // installs the HEIRLOOM hook into xp.doRebirth

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
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
const own = (...ids) => ({ [MARK_ROLLS_STORE_KEY]: JSON.stringify({ v: 1, marks: Object.fromEntries(ids.map((id) => [id, { n: 1 }])) }) });

test('no roll state → every perk off; blocked storage never throws', () => {
  withStorage({}, () => {
    assert.equal(letterPerkMult(), 1);
    assert.equal(winnerPerkMult(), 1);
    assert.equal(rollsPerRoll(), 1);
    assert.equal(frenzyEveryMode(), false);
    assert.equal(rebirthKeyKeep(), 0);
    assert.equal(overdrivePerkMinutes(), null);
  });
  withStorage({ [MARK_ROLLS_STORE_KEY]: '{not json' }, () => assert.equal(hasMarkPerk('letters2'), false));
});

test('owning the mark turns its perk on (LEVIATHAN / ECLIPSE / SINGULARITY / KRAKEN / ORIGIN)', () => {
  withStorage(own('mk-leviathan'), () => assert.equal(letterPerkMult(), 2));
  withStorage(own('mk-eclipse'), () => assert.equal(winnerPerkMult(), 2));
  withStorage(own('mk-singularity'), () => assert.equal(rollsPerRoll(), 2));
  withStorage(own('mk-kraken'), () => assert.equal(overdrivePerkMinutes(), 15));
  withStorage(own('mk-origin'), () => {
    assert.equal(frenzyEveryMode(), true);
    assert.equal(rebirthKeyKeep(), 3);
  });
});

test('WILDFIRE: a running FRENZY pays in every mode only with ORIGIN', () => {
  const until = String(Date.now() + 60000);
  withStorage({ [FRENZY_KEY]: until }, () => {
    assert.equal(frenzyMult('fuse'), FRENZY_MULT);
    assert.equal(frenzyMult('wordBomb'), 1);
  });
  withStorage({ [FRENZY_KEY]: until, ...own('mk-origin') }, () => {
    assert.equal(frenzyMult('wordBomb'), FRENZY_MULT);
    assert.equal(frenzyMult('chain'), FRENZY_MULT);
  });
  withStorage(own('mk-origin'), () => assert.equal(frenzyMult('wordBomb'), 1, 'no FRENZY running → ×1'));
});

test('OVERCLOCK: OVERDRIVE every 15 min of play with KRAKEN', () => {
  withStorage({}, () => assert.deepEqual(overdriveEveryMin(), OVERDRIVE_EVERY_MIN));
  withStorage(own('mk-kraken'), () => assert.deepEqual(overdriveEveryMin(), [15, 15]));
});

test('CHAMPION: the winner bonus part ×2', () => {
  const base = { mode: 'wordBomb', iWon: true, gameTotal: 100, myWords: 10, rivals: [{ id: 'b', words: 10 }] };
  const a = winnerPayout({ ...base, perkMult: 1 });
  const b = winnerPayout({ ...base, perkMult: 2 });
  assert.equal(b.wins, a.wins * 2);
  assert.equal(b.mult - 1, (a.mult - 1) * 2);
  withStorage(own('mk-eclipse'), () => assert.equal(winnerPayout(base).wins, b.wins, 'read from the save when omitted'));
});

test('HEIRLOOM: a rebirth keeps up to 3 KEY tiers with ORIGIN; otherwise KEY resets to T0', () => {
  withStorage({ [KEYTIER_KEY]: '7' }, () => {
    doRebirth();
    assert.equal(getKeyTier(), 0);
  });
  withStorage({ [KEYTIER_KEY]: '7', ...own('mk-origin') }, () => {
    doRebirth();
    assert.equal(getKeyTier(), 3);
  });
  withStorage({ [KEYTIER_KEY]: '2', ...own('mk-origin') }, () => {
    doRebirth();
    assert.equal(getKeyTier(), 2, 'never raises a tier');
  });
});
