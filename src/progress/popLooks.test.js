// popLooks.test.js — every paid POP STYLE paints something (Andy oct19 "the looks dont seem to do anything at all").
import test from 'node:test';
import assert from 'node:assert/strict';
import { POP_LOOKS, popLookOf } from './popLooks.js';
import { POP_STYLES } from './shop.js';

const HEX = /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/;

test('every paid pop style has a look; CLASSIC keeps the menu dress', () => {
  assert.equal(popLookOf('classic'), null);
  assert.equal(popLookOf('nope'), null);
  for (const s of POP_STYLES.filter((x) => x.id !== 'classic')) {
    const l = popLookOf(s.id);
    assert.ok(l, `${s.id} has a look`);
    assert.ok(l.fill.length >= 1 && [...l.fill, l.stroke, l.shadow, ...l.shards].every((c) => HEX.test(c)), `${s.id}: flat hex colours`);
    assert.ok(!l.fill.includes(l.stroke), `${s.id}: the outline differs from the fill`);
    assert.ok(l.n >= 1 && l.n <= 6, `${s.id}: 1–6 pooled shards`);
  }
  assert.deepEqual(Object.keys(POP_LOOKS).sort(), POP_STYLES.filter((x) => x.id !== 'classic').map((x) => x.id).sort());
});

test('a pricier look never throws fewer shards (the ladder reads as more)', () => {
  const paid = POP_STYLES.filter((x) => x.id !== 'classic').sort((a, b) => a.price - b.price);
  for (let i = 1; i < paid.length; i += 1) assert.ok(POP_LOOKS[paid[i].id].n >= POP_LOOKS[paid[i - 1].id].n, `${paid[i].id} ≥ ${paid[i - 1].id}`);
});
