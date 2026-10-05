// markPerks.test.js — the LEGENDARY / MYTHIC / SECRET mark perks (MARKS via ROLLS), each at its hook.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasMarkPerk, letterPerkMult, winnerPerkMult, rollsPerRoll, frenzyEveryMode, rebirthKeyKeep, overdrivePerkMinutes,
  MARK_ROLLS_STORE_KEY, MARK_WORN_KEY,
} from './markPerks.js';
import { MARKS_EQUIPPED_KEY } from './marks.js';
import { frenzyMult, FRENZY_KEY, FRENZY_MULT } from './frenzy.js';
import { overdriveEveryMin, OVERDRIVE_EVERY_MIN } from './overdrive.js';
import { winnerPayout } from './payout.js';
import { doRebirth, getKeyTier, keyTierAfterRebirth, KEYTIER_KEY } from './xp.js';
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
// A perk needs its mark WORN as the MAIN (and owned): `wear(id)` = own it + wear it.
const wear = (id) => ({ ...own(id), [MARK_WORN_KEY]: id });

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

test('wearing the mark as MAIN turns its perk on (LEVIATHAN / ECLIPSE / SINGULARITY / KRAKEN / ORIGIN)', () => {
  assert.equal(MARK_WORN_KEY, MARKS_EQUIPPED_KEY, 'the leaf reads the same worn key marks.js writes');
  withStorage(wear('mk-leviathan'), () => assert.equal(letterPerkMult(), 2));
  withStorage(wear('mk-eclipse'), () => assert.equal(winnerPerkMult(), 2));
  withStorage(wear('mk-singularity'), () => assert.equal(rollsPerRoll(), 2));
  withStorage(wear('mk-kraken'), () => assert.equal(overdrivePerkMinutes(), 15));
  withStorage(wear('mk-origin'), () => {
    assert.equal(frenzyEveryMode(), true);
    assert.equal(rebirthKeyKeep(), 3);
  });
});

test('OWNED but not worn → perk off; worn but not owned → perk off; swapping the MAIN swaps the perk', () => {
  withStorage(own('mk-leviathan', 'mk-origin'), () => {
    assert.equal(letterPerkMult(), 1, 'owned in the collection is not enough');
    assert.equal(frenzyEveryMode(), false);
  });
  withStorage({ [MARK_WORN_KEY]: 'mk-origin' }, () => assert.equal(frenzyEveryMode(), false, 'a worn id the save does not own'));
  withStorage({ ...own('mk-leviathan', 'mk-origin'), [MARK_WORN_KEY]: 'mk-leviathan' }, (m) => {
    assert.equal(letterPerkMult(), 2);
    assert.equal(rebirthKeyKeep(), 0);
    m.set(MARK_WORN_KEY, 'mk-origin');
    assert.equal(letterPerkMult(), 1, 'LEVIATHAN off once it is no longer the MAIN');
    assert.equal(rebirthKeyKeep(), 3);
  });
});

test('WILDFIRE: a running FRENZY pays in every mode only with ORIGIN', () => {
  const until = String(Date.now() + 60000);
  withStorage({ [FRENZY_KEY]: until }, () => {
    assert.equal(frenzyMult('fuse'), FRENZY_MULT);
    assert.equal(frenzyMult('wordBomb'), 1);
  });
  withStorage({ [FRENZY_KEY]: until, ...wear('mk-origin') }, () => {
    assert.equal(frenzyMult('wordBomb'), FRENZY_MULT);
    assert.equal(frenzyMult('chain'), FRENZY_MULT);
  });
  withStorage(wear('mk-origin'), () => assert.equal(frenzyMult('wordBomb'), 1, 'no FRENZY running → ×1'));
});

test('OVERCLOCK: OVERDRIVE every 15 min of play with KRAKEN', () => {
  withStorage({}, () => assert.deepEqual(overdriveEveryMin(), OVERDRIVE_EVERY_MIN));
  withStorage(wear('mk-kraken'), () => assert.deepEqual(overdriveEveryMin(), [15, 15]));
});

test('CHAMPION: the winner bonus part ×2', () => {
  const base = { mode: 'wordBomb', iWon: true, gameTotal: 100, myWords: 10, rivals: [{ id: 'b', words: 10 }] };
  const a = winnerPayout({ ...base, perkMult: 1 });
  const b = winnerPayout({ ...base, perkMult: 2 });
  assert.equal(b.wins, a.wins * 2);
  assert.equal(b.mult - 1, (a.mult - 1) * 2);
  withStorage(wear('mk-eclipse'), () => assert.equal(winnerPayout(base).wins, b.wins, 'read from the save when omitted'));
});

test('KEY TIER is KEPT across rebirths (Andy oct5) — with or without ORIGIN; the screens quote the same tier', () => {
  for (const extra of [{}, wear('mk-origin')]) {
    withStorage({ [KEYTIER_KEY]: '7', ...extra }, () => {
      assert.equal(keyTierAfterRebirth(), 7);
      doRebirth();
      assert.equal(getKeyTier(), 7);
    });
  }
  withStorage({ [KEYTIER_KEY]: '2', ...own('mk-origin') }, () => assert.equal(keyTierAfterRebirth(), 2));
});
