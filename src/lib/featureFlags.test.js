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

test('rollsEnabled: ON under Rebirth Rush; the ?rolls=1 / taw.rollsOn / shared-key overrides still read through flagOn', () => {
  // PROGRESSION FINAL turned MARK ROLLS on (ROLLS_ON = true) — every environment, blocked storage included.
  for (const env of [{}, { search: '?rolls=1' }, { store: { [ROLLS_KEY]: '1' } }, { throwing: true }]) {
    withEnv(env, () => assert.equal(rollsEnabled(), true));
  }
  // The override path rollsEnabled() falls back to if ROLLS_ON is ever flipped off again.
  const rollsFlag = () => flagOn('rolls', { legacyKey: ROLLS_KEY });
  withEnv({}, () => assert.equal(rollsFlag(), false));
  withEnv({ search: '?rolls=1' }, () => assert.equal(rollsFlag(), true));
  withEnv({ store: { [ROLLS_KEY]: '1' } }, () => assert.equal(rollsFlag(), true));
  withEnv({ store: { 'taw.flag.rolls': '1' } }, () => assert.equal(rollsFlag(), true));
  withEnv({ throwing: true }, () => assert.equal(rollsFlag(), false));
});
