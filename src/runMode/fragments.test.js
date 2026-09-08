// fragments.test.js (fix/run-round-modes) — the FUSE fragment stream is seeded from the RUN.
// The old draw reseeded from p.words × a constant, so every run dealt the same fragment sequence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FRAGMENTS, FRAGMENT_SALT, makeFragmentStream, fragmentSequence } from './fragments.js';
import { makeLuckyOracle } from '../progress/luck.js';

test('different seeds → different fragment sequences; the same seed reproduces', () => {
  const a = fragmentSequence(1, 12);
  const b = fragmentSequence(2, 12);
  const c = fragmentSequence(1, 12);
  assert.deepEqual(a, c, 'same seed must reproduce');
  assert.notDeepEqual(a, b, 'different seeds must deal different sequences');
  // Across many seed pairs the sequences are (almost) never identical.
  let same = 0;
  for (let s = 10; s < 210; s++) if (fragmentSequence(s, 8).join() === fragmentSequence(s + 1, 8).join()) same++;
  assert.ok(same <= 2, `${same}/200 adjacent seeds dealt identical 8-fragment sequences`);
});

test('the stream is disjoint from the lucky oracle (salted) and only deals pool fragments', () => {
  assert.notEqual(FRAGMENT_SALT, 0);
  const seq = fragmentSequence(0xBEEF, 50);
  for (const f of seq) assert.ok(FRAGMENTS.includes(f), `${f} not in the pool`);
  // Consuming fragments must not disturb the lucky oracle for the same round seed.
  const o1 = makeLuckyOracle(0xBEEF); const before = Array.from({ length: 20 }, () => o1.next());
  const s = makeFragmentStream(0xBEEF); for (let i = 0; i < 20; i++) s.next();
  const o2 = makeLuckyOracle(0xBEEF); const after = Array.from({ length: 20 }, () => o2.next());
  assert.deepEqual(before, after);
});

test('every pool fragment is 2–3 lowercase letters with ≥ 200 containing words in the shipped recall list', () => {
  const path = fileURLToPath(new URL('../solo/words.recall.txt', import.meta.url));
  const words = readFileSync(path, 'utf8').trim().split(/\s+/);
  assert.ok(words.length > 10000);
  assert.equal(new Set(FRAGMENTS).size, FRAGMENTS.length, 'no duplicate fragments');
  for (const f of FRAGMENTS) {
    assert.match(f, /^[a-z]{2,3}$/, `bad fragment "${f}"`);
    const n = words.reduce((c, w) => c + (w.includes(f) ? 1 : 0), 0);
    assert.ok(n >= 200, `fragment "${f}" has only ${n} containing words`);
  }
});
