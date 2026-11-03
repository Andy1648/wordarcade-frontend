import test from 'node:test';
import assert from 'node:assert/strict';
import { gapTo } from './gap.js';

test('names the level gap when stars and rebirths tie', () => {
  assert.deepEqual(gapTo({ stars: 0, rebirths: 3, level: 12 }, { stars: 0, rebirths: 3, level: 50 }), { text: '+38 LV', fill: 12 / 50 });
});
test('a rebirth ahead outranks any level gap', () => {
  assert.equal(gapTo({ rebirths: 2, level: 90 }, { rebirths: 3, level: 1 }).text, '+1 R');
});
test('stars decide first', () => {
  assert.equal(gapTo({ stars: 1, rebirths: 9 }, { stars: 2, rebirths: 0 }).text, '+1 ★');
});
test('a full tie needs one more level', () => {
  assert.equal(gapTo({ rebirths: 1, level: 5 }, { rebirths: 1, level: 5 }).text, '+1 LV');
});
test('says nothing when the order disagrees or a row is missing', () => {
  assert.equal(gapTo({ rebirths: 4 }, { rebirths: 3 }), null);
  assert.equal(gapTo(null, { level: 1 }), null);
});
test('THIS WEEK reads the gains columns, the old weekly view words', () => {
  assert.equal(gapTo({ week_rebirths: 0, week_levels: 3 }, { week_rebirths: 0, week_levels: 10 }, 'week', true).text, '+7 LV');
  assert.equal(gapTo({ week_words: 100 }, { week_words: 1340 }, 'week', false).text, '+1,240 WORDS');
});
