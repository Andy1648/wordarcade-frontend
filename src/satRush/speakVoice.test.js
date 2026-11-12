// speakVoice.test.js — FRENCH RUSH's pronunciation: the best French voice is picked, a device with no French
// voice gets none (the 🔊 hides), and the one-time "TAP 🔊 TO HEAR IT" note shows exactly once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickFrVoice, rankFrVoice } from './speak.js';
import { sayHintDue, markSayHintSeen, SAY_HINT_KEY } from './sayHint.js';

const V = (name, lang, localService = false) => ({ name, lang, localService });

test('no French voice → none (an English voice must never read French)', () => {
  assert.equal(pickFrVoice([]), null);
  assert.equal(pickFrVoice(null), null);
  assert.equal(pickFrVoice([V('Samantha', 'en-US', true), V('Anna', 'de-DE')]), null);
  assert.equal(rankFrVoice(V('Fred', 'en-FR')), -1);
  assert.equal(rankFrVoice(V('Franky', 'fy-NL')), -1); // "fr" must be the whole language subtag
});

test('fr-FR beats other French locales', () => {
  const v = pickFrVoice([V('Amélie', 'fr-CA', true), V('Thomas', 'fr-FR', true), V('Aude', 'fr-BE', true)]);
  assert.equal(v.name, 'Thomas');
});

test('a natural / Google voice beats a robotic default; on-device breaks a tie', () => {
  assert.equal(pickFrVoice([V('Thomas', 'fr-FR', true), V('Microsoft Denise Online (Natural)', 'fr-FR')]).name, 'Microsoft Denise Online (Natural)');
  assert.equal(pickFrVoice([V('Thomas', 'fr-FR', true), V('Google français', 'fr-FR')]).name, 'Google français');
  assert.equal(pickFrVoice([V('A', 'fr-FR'), V('B', 'fr-FR', true)]).name, 'B');
  assert.equal(pickFrVoice([V('Android', 'fr_FR')]).name, 'Android'); // Android's underscore form
});

function withStorage(fn) {
  const saved = globalThis.localStorage;
  const map = new Map();
  globalThis.localStorage = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
  try {
    return fn(map);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
}

test('the 🔊 note is due on a fresh device, then never again', () => {
  withStorage((map) => {
    assert.equal(sayHintDue(), true);
    markSayHintSeen();
    assert.equal(map.get(SAY_HINT_KEY), '1');
    assert.equal(sayHintDue(), false);
    markSayHintSeen(); // idempotent
    assert.equal(sayHintDue(), false);
  });
});

test('blocked storage never nags on every card', () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  try {
    assert.equal(sayHintDue(), false);
    assert.doesNotThrow(() => markSayHintSeen());
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
});
