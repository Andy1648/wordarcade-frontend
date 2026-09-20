// teachExample.test.js — the worked example must be a REAL, VALID answer to the live prompt.
// The whole point of deriving it (instead of using the canned modeExamples entry) is that a
// first-timer can copy it and be accepted; a test that only checked "returns a string" would
// miss the one way this can fail.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exampleContaining, exampleStartingWith } from './teachExample.js';

const recall = readFileSync(new URL('../solo/words.recall.txt', import.meta.url), 'utf8').split(' ');

test('exampleContaining returns a real word that CONTAINS the fragment', () => {
  for (const frag of ['at', 'str', 'ain', 'er', 'ing']) {
    const w = exampleContaining(recall, frag);
    assert.ok(w, `no example found for "${frag}"`);
    assert.ok(w.toLowerCase().includes(frag), `${w} does not contain ${frag}`);
    assert.ok(w.length >= 3, `${w} is under the 3-letter floor`);
    assert.notEqual(w.toLowerCase(), frag, 'the example must not BE the fragment');
    assert.equal(w, w.toUpperCase(), 'examples are typeset uppercase');
  }
});

test('exampleStartingWith returns a real word that STARTS with the letter', () => {
  for (const c of 'abcdefghilmnoprstuw') {
    const w = exampleStartingWith(recall, c);
    assert.ok(w, `no example found for "${c}"`);
    assert.equal(w[0].toLowerCase(), c, `${w} does not start with ${c}`);
    assert.ok(w.length >= 3);
  }
});

test('it picks a COMMON word, not merely a valid one', () => {
  // recall is frequency-ordered, so the answer should sit near the front. A fragment as common
  // as "at" resolving to a rank-9000 word would mean the scan is not walking in order.
  const w = exampleContaining(recall, 'at');
  assert.ok(recall.indexOf(w.toLowerCase()) < 500, `${w} is too obscure to be a first example`);
});

test('isUsed skips words already played, so the example is never a dead suggestion', () => {
  const first = exampleContaining(recall, 'at');
  const second = exampleContaining(recall, 'at', (w) => w === first.toLowerCase());
  assert.ok(second && second !== first, 'a used word must be skipped');
  assert.ok(second.toLowerCase().includes('at'));
});

test('bad input yields null rather than an invented word', () => {
  assert.equal(exampleContaining(recall, ''), null);
  assert.equal(exampleContaining(null, 'at'), null);
  assert.equal(exampleStartingWith(recall, ''), null);
  // A fragment no real word contains must return null, not a wrong answer.
  assert.equal(exampleContaining(recall, 'qxzj'), null);
});
