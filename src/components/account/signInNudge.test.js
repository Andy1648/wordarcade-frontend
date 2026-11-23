import test from 'node:test';
import assert from 'node:assert/strict';
import { canAsk, withNo, withShown, mayAsk, sayNo, markShown, SNOOZE_MS, GAP_MS, MAX_NO, SIGNIN_SEEN_KEY } from './signInNudge.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

test('a fresh guest is asked everywhere; an unknown place never', () => {
  for (const p of ['board', 'profile', 'parade', 'code']) assert.equal(canAsk(p, {}), true);
  assert.equal(canAsk('nowhere', {}), false);
});

test('NOT NOW snoozes that place for 7 days only, and the third no retires it', () => {
  const t = 1_000_000_000_000;
  let s = withNo('board', {}, t);
  assert.equal(canAsk('board', s, t + 1), false);
  assert.equal(canAsk('profile', s, t + 1), true); // other places are untouched
  assert.equal(canAsk('board', s, t + SNOOZE_MS + 1), true);
  for (let i = 1; i < MAX_NO; i += 1) s = withNo('board', s, t);
  assert.equal(canAsk('board', s, t + 100 * SNOOZE_MS), false);
});

test('a moment waits its gap between showings; a quiet row does not', () => {
  const t = 2_000_000_000_000;
  const s = withShown('profile', withShown('parade', {}, t), t);
  assert.equal(canAsk('parade', s, t + 60_000), false);
  assert.equal(canAsk('parade', s, t + GAP_MS + 1), true);
  assert.equal(canAsk('profile', s, t + 60_000), true);
});

test('the storage bridge round-trips and survives junk', () => {
  const st = mem();
  assert.equal(mayAsk('code', st), true);
  markShown('code', st);
  assert.equal(mayAsk('code', st), false);
  sayNo('board', st);
  assert.equal(mayAsk('board', st), false);
  st.setItem(SIGNIN_SEEN_KEY, '[1,2');
  assert.equal(mayAsk('board', st), true);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(mayAsk('board', broken), true);
  assert.doesNotThrow(() => sayNo('board', broken));
});
