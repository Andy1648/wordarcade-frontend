// input.test.js — the fixed-slot model, TARGET ONLY. Only the target's own letters
// are ever accepted; a rejected key must never enter the field or advance the
// cursor, so `typed` is always a prefix of the target. (The old same-length "alt"
// synonym typing was removed — see the regression test at the bottom.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlotInput } from './input.js';

// Type a whole string, returning the per-key results.
function typeAll(input, str) {
  return [...str].map((ch) => input.typeLetter(ch));
}

test('typing the target to the end is a full-credit clear', () => {
  const input = createSlotInput({ target: 'placid' });
  const results = typeAll(input, 'placid');
  assert.ok(results.slice(0, -1).every((r) => r.accepted && !r.complete));
  const last = results[results.length - 1];
  assert.equal(last.accepted, true);
  assert.equal(last.complete, true);
  assert.equal(input.answer(), 'placid');
});

test('a wrong letter is rejected and does not enter the field or advance the cursor', () => {
  const input = createSlotInput({ target: 'placid' });
  input.typeLetter('p'); // typed = 'p'
  const before = input.getState().typed;
  const r = input.typeLetter('z'); // target[1] is 'l', not 'z'
  assert.equal(r.accepted, false);
  assert.equal(r.reason, 'reject');
  assert.equal(input.getState().typed, before); // unchanged — cursor didn't move
});

test('only the target advances the cursor, one letter at a time', () => {
  const input = createSlotInput({ target: 'stone' });
  // Any non-target next letter is rejected; the target letter is accepted.
  assert.equal(input.typeLetter('x').accepted, false);
  assert.equal(input.getState().typed, '');
  for (const ch of 'stone') assert.equal(input.typeLetter(ch).accepted, true);
  assert.equal(input.isComplete(), true);
});

test('typing past a completed word is rejected with reason "complete"', () => {
  const input = createSlotInput({ target: 'placid' });
  typeAll(input, 'placid');
  const r = input.typeLetter('x');
  assert.equal(r.accepted, false);
  assert.equal(r.reason, 'complete');
});

test('a non-letter key is rejected as "invalid" without advancing', () => {
  const input = createSlotInput({ target: 'placid' });
  const r = input.typeLetter('4');
  assert.equal(r.accepted, false);
  assert.equal(r.reason, 'invalid');
  assert.equal(input.getState().typed, '');
});

test('matching is case-insensitive', () => {
  const input = createSlotInput({ target: 'placid' });
  const last = typeAll(input, 'PLACID').at(-1);
  assert.equal(last.complete, true);
});

// --- reveals ---------------------------------------------------------------

test('revealing the first letter locks slot 0', () => {
  const input = createSlotInput({ target: 'placid' });
  const r = input.revealNextLetter();
  assert.equal(r.revealedLetter, 'p');
  assert.equal(input.getState().typed, 'p');
  assert.equal(input.getState().revealed, 1);
  assert.equal(input.getSlots()[0].state, 'revealed');
});

test('a reveal preserves target-consistent typing instead of discarding it', () => {
  const input = createSlotInput({ target: 'placid' });
  typeAll(input, 'pl'); // correct so far
  input.revealNextLetter(); // locks 'p'; keeps the 'l' the player typed
  assert.equal(input.getState().typed, 'pl');
  assert.equal(input.getState().revealed, 1);
});

test('revealed letters cannot be backspaced, but typed ones can', () => {
  const input = createSlotInput({ target: 'placid' });
  input.revealNextLetter(); // lock 'p'
  typeAll(input, 'la'); // typed = 'pla'
  input.backspace();
  assert.equal(input.getState().typed, 'pl');
  input.backspace(); // now typed = 'p' (revealed) — further backspace is a no-op
  input.backspace();
  assert.equal(input.getState().typed, 'p');
  assert.equal(input.getState().revealed, 1);
});

test('revealing every letter completes the word as the target', () => {
  const input = createSlotInput({ target: 'abrupt' });
  for (let i = 0; i < 6; i++) input.revealNextLetter();
  assert.equal(input.isComplete(), true);
  assert.equal(input.answer(), 'abrupt');
});

test('getSlots reports the right count and per-slot state', () => {
  const input = createSlotInput({ target: 'placid' });
  input.revealNextLetter(); // slot 0 revealed
  input.typeLetter('l'); // slot 1 typed
  const slots = input.getSlots();
  assert.equal(slots.length, 6);
  assert.equal(slots[0].state, 'revealed');
  assert.equal(slots[1].state, 'typed');
  assert.equal(slots[2].state, 'empty');
  assert.equal(slots[2].char, null);
});

// --- regression: no more synonym-alt typing --------------------------------

test('REGRESSION: a same-length synonym is NOT typeable — only the target is', () => {
  // The classic trap: SHREWD's synonym ASTUTE is the same length, so under the old
  // alt model typing 'a' "landed" and then SHREWD's own letters were rejected.
  // Now the alts arg is ignored entirely: 'a' is rejected, the field stays empty,
  // and the target's real first letter 's' is accepted.
  const input = createSlotInput({ target: 'shrewd', alts: ['astute'] });
  const a = input.typeLetter('a');
  assert.equal(a.accepted, false);
  assert.equal(a.reason, 'reject');
  assert.equal(input.getState().typed, ''); // nothing entered
  const s = input.typeLetter('s'); // the target's actual first letter
  assert.equal(s.accepted, true);
  assert.equal(input.getState().typed, 's');
});
