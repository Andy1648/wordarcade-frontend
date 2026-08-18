// visitHistory.test.js — the intro's session boundary.
// The intro replays once per SESSION, where a session ends after INTRO_COOLDOWN_MS
// (30 min) of absence. hasSeenIntro() is "skip the intro" = last seen recently.
// visitHistory reads the GLOBAL localStorage, so each test installs an in-memory
// (or throwing) stand-in on globalThis before calling in.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasSeenIntro,
  markIntroSeen,
  stampLastSeen,
  INTRO_COOLDOWN_MS,
} from './visitHistory.js';

// A minimal in-memory localStorage stand-in (getItem/setItem/removeItem).
function memStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

// Storage that throws on every access (private mode / disabled storage).
const blockedStorage = {
  getItem() { throw new Error('storage blocked'); },
  setItem() { throw new Error('storage blocked'); },
  removeItem() { throw new Error('storage blocked'); },
};

function install(storage) {
  globalThis.localStorage = storage;
}

const MIN = 60 * 1000;

test('sanity: the cooldown is 30 minutes', () => {
  assert.equal(INTRO_COOLDOWN_MS, 30 * 60 * 1000);
});

test('last seen 5 min ago → within the session, intro is skipped', () => {
  install(memStorage({ wa_last_seen: String(Date.now() - 5 * MIN) }));
  assert.equal(hasSeenIntro(), true);
});

test('last seen 31 min ago → session expired, intro replays', () => {
  install(memStorage({ wa_last_seen: String(Date.now() - 31 * MIN) }));
  assert.equal(hasSeenIntro(), false);
});

test("legacy wa_intro_seen '1' (no timestamp) → intro replays, and stamping migrates it", () => {
  const s = memStorage({ wa_intro_seen: '1' });
  install(s);
  // The old permanent flag lives under a different key and is not a recent stamp.
  assert.equal(hasSeenIntro(), false);
  // Stamping now records the timestamp AND drops the legacy key.
  markIntroSeen();
  assert.equal(s._map.has('wa_intro_seen'), false, 'legacy key removed on migration');
  assert.equal(hasSeenIntro(), true, 'freshly stamped → within session');
});

test("a literal '1' stored under wa_last_seen is not a recent timestamp → replays", () => {
  install(memStorage({ wa_last_seen: '1' }));
  assert.equal(hasSeenIntro(), false);
});

test('garbage / missing values are treated as NOT seen (replay)', () => {
  install(memStorage({ wa_last_seen: 'not-a-number' }));
  assert.equal(hasSeenIntro(), false);
  install(memStorage()); // nothing stored at all
  assert.equal(hasSeenIntro(), false);
});

test('markIntroSeen / stampLastSeen record now so the intro is then skipped', () => {
  install(memStorage());
  assert.equal(hasSeenIntro(), false);
  stampLastSeen();
  assert.equal(hasSeenIntro(), true);
});

test('storage unavailable → replay and never throw', () => {
  install(blockedStorage);
  assert.equal(hasSeenIntro(), false); // reads throw → not seen
  assert.doesNotThrow(() => stampLastSeen());
  assert.doesNotThrow(() => markIntroSeen());
});
