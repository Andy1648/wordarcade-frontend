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
// Types the letters, then signals a typing PAUSE (onIdle) — the word boundary the
// palindrome secret is judged at. Returns the first hit seen, if any.
function typeWord(det, word) {
  let hit = null;
  for (const c of word) hit = det.onKey(c) || hit;
  hit = det.onIdle() || hit;
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

test('5b. PALINDROME is judged at the WORD BOUNDARY and carries the matched word as detail', () => {
  // The hit reports the word (uppercased) plus the running found / total.
  const det = createSecretDetector({ now: fixedNow(T_NORMAL), storage: memStorage() });
  const hit = typeWord(det, 'racecar');
  assert.equal(hit.id, 'palindrome');
  assert.equal(hit.detail, 'RACECAR');
  assert.equal(hit.found, 1);
  assert.equal(hit.total, Object.keys(SECRETS).length);

  // Mid-word it must NOT fire: "aceca" inside "racecar" is a palindrome run, but the
  // word isn't closed yet (no boundary key, no idle) — the old bug.
  const det2 = createSecretDetector({ now: fixedNow(T_NORMAL), storage: memStorage() });
  let early = null;
  for (const c of 'raceca') early = det2.onKey(c) || early;
  assert.equal(early, null, 'no hit halfway through the word');
  assert.equal(det2.onKey('r'), null, 'still no hit on the last letter itself');
  const closed = det2.onKey(' '); // a non-letter key closes the word
  assert.equal(closed && closed.id, 'palindrome');
  assert.equal(closed.detail, 'RACECAR');

  // A modifier key mid-word does NOT close it (capitalised "Racecar" is one word).
  const det3 = createSecretDetector({ now: fixedNow(T_NORMAL), storage: memStorage() });
  det3.onKey('Shift');
  for (const c of 'race') det3.onKey(c);
  assert.equal(det3.onKey('Shift'), null);
  for (const c of 'car') det3.onKey(c);
  assert.equal(det3.onIdle().detail, 'RACECAR');

  // newgrounds carries the magic word as detail too.
  const det4 = createSecretDetector({ now: fixedNow(T_NORMAL), storage: memStorage() });
  assert.equal(typeWord(det4, 'newgrounds').detail, 'NEWGROUNDS');
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
