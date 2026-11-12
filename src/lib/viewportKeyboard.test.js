// viewportKeyboard.test.js — when the phone keyboard counts as up, and the watcher's two outputs (--vvh, data-kb) on a fake window.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyboardUp, installViewportKeyboard } from './viewportKeyboard.js';

test('up only while editing and the visible height has collapsed', () => {
  assert.equal(keyboardUp(500, 844, true), true);
  assert.equal(keyboardUp(500, 844, false), false); // a short window with nothing focused is just a short window
  assert.equal(keyboardUp(800, 844, true), false); // the URL bar collapsing is not a keyboard
  assert.equal(keyboardUp(360, 0, true), false);
});

function fakeWindow() {
  const listeners = {};
  const attrs = {};
  const props = {};
  const vals = {};
  const on = (bag) => (n, f) => { (bag[n] = bag[n] || []).push(f); };
  const vvL = {};
  const win = {
    innerWidth: 390,
    innerHeight: 844,
    visualViewport: { height: 844, addEventListener: on(vvL), removeEventListener() {} },
    addEventListener: on(listeners),
    removeEventListener() {},
    requestAnimationFrame: (f) => { f(); return 1; },
    cancelAnimationFrame() {},
    document: {
      activeElement: null,
      documentElement: {
        style: { setProperty: (k, v) => { props[k] = v; } },
        setAttribute: (k, v) => { attrs[k] = true; vals[k] = v; },
        removeAttribute: (k) => { delete attrs[k]; },
      },
    },
  };
  return { win, attrs, props, vals, fire: (n) => (n === 'vv' ? vvL.resize : listeners[n]).forEach((f) => f()) };
}

test('iOS: the page keeps its height, only the visual viewport shrinks: --vvh follows it and data-kb goes up', () => {
  const f = fakeWindow();
  installViewportKeyboard(f.win);
  assert.equal(f.props['--vvh'], '844px');
  assert.equal(f.attrs['data-kb'], undefined);
  f.win.document.activeElement = { tagName: 'INPUT', type: 'text' };
  f.fire('focusin');
  f.win.visualViewport.height = 508;
  f.fire('vv');
  assert.equal(f.props['--vvh'], '508px');
  assert.equal(f.attrs['data-kb'], true);
  f.win.visualViewport.height = 360;
  f.fire('vv');
  assert.equal(f.vals['data-kb'], 'short');
  f.win.document.activeElement = null;
  f.win.visualViewport.height = 844;
  f.fire('focusout');
  assert.equal(f.attrs['data-kb'], undefined);
  assert.equal(f.props['--vvh'], '844px');
});

test('a focused button is not a text field', () => {
  const f = fakeWindow();
  installViewportKeyboard(f.win);
  f.win.document.activeElement = { tagName: 'INPUT', type: 'submit' };
  f.win.visualViewport.height = 500;
  f.fire('vv');
  assert.equal(f.attrs['data-kb'], undefined);
});
