import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameTier, enteredTier, NAME_TIERS, SEAL_ART } from './nameTier.js';

test('ranks map to the hard-cutoff tiers', () => {
  const k = (r) => (nameTier(r) ? nameTier(r).key : null);
  assert.equal(k(1), 'crown');
  assert.equal(k(2), 'wing');
  assert.equal(k(3), 'wing');
  assert.equal(k(4), 'flame');
  assert.equal(k(10), 'flame');
  assert.equal(k(11), 'star');
  assert.equal(k(25), 'star');
  assert.equal(k(26), 'splat');
  assert.equal(k(50), 'splat');
  assert.equal(k(51), null);
  assert.equal(k(0), null);
  assert.equal(k(null), null);
  assert.equal(k('7'), 'flame');
});

test('every tier has painted art', () => {
  for (const t of NAME_TIERS) assert.match(SEAL_ART[t.key], /^\/lb\/seal-.+\.webp$/);
});

test('enteredTier: only a climb INTO a better tier is a ceremony', () => {
  assert.equal(enteredTier(12, 9).key, 'flame');
  assert.equal(enteredTier(60, 48).key, 'splat');
  assert.equal(enteredTier(60, 3).key, 'wing');
  assert.equal(enteredTier(2, 1).key, 'crown');
  assert.equal(enteredTier(9, 4), null); // same tier
  assert.equal(enteredTier(3, 2), null); // podium swap
  assert.equal(enteredTier(4, 9), null); // a drop
  assert.equal(enteredTier(null, 1), null); // no last look
  assert.equal(enteredTier(0, 5), null);
  assert.equal(enteredTier(70, 55), null); // still off the seals
});
