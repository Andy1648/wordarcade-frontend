// input.test.js — the fixed-slot / alt-matching model. The divergent-alt paths
// are the heart of it: once you commit letters toward one word, the others must
// become unreachable, and a rejected key must never advance the cursor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlotInput } from './input.js';

// Type a whole string, returning the per-key results.
function typeAll(input, str) {
  return [...str].map((ch) => input.typeLetter(ch));
}

test('typing the target to the end is a full-credit clear', () => {
  const input = createSlotInput({ target: 'placid', alts: ['smooth'] });
  const results = typeAll(input, 'placid');
  assert.ok(results.slice(0, -1).every((r) => r.accepted && !r.complete));
  const last = results[results.length - 1];
  assert.equal(last.accepted, true);
  assert.equal(last.complete, true);
  assert.equal(last.viaAlt, false);
  assert.equal(last.actualWord, 'placid');
});

test('typing a valid same-length alt is a half-credit clear that names the target', () => {
  const input = createSlotInput({ target: 'placid', alts: ['smooth'] });
  const last = typeAll(input, 'smooth').at(-1);
  assert.equal(last.complete, true);
  assert.equal(last.viaAlt, true);
  assert.equal(last.actualWord, 'placid'); // "accepted — the word was PLACID"
});

test('a rejected key does not enter the field or advance the cursor', () => {
  const input = createSlotInput({ target: 'placid', alts: ['smooth'] });
  input.typeLetter('p'); // now committed to placid
  const before = input.getState().typed;
  const r = input.typeLetter('z'); // no reachable word has z at index 1
  assert.equal(r.accepted, false);
  assert.equal(r.reason, 'reject');
  assert.equal(input.getState().typed, before); // unchanged — cursor didn't move
});

test('DIVERGENCE: target placid, alt smooth — after "p", smooth is unreachable', () => {
  const input = createSlotInput({ target: 'placid', alts: ['smooth'] });
  // Before any input, both first letters are acceptable.
  assert.equal(input.typeLetter('p').accepted, true);
  // 'p' pruned smooth (it starts with 's'); now only placid is live.
  assert.deepEqual(input.liveCandidates(), ['placid']);
  const r = input.typeLetter('s'); // 's' would be smooth[1]? no — placid[1] is 'l'
  assert.equal(r.accepted, false);
  assert.equal(input.getState().candidateCount, 1);
});

test('DIVERGENCE the other way: committing to the alt makes the target unreachable', () => {
  const input = createSlotInput({ target: 'placid', alts: ['smooth'] });
  assert.equal(input.typeLetter('s').accepted, true); // toward smooth
  assert.deepEqual(input.liveCandidates(), ['smooth']);
  assert.equal(input.typeLetter('l').accepted, false); // placid path is gone
});

test('the player is never stranded: every accepted prefix leaves ≥1 completable word', () => {
  // Two alts that diverge at different points.
  const input = createSlotInput({ target: 'stone', alts: ['stern', 'shone'] });
  // 's' keeps all three; 't' drops shone; 'o' drops stern; finishing reaches stone.
  for (const ch of 'stone') {
    const r = input.typeLetter(ch);
    assert.equal(r.accepted, true);
    assert.ok(input.getState().candidateCount >= 1); // always something to finish
  }
  assert.equal(input.isComplete(), true);
  assert.equal(input.getState().viaAlt, false);
});

test('an alt equal in length only up to a point still resolves correctly', () => {
  // 'stern' shares "st" with the target then diverges.
  const input = createSlotInput({ target: 'stone', alts: ['stern', 'shone'] });
  typeAll(input, 'st'); // shone dropped at 't'
  assert.deepEqual(input.liveCandidates().sort(), ['stern', 'stone']);
  const last = typeAll(input, 'ern').at(-1); // commit to the alt
  assert.equal(last.viaAlt, true);
  assert.equal(last.actualWord, 'stone');
});

test('matching is case-insensitive', () => {
  const input = createSlotInput({ target: 'placid' });
  const last = typeAll(input, 'PLACID').at(-1);
  assert.equal(last.complete, true);
  assert.equal(last.viaAlt, false);
});

test('wrong-length or headword-equal alts are dropped as unreachable', () => {
  // 'hungry' (6) is the wrong length for 'voracious' (9) and can never be typed.
  const input = createSlotInput({ target: 'voracious', alts: ['ravenous', 'hungry'] });
  assert.deepEqual(input.liveCandidates(), ['voracious']); // ravenous is 8, hungry 6
  // Only same-length alts survive; here neither alt matches length 9.
  assert.equal(input.getState().candidateCount, 1);
});

test('a same-length alt is honoured when the lengths actually match', () => {
  const input = createSlotInput({ target: 'candid', alts: ['honest'] }); // both 6
  const last = typeAll(input, 'honest').at(-1);
  assert.equal(last.viaAlt, true);
  assert.equal(last.actualWord, 'candid');
});

// --- reveals ---------------------------------------------------------------

test('revealing the first letter locks slot 0 and prunes divergent alts', () => {
  const input = createSlotInput({ target: 'placid', alts: ['smooth'] });
  const r = input.revealNextLetter();
  assert.equal(r.revealedLetter, 'p');
  assert.equal(input.getState().typed, 'p');
  assert.equal(input.getState().revealed, 1);
  assert.deepEqual(input.liveCandidates(), ['placid']); // smooth pruned by the reveal
  assert.equal(input.getSlots()[0].state, 'revealed');
});

test('a reveal on a diverged alt path snaps back onto the target', () => {
  const input = createSlotInput({ target: 'placid', alts: ['smooth'] });
  input.typeLetter('s'); // committed toward the alt
  assert.deepEqual(input.liveCandidates(), ['smooth']);
  input.revealNextLetter(); // reveals target[0] = 'p'
  assert.equal(input.getState().typed, 'p'); // divergent 's' discarded
  assert.deepEqual(input.liveCandidates(), ['placid']);
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

test('revealing every letter completes the word as the target (full credit path)', () => {
  const input = createSlotInput({ target: 'abrupt', alts: ['sudden'] });
  for (let i = 0; i < 6; i++) input.revealNextLetter();
  assert.equal(input.isComplete(), true);
  assert.equal(input.getState().viaAlt, false);
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
