import test from 'node:test';
import assert from 'node:assert/strict';
import { TUTORIALS, dueTutorial, alreadyReached, initTutorials, hasSeenTutorial, markTutorialSeen, TUT_INIT_KEY } from './registry.js';

function withStorage(seed, fn) {
  const m = new Map(Object.entries(seed));
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try { return fn(m); } finally { globalThis.localStorage = prev; }
}
const fresh = { level: 1, rebirths: 0, wallTier: 0, marksRevealed: false, frenzyActive: false, boostActive: false, hasProfile: false, rebirthReady: false, chainLevel: 50, fuseLevel: 100 };

test('every unlock Andy listed has a 1–3 step tutorial (mark rolls arrive with M)', () => {
  const ids = TUTORIALS.map((t) => t.id);
  for (const id of ['marks', 'frenzy', 'boost', 'weekly', 'rebirth', 'chain', 'fuse', 'wall']) assert.ok(ids.includes(id), id);
  for (const t of TUTORIALS) {
    assert.ok(t.steps.length >= 1 && t.steps.length <= 3, `${t.id} has 1–3 steps`);
    for (const s of t.steps) assert.ok(s.title && s.line, `${t.id} step has a title + a line`);
  }
});

test('a fresh LV1 player is shown nothing; each unlock shows its own tutorial, once', () => {
  withStorage({}, () => {
    const seen = (id) => hasSeenTutorial(id);
    initTutorials(fresh);
    assert.equal(dueTutorial(fresh, seen), null);
    assert.equal(dueTutorial({ ...fresh, level: 50 }, seen).id, 'chain');
    markTutorialSeen('chain');
    assert.equal(dueTutorial({ ...fresh, level: 50 }, seen), null, 'shown once');
    assert.equal(dueTutorial({ ...fresh, level: 100, wallTier: 1 }, seen).id, 'fuse', 'one at a time, in order');
    markTutorialSeen('fuse');
    assert.equal(dueTutorial({ ...fresh, level: 100, wallTier: 1 }, seen).id, 'wall');
  });
});

test('an EXISTING player is not walked through features they already reached — only what is new to everyone', () => {
  const vet = { ...fresh, level: 300, rebirths: 9, wallTier: 3, marksRevealed: true, hasProfile: true, rebirthReady: true };
  withStorage({}, () => {
    const marked = initTutorials(vet);
    assert.deepEqual(marked.sort(), ['chain', 'fuse', 'marks', 'weekly'].sort());
    assert.equal(dueTutorial(vet, hasSeenTutorial).id, 'wall', 'the wall change is new to everyone');
    assert.equal(localStorage.getItem(TUT_INIT_KEY), '1');
    assert.deepEqual(initTutorials(vet), [], 'init runs once');
  });
  assert.ok(!alreadyReached(vet).includes('wall'));
});

test('mark rolls: ONE step pointing at ROLL, hosted by the MARKS panel (never the menu), new to everyone', () => {
  const t = TUTORIALS.find((x) => x.id === 'markRolls');
  assert.ok(t, 'markRolls tutorial exists');
  assert.equal(t.steps.length, 1, 'one step — the HOLD tag on the button says the rest');
  for (const s of t.steps) assert.match(s.target || '', /\.mr-roll/);
  assert.equal(t.host, 'marks');
  const vet = { ...fresh, level: 300, marksRevealed: true, hasProfile: true };
  withStorage({}, () => {
    initTutorials(vet);
    assert.notEqual((dueTutorial(vet, hasSeenTutorial) || {}).id, 'markRolls', 'the menu host never picks it');
    assert.equal(hasSeenTutorial('markRolls'), false, 'an existing player still sees it once in MARKS');
  });
});

test('blocked storage never nags', () => {
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  try {
    assert.equal(hasSeenTutorial('chain'), true);
    assert.equal(dueTutorial({ ...fresh, level: 60 }, hasSeenTutorial), null);
  } finally {
    globalThis.localStorage = prev;
  }
});
