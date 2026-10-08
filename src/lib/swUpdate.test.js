// swUpdate — the reload fires anywhere that is NOT a round in progress (Andy oct8: "immediate is best"), waits
// through game / room / lobby / vs-bot / chain / fuse / sat-rush, and asks for a new worker when the tab comes back.
import { test } from 'node:test';
import assert from 'node:assert/strict';

function fakeDom(view) {
  const listeners = {};
  let reloads = 0;
  let updates = 0;
  globalThis.document = {
    documentElement: { getAttribute: (k) => (k === 'data-view' ? view.value : null) },
    visibilityState: 'visible',
    addEventListener: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
  };
  globalThis.window = { location: { reload: () => { reloads += 1; } }, addEventListener: (ev, fn) => { (listeners[ev] ||= []).push(fn); } };
  // node 22 ships a read-only globalThis.navigator — define over it
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    serviceWorker: {
      controller: {},
      addEventListener: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
      getRegistration: () => Promise.resolve({ update: () => { updates += 1; return Promise.resolve(); } }),
    },
  } });
  return { fire: (ev) => (listeners[ev] || []).forEach((f) => f()), reloads: () => reloads, updates: () => updates };
}

test('an updated worker reloads at once on the splash (no data-view), the menu, the shop — never in a round', async () => {
  const { installSwUpdateReload } = await import('./swUpdate.js');
  for (const v of [null, 'home', 'shop', 'stats', 'leaderboard', 'credits']) {
    const view = { value: v };
    const d = fakeDom(view);
    assert.equal(installSwUpdateReload({ pollMs: 5 }), true);
    d.fire('controllerchange');
    assert.equal(d.reloads(), 1, `reloads at once on view=${v}`);
  }
  for (const v of ['game', 'room', 'lobby', 'vs-bot', 'chain', 'fuse', 'sat-rush']) {
    const view = { value: v };
    const d = fakeDom(view);
    installSwUpdateReload({ pollMs: 5 });
    d.fire('controllerchange');
    assert.equal(d.reloads(), 0, `holds during view=${v}`);
    view.value = 'home';
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(d.reloads(), 1, `reloads once the round is over (${v} → home)`);
  }
});

test('a tab coming back into view asks the registration for a new worker', async () => {
  const { installSwUpdateReload } = await import('./swUpdate.js');
  const d = fakeDom({ value: 'home' });
  installSwUpdateReload({ pollMs: 5 });
  d.fire('visibilitychange');
  d.fire('focus');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(d.updates(), 2);
});
