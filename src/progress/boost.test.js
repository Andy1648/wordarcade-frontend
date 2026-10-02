import test from 'node:test';
import assert from 'node:assert/strict';
import { boostMult, boostRemaining, startBoost, isBoostActive, BOOST_KEY } from './boost.js';

function withStore(fn) {
  const m = new Map();
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try { fn(m); } finally { globalThis.localStorage = prev; }
}

test('no boost by default: ×1, 0 ms', () => withStore(() => {
  assert.equal(boostMult(1000), 1);
  assert.equal(boostRemaining(1000), 0);
}));

test('a boost is wall-clock: ×3 for 10 min, then gone', () => withStore(() => {
  startBoost(3, 10, 0);
  assert.equal(boostMult(1), 3);
  assert.equal(isBoostActive(599_999), true);
  assert.equal(boostMult(600_001), 1);
}));

test('a second boost while live EXTENDS it at the higher multiplier', () => withStore(() => {
  startBoost(3, 10, 0);
  const r = startBoost(2, 5, 60_000);
  assert.equal(r.mult, 3);
  assert.equal(boostRemaining(60_000), 14 * 60_000);
}));

test('garbage in storage is no boost, never a throw', () => withStore((m) => {
  m.set(BOOST_KEY, '{nope');
  assert.equal(boostMult(), 1);
  m.set(BOOST_KEY, JSON.stringify({ until: 'x', mult: 3 }));
  assert.equal(boostMult(), 1);
}));
