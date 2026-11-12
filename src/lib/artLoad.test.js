// artLoad.test.js — the fade decision, and the plate list staying in step with its CSS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkMs, ART_SLOTS, FADE_MIN_MS } from './artLoad.js';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'theme', 'artSlots.css'), 'utf8');

test('no record of the file counts as cached: it appears, it never fades', () => {
  assert.equal(networkMs([]), 0);
  assert.equal(networkMs(null), 0);
  assert.ok(networkMs([]) < FADE_MIN_MS);
});

test('the latest record decides', () => {
  assert.equal(networkMs([{ duration: 900 }, { duration: 12 }]), 12);
});

test('every listed slot has its plate, and the plate list has no extra slot', () => {
  const slots = ART_SLOTS.split(',').map((s) => s.trim());
  for (const s of slots) assert.ok(css.includes(`${s}:not([data-art])`), s);
  assert.equal((css.match(/:not\(\[data-art\]\)/g) || []).length, slots.length);
});

test('the plate is static: no animation in the file', () => {
  assert.ok(!/animation|@keyframes|transition/.test(css));
});
