import test from 'node:test';
import assert from 'node:assert/strict';
import { flagOn, FLAG_PREFIX } from './featureFlags.js';
import { rollsEnabled, ROLLS_KEY } from '../progress/rollsFlag.js';

function withEnv({ search = '', store = {}, throwing = false } = {}, fn) {
  const savedWin = globalThis.window;
  const savedLs = globalThis.localStorage;
  globalThis.window = { location: { search } };
  globalThis.localStorage = throwing
    ? { getItem() { throw new Error('blocked'); } }
    : { getItem: (k) => (k in store ? store[k] : null) };
  try {
    fn();
  } finally {
    if (savedWin === undefined) delete globalThis.window;
    else globalThis.window = savedWin;
    if (savedLs === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = savedLs;
  }
}

test('flagOn: off by default', () => {
  withEnv({}, () => assert.equal(flagOn('nearmiss'), false));
  assert.equal(flagOn(''), false);
});

test('flagOn: ?name=1 turns it on (and only =1)', () => {
  withEnv({ search: '?nearmiss=1' }, () => assert.equal(flagOn('nearmiss'), true));
  withEnv({ search: '?nearmiss=0' }, () => assert.equal(flagOn('nearmiss'), false));
  withEnv({ search: '?nearmiss=1' }, () => assert.equal(flagOn('rival'), false));
});

test('flagOn: localStorage taw.flag.<name> = "1" turns it on', () => {
  withEnv({ store: { [FLAG_PREFIX + 'nearmiss']: '1' } }, () => assert.equal(flagOn('nearmiss'), true));
  withEnv({ store: { 'taw.flag.nearmiss': 'true' } }, () => assert.equal(flagOn('nearmiss'), false));
});

test('flagOn: blocked storage / no window read as OFF, never throw', () => {
  withEnv({ throwing: true }, () => assert.equal(flagOn('nearmiss'), false));
  const savedWin = globalThis.window;
  delete globalThis.window;
  try {
    assert.doesNotThrow(() => flagOn('nearmiss'));
  } finally {
    if (savedWin !== undefined) globalThis.window = savedWin;
  }
});

test('rollsEnabled: DORMANT until the rolls-live PR; ?rolls=1 / taw.rollsOn / the shared key turn it on', () => {
  withEnv({}, () => assert.equal(rollsEnabled(), false));
  withEnv({ throwing: true }, () => assert.equal(rollsEnabled(), false));
  for (const env of [{ search: '?rolls=1' }, { store: { [ROLLS_KEY]: '1' } }, { store: { 'taw.flag.rolls': '1' } }]) {
    withEnv(env, () => assert.equal(rollsEnabled(), true));
  }
});
