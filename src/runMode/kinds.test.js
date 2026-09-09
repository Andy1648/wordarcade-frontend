// kinds.test.js — RUN MODE (feat/draft-badges). Every modifier carries a `kind` from the four
// (gamble / slow / tax / steady), the grouping is exactly the sanctioned one, and the kind table
// is label-only: scoring numbers are untouched (the deck-1 audit + run-balance pins cover that).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODIFIERS, MODIFIER_KINDS, KIND_IDS } from './engine.js';

const EXPECTED = {
  gamble: ['lucky-charm', 'jackpot', 'uncapped', 'glass-cannon'],
  slow: ['snowball', 'momentum', 'hot-streak', 'combo-king'],
  tax: ['double-vowels', 'lexicographer', 'long-haul', 'common-folk', 'vowel-movement', 'rare-breed', 'scrabble-bag'],
  steady: ['deep-pockets', 'short-fuse', 'bookworm'],
};

test('the four kinds exist with their labels', () => {
  assert.deepEqual(KIND_IDS, ['gamble', 'slow', 'tax', 'steady']);
  assert.deepEqual(Object.fromEntries(KIND_IDS.map((k) => [k, MODIFIER_KINDS[k].label])), {
    gamble: 'GAMBLE', slow: 'SLOW BURN', tax: 'WORD TAX', steady: 'STEADY',
  });
});

test('every MODIFIER has a kind from the four', () => {
  assert.equal(MODIFIERS.length, 18);
  for (const m of MODIFIERS) {
    assert.ok(KIND_IDS.includes(m.kind), `${m.id} has kind "${m.kind}" — not one of ${KIND_IDS.join('/')}`);
  }
});

test('the grouping is exactly the sanctioned one (every id in one kind, none missing)', () => {
  const byKind = {};
  for (const m of MODIFIERS) (byKind[m.kind] ||= []).push(m.id);
  for (const k of KIND_IDS) assert.deepEqual([...byKind[k]].sort(), [...EXPECTED[k]].sort(), `kind ${k}`);
  const all = Object.values(EXPECTED).flat();
  assert.equal(new Set(all).size, 18);
  assert.deepEqual(all.sort(), MODIFIERS.map((m) => m.id).sort());
});
