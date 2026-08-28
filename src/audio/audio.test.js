// audio.test.js (Job 11) — the PURE bits of the sound engine: the C-minor-pentatonic frequency
// ladder, the master-volume persistence, and the event-sound toggle (default OFF, persisted). Web
// Audio scheduling itself needs a real AudioContext (browser) — that's verified separately; here we
// pin the math + storage contract that must never regress.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pentFreq, NOTE, getMasterVolume, setMasterVolume } from './audioCore.js';
import { isEventSoundsEnabled, enableEventSounds, disableEventSounds } from './gameSounds.js';

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

test('pentatonic ladder is C minor pentatonic (C, Eb, F, G, Bb), climbing octaves', () => {
  const C3 = 130.8128;
  assert.ok(Math.abs(pentFreq(NOTE.C3) - C3) < 0.01);
  assert.ok(Math.abs(pentFreq(NOTE.Eb3) - C3 * 2 ** (3 / 12)) < 0.01); // minor third
  assert.ok(Math.abs(pentFreq(NOTE.G3) - C3 * 2 ** (7 / 12)) < 0.01); // perfect fifth
  assert.ok(Math.abs(pentFreq(NOTE.C4) - C3 * 2) < 0.01); // one octave up
  // Monotonically ascending, and every degree is a pentatonic interval (0,3,5,7,10 mod 12).
  for (let d = 1; d < 16; d++) assert.ok(pentFreq(d) > pentFreq(d - 1));
  const semis = [0, 3, 5, 7, 10];
  for (let d = 0; d < 16; d++) {
    const ratio = pentFreq(d) / C3;
    const semi = Math.round(12 * Math.log2(ratio));
    assert.ok(semis.includes(((semi % 12) + 12) % 12), `degree ${d} not pentatonic`);
  }
});

test('a fifth above a note is +7 semitones (degree +3 in this scale)', () => {
  const ratio = pentFreq(NOTE.C4 + 3) / pentFreq(NOTE.C4);
  assert.ok(Math.abs(ratio - 2 ** (7 / 12)) < 0.001); // C→G is a perfect fifth
});

test('master volume persists and clamps to [0,1]', () => {
  withStorage({}, () => {
    setMasterVolume(0.5);
    assert.equal(getMasterVolume(), 0.5);
    setMasterVolume(9); // clamps
    assert.equal(getMasterVolume(), 1);
    setMasterVolume(-2);
    assert.equal(getMasterVolume(), 0);
  });
});

test('event sounds default OFF and the toggle persists', () => {
  withStorage({}, () => {
    assert.equal(isEventSoundsEnabled(), false); // OFF by default (school-lab audience)
    enableEventSounds();
    assert.equal(isEventSoundsEnabled(), true);
    assert.equal(globalThis.localStorage.getItem('taw.sfxEvents'), '1');
    disableEventSounds();
    assert.equal(isEventSoundsEnabled(), false);
    assert.equal(globalThis.localStorage.getItem('taw.sfxEvents'), '0');
  });
});
