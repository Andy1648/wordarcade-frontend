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
  PLAY_PATHS,
} from './router.js';

test('canonicalPathForView maps the four deep-linkable views to their PLAY paths', () => {
  // The bare /chain is the SEO landing page (a static file that wins over the SPA rewrite on
  // Vercel). The app's own URL is /chain/play, so reloading or sharing mid-run re-enters the MODE
  // instead of bouncing out to the landing page.
  assert.equal(canonicalPathForView('home'), '/');
  assert.equal(canonicalPathForView('sat-rush'), '/sat-rush/play');
  assert.equal(canonicalPathForView('chain'), '/chain/play');
  assert.equal(canonicalPathForView('fuse'), '/fuse/play');
  assert.equal(canonicalPathForView('room'), null); // transient — no URL of its own
  assert.equal(canonicalPathForView('game'), null);
  assert.equal(canonicalPathForView('lobby'), null);
});

test('viewIntentFromPath (popstate): menu paths -> home, play paths -> their mode, others -> null', () => {
  assert.equal(viewIntentFromPath('/'), 'home');
  // The two room modes open a LIVE ROOM, so Back must not re-drive them (null, like /room/*).
  assert.equal(viewIntentFromPath('/word-bomb/play'), null);
  assert.equal(viewIntentFromPath('/category-blitz/play'), null);
  assert.equal(viewIntentFromPath('/sat-rush/play'), 'sat-rush');
  assert.equal(viewIntentFromPath('/chain/play'), 'chain');
  assert.equal(viewIntentFromPath('/fuse/play'), 'fuse');
  // The bare paths still map (fallback only — a landing page shadows them on Vercel).
  assert.equal(viewIntentFromPath('/word-bomb'), 'home');
  assert.equal(viewIntentFromPath('/chain'), 'chain');
  assert.equal(viewIntentFromPath('/room/WXYZ'), null); // never re-drive the room from Back
  assert.equal(viewIntentFromPath('/nonsense'), null);
});

test('a trailing slash is the same route (/chain/play/ is a link someone pasted)', () => {
  assert.equal(viewIntentFromPath('/chain/play/'), 'chain');
  assert.equal(viewIntentFromPath('/fuse/play/'), 'fuse');
  assert.equal(viewIntentFromPath('/'), 'home'); // the root is left alone
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

test('ROUTE_PATHS lists the six crawlable routes; PLAY_PATHS lists the five playable ones', () => {
  assert.deepEqual(ROUTE_PATHS, ['/', '/word-bomb', '/category-blitz', '/sat-rush', '/chain', '/fuse']);
  assert.deepEqual(PLAY_PATHS, [
    '/word-bomb/play',
    '/category-blitz/play',
    '/sat-rush/play',
    '/chain/play',
    '/fuse/play',
  ]);
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

test('bridge: a PLAY path gets its query added (this is the production deep link)', () => {
  for (const [path, param] of [
    ['/sat-rush/play', 'satRush'],
    ['/chain/play', 'chain'],
    ['/fuse/play', 'fuse'],
  ]) {
    const c = withWindow(path, '', bridgePathToSearch);
    assert.ok(c.called, path + ' must bridge');
    const u = new URL('http://x' + c.url);
    assert.equal(u.pathname, path); // path KEPT
    assert.equal(u.searchParams.get(param), '1'); // reader param added -> launch intent -> no splash
  }
});

test('bridge: the two room modes bridge to ?play=<mode> (room + bot, no clicks)', () => {
  for (const mode of ['word-bomb', 'category-blitz']) {
    const c = withWindow(`/${mode}/play`, '', bridgePathToSearch);
    assert.ok(c.called, mode + ' must bridge');
    assert.equal(new URL('http://x' + c.url).searchParams.get('play'), mode);
  }
});

test('bridge: a PLAY path with a trailing slash still bridges', () => {
  const c = withWindow('/chain/play/', '', bridgePathToSearch);
  assert.ok(c.called);
  const u = new URL('http://x' + c.url);
  assert.equal(u.pathname, '/chain/play'); // normalised
  assert.equal(u.searchParams.get('chain'), '1');
});

test('bridge: the bare solo path still works (fallback for dev / the SW navigation fallback)', () => {
  const c = withWindow('/sat-rush', '', bridgePathToSearch);
  assert.ok(c.called);
  const u = new URL('http://x' + c.url);
  assert.equal(u.pathname, '/sat-rush');
  assert.equal(u.searchParams.get('satRush'), '1');
});

test('bridge: /room/:code adds join=CODE', () => {
  const c = withWindow('/room/qx7zp', '', bridgePathToSearch);
  assert.ok(c.called);
  assert.equal(new URL('http://x' + c.url).searchParams.get('join'), 'QX7ZP');
});

test('bridge: MERGES with an existing query (share ?ref=share survives)', () => {
  const c = withWindow('/chain/play', '?ref=share', bridgePathToSearch);
  const u = new URL('http://x' + c.url);
  assert.equal(u.searchParams.get('ref'), 'share'); // kept
  assert.equal(u.searchParams.get('chain'), '1'); // added
});

test('bridge: no-op for the menu paths and unknown paths (nothing to bridge)', () => {
  for (const p of ['/', '/word-bomb', '/category-blitz', '/anything']) {
    assert.equal(withWindow(p, '', bridgePathToSearch).called, false, `${p} should not rewrite`);
  }
});
