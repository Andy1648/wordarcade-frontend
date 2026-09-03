// node --test — pure router helpers (feat/router): path<->view mapping, room-code parse, sticky-query
// guard, and the boot bridge that translates a clean path into the query the entry readers expect.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalPathForView,
  viewIntentFromPath,
  roomCodeFromPath,
  hasStickyQuery,
  bridgePathToSearch,
  ROUTE_PATHS,
} from './router.js';

test('canonicalPathForView maps only the four deep-linkable views', () => {
  assert.equal(canonicalPathForView('home'), '/');
  assert.equal(canonicalPathForView('sat-rush'), '/sat-rush');
  assert.equal(canonicalPathForView('chain'), '/chain');
  assert.equal(canonicalPathForView('fuse'), '/fuse');
  assert.equal(canonicalPathForView('room'), null); // transient — no URL of its own
  assert.equal(canonicalPathForView('game'), null);
  assert.equal(canonicalPathForView('lobby'), null);
});

test('viewIntentFromPath (popstate): menu paths -> home, solo paths -> their view, others -> null', () => {
  assert.equal(viewIntentFromPath('/'), 'home');
  assert.equal(viewIntentFromPath('/word-bomb'), 'home');
  assert.equal(viewIntentFromPath('/category-blitz'), 'home');
  assert.equal(viewIntentFromPath('/sat-rush'), 'sat-rush');
  assert.equal(viewIntentFromPath('/chain'), 'chain');
  assert.equal(viewIntentFromPath('/fuse'), 'fuse');
  assert.equal(viewIntentFromPath('/room/WXYZ'), null); // never re-drive the room from Back
  assert.equal(viewIntentFromPath('/nonsense'), null);
});

test('roomCodeFromPath parses + normalises /room/:code', () => {
  assert.equal(roomCodeFromPath('/room/wxyz'), 'WXYZ');
  assert.equal(roomCodeFromPath('/room/ab-12'), 'AB12'); // strip non-alnum
  assert.equal(roomCodeFromPath('/room/QX7ZP?ref=share'), 'QX7ZP');
  assert.equal(roomCodeFromPath('/'), null);
  assert.equal(roomCodeFromPath('/sat-rush'), null);
});

test('hasStickyQuery guards embed/dev entries, not shareable deep links', () => {
  assert.equal(hasStickyQuery('?cg=1'), true);
  assert.equal(hasStickyQuery('?portal=1'), true);
  assert.equal(hasStickyQuery('?stage=5'), true);
  assert.equal(hasStickyQuery('?tune=1'), true);
  assert.equal(hasStickyQuery('?satrush=1'), false);
  assert.equal(hasStickyQuery('?ref=share'), false);
  assert.equal(hasStickyQuery(''), false);
});

test('ROUTE_PATHS lists all six clean routes', () => {
  assert.deepEqual(ROUTE_PATHS, ['/', '/word-bomb', '/category-blitz', '/sat-rush', '/chain', '/fuse']);
});

// bridgePathToSearch runs against window; stub a minimal one and capture the rewrite.
function withWindow(pathname, search, fn) {
  let captured = { called: false, url: null };
  const orig = globalThis.window;
  globalThis.window = {
    location: { pathname, search },
    history: {
      state: null,
      replaceState: (_s, _t, url) => {
        captured.called = true;
        captured.url = url;
      },
    },
  };
  try {
    fn();
  } finally {
    globalThis.window = orig;
  }
  return captured;
}

test('bridge: a clean solo path gets its query added', () => {
  const c = withWindow('/sat-rush', '', bridgePathToSearch);
  assert.ok(c.called);
  const u = new URL('http://x' + c.url);
  assert.equal(u.pathname, '/sat-rush'); // path KEPT
  assert.equal(u.searchParams.get('satRush'), '1'); // reader param added
});

test('bridge: /room/:code adds join=CODE', () => {
  const c = withWindow('/room/qx7zp', '', bridgePathToSearch);
  assert.ok(c.called);
  assert.equal(new URL('http://x' + c.url).searchParams.get('join'), 'QX7ZP');
});

test('bridge: MERGES with an existing query (share ?ref=share survives)', () => {
  const c = withWindow('/chain', '?ref=share', bridgePathToSearch);
  const u = new URL('http://x' + c.url);
  assert.equal(u.searchParams.get('ref'), 'share'); // kept
  assert.equal(u.searchParams.get('chain'), '1'); // added
});

test('bridge: no-op for the menu paths and unknown paths (nothing to bridge)', () => {
  for (const p of ['/', '/word-bomb', '/category-blitz', '/anything']) {
    assert.equal(withWindow(p, '', bridgePathToSearch).called, false, `${p} should not rewrite`);
  }
});
