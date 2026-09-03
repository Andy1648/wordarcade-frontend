// ghost.test.js — the self-ghost replay store (feat/ghost). Stubs a Map-backed global localStorage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGhostRecorder, loadGhost, ghostWordsAt, ghostWordAt, byteSizeOf, clearGhost, MAX_EVENTS,
} from './ghost.js';

function stubStorage() {
  const m = new Map();
  global.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
  };
  return m;
}

test('record → finish → load round-trips the accepted-word timeline', () => {
  stubStorage();
  const rec = createGhostRecorder();
  rec.record('cat', 1000);
  rec.record('tiger', 1600);
  rec.record('rhino', 2500);
  const r = rec.finish('chain', 3, 2600);
  assert.equal(r.saved, true);
  assert.equal(r.beat, true);
  assert.equal(r.prevScore, null);
  const g = loadGhost('chain');
  assert.equal(g.score, 3);
  assert.equal(g.words.length, 3);
  assert.deepEqual(g.words.map((w) => w.word), ['cat', 'tiger', 'rhino']);
  // timestamps are relative to the FIRST word (t0=1000), 100ms-quantised
  assert.deepEqual(g.words.map((w) => w.t), [0, 600, 1500]);
  assert.ok(g.byteSize > 0);
});

test('only a BETTER run overwrites the stored ghost', () => {
  stubStorage();
  createGhostRecorder(); // no-op
  // seed a ghost with score 5
  const a = createGhostRecorder();
  a.record('one', 0); a.record('two', 500);
  a.finish('chain', 5, 600);
  // a worse run (score 3) does NOT overwrite
  const b = createGhostRecorder();
  b.record('x', 0); b.record('y', 400);
  const rb = b.finish('chain', 3, 500);
  assert.equal(rb.saved, false);
  assert.equal(rb.beat, false);
  assert.equal(rb.prevScore, 5);
  assert.equal(loadGhost('chain').score, 5); // unchanged
  // a better run (score 8) DOES overwrite
  const c = createGhostRecorder();
  c.record('p', 0); c.record('q', 300); c.record('r', 700);
  const rc = c.finish('chain', 8, 800);
  assert.equal(rc.saved, true);
  assert.equal(loadGhost('chain').score, 8);
  assert.equal(loadGhost('chain').words.length, 3);
});

test('an empty run never saves a ghost', () => {
  stubStorage();
  const rec = createGhostRecorder();
  const r = rec.finish('fuse', 0, 100);
  assert.equal(r.saved, false);
  assert.equal(loadGhost('fuse'), null);
});

test('a replay is hard-capped at MAX_EVENTS words', () => {
  stubStorage();
  const rec = createGhostRecorder();
  for (let i = 0; i < MAX_EVENTS + 50; i += 1) rec.record(`w${i}`, i * 10);
  assert.equal(rec.count(), MAX_EVENTS);
  rec.finish('chain', 999, MAX_EVENTS * 10);
  assert.equal(loadGhost('chain').words.length, MAX_EVENTS);
});

test('ghostWordsAt / ghostWordAt report the ghost pace at a given elapsed time', () => {
  stubStorage();
  const rec = createGhostRecorder();
  rec.record('alpha', 0);   // t=0
  rec.record('bravo', 800);  // t=800
  rec.record('carly', 1900); // t=1900
  rec.finish('chain', 3, 2000);
  const g = loadGhost('chain');
  assert.equal(ghostWordsAt(g, 0), 1);      // alpha has landed at t=0
  assert.equal(ghostWordsAt(g, 799), 1);
  assert.equal(ghostWordsAt(g, 800), 2);    // bravo lands
  assert.equal(ghostWordsAt(g, 5000), 3);   // all done
  assert.equal(ghostWordAt(g, 1000), 'bravo');
  assert.equal(ghostWordAt(g, 1900), 'carly');
});

test('corrupt / missing storage reads back as null without throwing', () => {
  stubStorage();
  assert.equal(loadGhost('chain'), null);
  global.localStorage.setItem('taw.ghost.chain', '{bad json');
  assert.doesNotThrow(() => loadGhost('chain'));
  assert.equal(loadGhost('chain'), null);
  assert.equal(byteSizeOf('chain') > 0, true); // the raw bad string still has a size
  clearGhost('chain');
  assert.equal(byteSizeOf('chain'), 0);
});
