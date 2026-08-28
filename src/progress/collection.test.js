// collection.test.js (Job 3) — distinct-word recording, tier/mode/date capture, milestone payouts
// (× rebirth), the 5,000 LRU cap, the byte MEASURE at cap, and never-throw storage fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordAcceptedWord,
  collectionSummary,
  countOf,
  loadCollection,
  COLLECTION_CAP,
  COLLECTION_MILESTONES,
  COLLECTION_KEY,
} from './collection.js';
import { getWins } from './wins.js';

function withStorage(seed, fn) {
  const saved = globalThis.localStorage;
  const map = new Map(Object.entries(seed || {}));
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

test('records distinct words with tier/mode/date; duplicates only refresh recency', () => {
  withStorage({}, () => {
    const a = recordAcceptedWord('placid', { mode: 'sat-rush', band: 'RARE' });
    assert.equal(a.isNew, true);
    assert.equal(a.count, 1);
    // Same word again → not new, count unchanged.
    const b = recordAcceptedWord('PLACID', { mode: 'chain', band: 'RARE' }); // normalises case
    assert.equal(b.isNew, false);
    assert.equal(b.count, 1);
    const c = recordAcceptedWord('cat', { mode: 'word-bomb', band: 'COMMON' });
    assert.equal(c.count, 2);
    const sum = collectionSummary();
    assert.equal(sum.total, 2);
    assert.equal(sum.byTier.RARE, 1);
    assert.equal(sum.byTier.COMMON, 1);
    // Rarest finds show the actual word, its tier, and the FIRST mode (sat-rush, not the dup's chain).
    assert.equal(sum.rarest.length, 1);
    assert.equal(sum.rarest[0].word, 'placid');
    assert.equal(sum.rarest[0].mode, 'sat-rush');
  });
});

test('empty / blank words are never recorded', () => {
  withStorage({}, () => {
    recordAcceptedWord('', { mode: 'chain', band: 'COMMON' });
    recordAcceptedWord('   ', { mode: 'chain', band: 'COMMON' });
    assert.equal(countOf(), 0);
  });
});

test('milestones pay wins (× rebirth) once each as the count crosses them', () => {
  withStorage({ 'taw.rebirths': '0' }, () => {
    const before = getWins();
    let last;
    for (let i = 0; i < 100; i++) last = recordAcceptedWord(`word${i}`, { mode: 'fuse', band: 'COMMON' });
    // The 100th distinct word crosses the 100 milestone → +5000 wins (rebirth ×1).
    assert.deepEqual(last.milestone, { n: 100, wins: 5000 });
    assert.equal(getWins() - before, 5000);
    // Crossing again does not re-pay (already claimed).
    const again = recordAcceptedWord('word50', { mode: 'fuse', band: 'COMMON' }); // dup
    assert.equal(again.milestone, null);
  });
});

test('milestone wins scale with the live rebirth multiplier', () => {
  withStorage({ 'taw.rebirths': '2' }, () => {
    // R2 → rebirth mult ×2, so the 100-word milestone pays 10000 not 5000.
    let last;
    for (let i = 0; i < 100; i++) last = recordAcceptedWord(`w${i}`, { mode: 'chain', band: 'COMMON' });
    assert.equal(last.milestone.n, 100);
    assert.equal(last.milestone.wins, 5000 * 2);
  });
});

// Build a valid store JSON with N entries (recency = insertion order 1..N) so we can test the cap
// invariants without an O(n²) insert loop.
function seedStore(n, { allClaimed = true } = {}) {
  const w = {};
  for (let i = 0; i < n; i++) w[`w${i}`] = [i % 4, i % 5, 20000, i + 1]; // [band, mode, day, recency]
  return JSON.stringify({ v: 1, seq: n, w, ms: allClaimed ? COLLECTION_MILESTONES.map((m) => m.n) : [] });
}

test('LRU cap: at 5,000 the least-recently-SEEN word is evicted, never exceeding the cap', () => {
  withStorage({ [COLLECTION_KEY]: seedStore(COLLECTION_CAP) }, () => {
    assert.equal(countOf(), COLLECTION_CAP);
    // w0 has recency 1 (oldest). Touch w5 so it is refreshed, then add a new word → w0 evicts.
    recordAcceptedWord('w5', { mode: 'word-bomb', band: 'COMMON' }); // dup → refresh recency
    recordAcceptedWord('brandnew', { mode: 'word-bomb', band: 'COMMON' });
    assert.equal(countOf(), COLLECTION_CAP); // still capped, never exceeds
    const w = loadCollection().w;
    assert.ok(w['brandnew'], 'new word present');
    assert.ok(w['w5'], 'freshly-touched w5 survives');
    assert.ok(!w['w0'], 'the least-recently-seen word (w0) was evicted');
  });
});

test('MEASURE: localStorage bytes for a FULL 5,000-word collection', () => {
  // Build the store directly (realistic ~9-char keys) and measure the serialized footprint at cap.
  const w = {};
  for (let i = 0; i < COLLECTION_CAP; i++) w[`word${i.toString(36)}zz`] = [i % 4, i % 5, 20000, i + 1];
  const raw = JSON.stringify({ v: 1, seq: COLLECTION_CAP, w, ms: [100, 500, 1000, 2500, 5000] });
  const bytes = Buffer.byteLength(raw, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`[collection] full 5,000-word store: ${bytes} bytes (${(bytes / 1024).toFixed(1)} KB)`);
  assert.ok(bytes < 400 * 1024, `collection should stay well under 400KB, was ${bytes}`);
});

test('storage failure → never throws; session stays consistent in-memory but nothing persists', () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => {} };
  try {
    let res;
    assert.doesNotThrow(() => { res = recordAcceptedWord('x', { mode: 'chain', band: 'RARE' }); });
    // The write can't persist (setItem throws) but the session-cache keeps it consistent — the call
    // returns a well-formed result and the summary never throws.
    assert.equal(res.isNew, true);
    assert.doesNotThrow(() => collectionSummary());
    assert.ok(Number.isFinite(collectionSummary().total));
  } finally {
    globalThis.localStorage = saved;
  }
});
