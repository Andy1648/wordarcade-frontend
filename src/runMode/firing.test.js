// firing.test.js — the modifier strip's "only the firing one flashes" rule, at the source.
// The strip is only honest if the id it lights is the mod that actually moved the payout,
// so this pins firingModifier() to scoreWord()'s own ordering and knobs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODIFIER_BY_ID, firingModifier, isRoundLevel, roundKnobs } from './engine.js';

const mods = (...ids) => ids.map((id) => MODIFIER_BY_ID[id]);
const word = (o = {}) => ({ rarity: 'COMMON', len: 6, vowels: 2, rare: false, lucky: false, combo: 1, ...o });

test('an empty stack fires nothing', () => {
  assert.equal(firingModifier(word(), []), null);
});

test('a stack of only round-level mods fires nothing per word', () => {
  const stack = mods('deep-pockets', 'momentum', 'glass-cannon');
  assert.equal(firingModifier(word(), stack), null);
  for (const m of stack) assert.equal(isRoundLevel(m), true);
});

test('the one word-level mod in the stack is the one that fires', () => {
  const stack = mods('deep-pockets', 'scrabble-bag');
  assert.equal(firingModifier(word({ rare: true }), stack), 'scrabble-bag');
});

test('a word-level mod that does not move the multiplier does not fire', () => {
  // SCRABBLE BAG only pays on J/Q/X/Z — an ordinary word leaves the mult untouched.
  assert.equal(firingModifier(word({ rare: false }), mods('scrabble-bag')), null);
});

test('when two mods both move it, the BIGGER swing is the one that flashes', () => {
  // LEXICOGRAPHER zeroes a COMMON word (a huge downward swing); VOWEL MOVEMENT only
  // adds +0.3 per vowel. From a zeroed multiplier the vowel bonus is the smaller delta.
  const stack = mods('lexicographer', 'vowel-movement');
  assert.equal(firingModifier(word({ rarity: 'COMMON', vowels: 2, combo: 3 }), stack), 'lexicographer');
});

test('a downside firing is still a firing — misses are shown, not hidden', () => {
  // DOUBLE VOWELS on a 1-vowel word is a x0.7 penalty, and it must light the chip.
  assert.equal(firingModifier(word({ vowels: 1 }), mods('double-vowels')), 'double-vowels');
});

test('it reads the same knobs scoreWord does (uncapped changes what fires)', () => {
  const stack = mods('uncapped', 'common-folk');
  const k = roundKnobs(stack);
  assert.equal(k.cap, Infinity);
  assert.equal(firingModifier(word({ rarity: 'COMMON', combo: 1.5 }), stack, k), 'common-folk');
});
