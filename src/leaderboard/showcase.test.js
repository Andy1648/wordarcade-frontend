// showcase.test.js — the board's HERO must land (oct19: a player's equipped BOO showed as HEX — the row's hero was null
// because a send the pre-053 function took was stamped stored-for-good, and a send inside the DB's 20 s window was
// dropped while answering ok).
import test from 'node:test';
import assert from 'node:assert/strict';
import { pushShowcase } from './showcase.js';

function withStorage(seed, fn) {
  const map = new Map(Object.entries(seed || {}));
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
  return Promise.resolve(fn(map)).finally(() => { if (saved === undefined) delete globalThis.localStorage; else globalThis.localStorage = saved; });
}
const SECRET = 'x'.repeat(40);

test('a v < 53 answer is not stored for good (the hero may have been dropped) — it re-sends later', () => withStorage({ 'taw.main': 'riot' }, async (map) => {
  const calls = [];
  const rpc = async (fn, body) => { calls.push(body.p_show.hero); return { ok: true, v: 50 }; };
  assert.equal(await pushShowcase({ rpc, secret: SECRET }), true);
  assert.match(map.get('taw.s2.showcase3'), /\n\d+$/, 'stamped, not stored for good');
  assert.equal(calls[0], 'riot', 'the equipped hero rides the send');
}));

test('a v >= 53 answer is stored for good: an unchanged showcase is not re-sent', () => withStorage({ 'taw.main': 'riot' }, async (map) => {
  let n = 0;
  const rpc = async () => { n++; return { ok: true, v: 53 }; };
  assert.equal(await pushShowcase({ rpc, secret: SECRET }), true);
  map.set('taw.s2.showcase.at', '0'); // past the DB window
  assert.equal(await pushShowcase({ rpc, secret: SECRET }), false);
  assert.equal(n, 1);
}));

test('a changed showcase inside the DB 20 s window waits it out instead of being silently dropped', () => withStorage({ 'taw.main': 'riot' }, async (map) => {
  const sent = [];
  const rpc = async (fn, body) => { sent.push(body.p_show.hero); return { ok: true, v: 53 }; };
  assert.equal(await pushShowcase({ rpc, secret: SECRET }), true);
  map.set('taw.main', 'hype'); // a new hero, seconds after the last push
  assert.equal(await pushShowcase({ rpc, secret: SECRET }), false, 'held for the window');
  assert.deepEqual(sent, ['riot']);
  map.set('taw.s2.showcase.at', String(Date.now() - 30000)); // the window has passed
  assert.equal(await pushShowcase({ rpc, secret: SECRET }), true);
  assert.deepEqual(sent, ['riot', 'hype']);
}));
