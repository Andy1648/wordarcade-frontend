// menuSecrets.test.js — the five menu secrets fire once, on the right trigger.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSecretDetector, SECRETS } from './menuSecrets.js';

function memStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v), _map: map };
}
// A clock at a fixed non-11:11 time (2026-09-04 10:05 local) unless overridden.
function fixedNow(ms) { return () => ms; }
const T_NORMAL = new Date(2026, 8, 4, 10, 5, 0).getTime();
function typeWord(det, word, startMs = T_NORMAL) {
  let hit = null;
  for (const c of word) hit = det.onKey(c) || hit;
  return hit;
}

test('1. TYPED WORD "newgrounds" fires O.G. once, then never again', () => {
  const det = createSecretDetector({ now: fixedNow(T_NORMAL), storage: memStorage() });
  const hit = typeWord(det, 'newgrounds');
  assert.equal(hit && hit.id, 'newgrounds');
  assert.equal(hit.stamp, 'O.G.');
  assert.equal(typeWord(det, 'newgrounds'), null, 'one-time only');
});

test('typing an unrelated word does NOT fire the word secret', () => {
  const det = createSecretDetector({ now: fixedNow(T_NORMAL), storage: memStorage() });
  assert.equal(typeWord(det, 'oldgrounds'), null);
});

test('2. RARE POP fires MIDAS on the golden roll, only once', () => {
  const golden = createSecretDetector({ now: fixedNow(T_NORMAL), rng: () => 0, storage: memStorage() });
  const hit = golden.onPop();
  assert.equal(hit && hit.id, 'midas');
  assert.equal(golden.onPop(), null, 'one-time');
  // a non-golden roll never fires
  const cold = createSecretDetector({ now: fixedNow(T_NORMAL), rng: () => 0.9, storage: memStorage() });
  assert.equal(cold.onPop(), null);
});

test('3. TIME OF DAY fires WISH only at local 11:11 (am or pm)', () => {
  const at1111am = new Date(2026, 8, 4, 11, 11, 30).getTime();
  const det = createSecretDetector({ now: fixedNow(at1111am), storage: memStorage() });
  const hit = det.onKey('a');
  assert.equal(hit && hit.id, 'wish');
  // 11:12 does NOT fire
  const at1112 = new Date(2026, 8, 4, 11, 12, 0).getTime();
  const det2 = createSecretDetector({ now: fixedNow(at1112), storage: memStorage() });
  assert.equal(det2.onKey('a'), null);
  // 23:11 (11:11 pm) DOES fire
  const at2311 = new Date(2026, 8, 4, 23, 11, 0).getTime();
  const det3 = createSecretDetector({ now: fixedNow(at2311), storage: memStorage() });
  assert.equal(det3.onKey('a').id, 'wish');
});

test('4. TYPING STREAK fires TYPEWRITER at 150 unbroken keys; a long pause resets it', () => {
  let t = T_NORMAL;
  const det = createSecretDetector({ now: () => t, storage: memStorage() });
  let hit = null;
  for (let i = 0; i < 149; i++) { t += 200; hit = det.onKey('x') || hit; }
  assert.equal(hit, null, 'not yet at 149');
  t += 200; hit = det.onKey('x');
  assert.equal(hit && hit.id, 'typewriter', 'fires at 150');

  // a pause > 1500ms mid-way resets the streak (fresh detector)
  let u = T_NORMAL;
  const det2 = createSecretDetector({ now: () => u, storage: memStorage() });
  for (let i = 0; i < 100; i++) { u += 200; det2.onKey('x'); }
  u += 3000; det2.onKey('x'); // big pause → streak back to 1
  assert.ok(det2._streak() === 1, 'streak reset after a long gap');
});

test('5. PALINDROME (invented) fires BOTH WAYS on a real 5+ palindrome, not on "aaaaa"', () => {
  const det = createSecretDetector({ now: fixedNow(T_NORMAL), storage: memStorage() });
  assert.equal(typeWord(det, 'kayak').id, 'palindrome');
  const det2 = createSecretDetector({ now: fixedNow(T_NORMAL), storage: memStorage() });
  assert.equal(typeWord(det2, 'aaaaa'), null, 'a repeated letter is not a word');
  const det3 = createSecretDetector({ now: fixedNow(T_NORMAL), storage: memStorage() });
  assert.equal(typeWord(det3, 'level').id, 'palindrome');
});

test('found-set persists across detectors (a secret stays found)', () => {
  const st = memStorage();
  const a = createSecretDetector({ now: fixedNow(T_NORMAL), storage: st });
  typeWord(a, 'newgrounds');
  const b = createSecretDetector({ now: fixedNow(T_NORMAL), storage: st });
  assert.equal(b.found('newgrounds'), true);
  assert.equal(typeWord(b, 'newgrounds'), null, 'already found in a prior session');
});

test('all five secrets are defined with wins + a stamp', () => {
  for (const id of ['newgrounds', 'midas', 'wish', 'typewriter', 'palindrome']) {
    assert.ok(SECRETS[id].wins > 0, `${id} grants wins`);
    assert.ok(typeof SECRETS[id].stamp === 'string' && SECRETS[id].stamp.length, `${id} has a stamp`);
  }
});
