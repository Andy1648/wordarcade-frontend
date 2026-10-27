// avatarFrame.test.js — every card FRAME has its round avatar ring (art + face window), and the worn id is read
// shape-checked from the same storage key kit.js writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FRAMES, KIT_KEY } from './kit.js';
import { AVATAR_WIN, wornAvatarFrame } from './avatarFrame.js';

test('every frame has a ring and a sane face window', () => {
  for (const f of FRAMES) {
    const w = AVATAR_WIN[f.id];
    assert.ok(w, `${f.id} has no AVATAR_WIN row`);
    const [cx, cy, r] = w;
    assert.ok(cx - r >= 0 && cx + r <= 100 && cy - r >= 0 && cy + r <= 100 && r >= 20, `${f.id} window out of range`);
    assert.ok(fs.existsSync(new URL(`../../public/cast/avatar/${f.id}.webp`, import.meta.url)), `${f.id}.webp missing`);
  }
  assert.equal(Object.keys(AVATAR_WIN).length, FRAMES.length);
});

test('the worn frame comes from the kit store; junk reads as none', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  try {
    assert.equal(KIT_KEY, 'taw.s2.kit');
    assert.equal(wornAvatarFrame(), null);
    store.set(KIT_KEY, JSON.stringify({ own: ['frost'], frame: 'frost' }));
    assert.equal(wornAvatarFrame(), 'frost');
    store.set(KIT_KEY, JSON.stringify({ frame: '../evil' }));
    assert.equal(wornAvatarFrame(), null);
    store.set(KIT_KEY, '{not json');
    assert.equal(wornAvatarFrame(), null);
  } finally { delete globalThis.localStorage; }
});
