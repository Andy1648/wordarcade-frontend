// rushMute.test.js — the run header's SOUND switch IS the arcade mute (taw.sfxEvents), not a second setting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rushSoundOn, setRushSound, syncRushSound, RUSH_SOUND_KEY } from './rushMute.js';
import { getSettings, setMuted } from '../juice/settings.js';

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
    setMuted(false);
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
}

test('on by default; only the explicit arcade mute counts as off', () => {
  withStorage({}, () => assert.equal(rushSoundOn(), true));
  withStorage({ [RUSH_SOUND_KEY]: '1' }, () => assert.equal(rushSoundOn(), true));
  withStorage({ [RUSH_SOUND_KEY]: '0' }, () => assert.equal(rushSoundOn(), false));
});

test('the switch writes the arcade mute and the live juice mute, both ways', () => {
  withStorage({}, (map) => {
    assert.equal(setRushSound(false), false);
    assert.equal(map.get(RUSH_SOUND_KEY), '0');
    assert.equal(getSettings().sound, false);
    assert.equal(setRushSound(true), true);
    assert.equal(map.get(RUSH_SOUND_KEY), '1');
    assert.equal(getSettings().sound, true);
  });
});

test('mount sync only ever mutes', () => {
  withStorage({ [RUSH_SOUND_KEY]: '0' }, () => {
    setMuted(false);
    syncRushSound();
    assert.equal(getSettings().sound, false);
  });
  withStorage({}, () => {
    setMuted(true); // an app-level mute stays
    syncRushSound();
    assert.equal(getSettings().sound, false);
  });
});
