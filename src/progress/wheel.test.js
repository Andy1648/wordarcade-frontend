// wheel.test.js — THE DAILY WHEEL's pure half + its parity with 067_daily_wheel.sql (the published odds ARE the server's).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WHEEL_SLOTS, SLICE_DEG, WHEEL_COSMETICS, WHEEL_AD_ON, landAngle, slotAt, pegCrossings, timeAtProgress, normalizeSpin,
  oddsRows, nextBonus, payLanded, readWheel, WHEEL_KEY,
} from './wheel.js';
import { kitById } from '../cast/kit.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SQL = readFileSync(join(ROOT, 'supabase', 'migrations', '067_daily_wheel.sql'), 'utf8');
const UID = '11111111-2222-4333-8444-555555555555';

test('the published table: 8 equal slices, weights sum to 100, and EXACTLY the migration\'s private.wheel_pick table', () => {
  assert.equal(WHEEL_SLOTS.length, 8);
  assert.equal(SLICE_DEG, 45);
  assert.equal(WHEEL_SLOTS.reduce((a, s) => a + s.w, 0), 100);
  const body = SQL.slice(SQL.indexOf('private.wheel_pick()'), SQL.indexOf('end $$;', SQL.indexOf('private.wheel_pick()')));
  const rows = [...body.matchAll(/\((\d), (\d+)\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.deepEqual(rows, WHEEL_SLOTS.map((s) => [s.slot, s.w]));
  // the gem amounts the server pays per slot
  for (const s of WHEEL_SLOTS.filter((x) => x.kind === 'gems')) assert.match(SQL, new RegExp(`when ${s.slot} then ${s.gems}|else ${s.gems} end`));
  assert.equal(oddsRows().reduce((a, r) => a + r.pct, 0), 100);
});

test('honest layout: the jackpot never sits beside the most common slice', () => {
  const common = WHEEL_SLOTS.reduce((b, s) => (s.w > b.w ? s : b)).slot;
  const jack = WHEEL_SLOTS.find((s) => s.jackpot).slot;
  const n = WHEEL_SLOTS.length;
  assert.notEqual((jack + 1) % n, common);
  assert.notEqual((jack + n - 1) % n, common);
});

test('landAngle lands every slot under the pointer, inside the middle of the slice, after ≥ 5 turns', () => {
  for (const s of WHEEL_SLOTS) {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const from = 123.4;
      const to = landAngle(s.slot, from, () => r, 5);
      assert.equal(slotAt(to), s.slot, `slot ${s.slot} rng ${r}`);
      assert.ok(to - from >= 5 * 360 - SLICE_DEG, 'at least five turns');
      // never in the outer 20% of the slice either side
      const off = ((((-to % 360) + 360) % 360) - s.slot * SLICE_DEG + 540) % 360 - 180;
      assert.ok(Math.abs(off) <= SLICE_DEG * 0.3 + 1e-9, `offset ${off}`);
    }
  }
});

test('peg crossings: one per slice border passed, in order; the easing inverse is monotone', () => {
  const c = pegCrossings(0, 720);
  assert.equal(c.length, 16);
  assert.ok(c.every((a, i) => i === 0 || a > c[i - 1]));
  assert.equal(c[0], 22.5);
  let prev = -1;
  for (let p = 0; p <= 1.0001; p += 0.05) {
    const t = timeAtProgress(Math.min(1, p));
    assert.ok(t >= prev - 1e-9 && t >= 0 && t <= 1.0001);
    prev = t;
  }
});

test('normalizeSpin: a good reply passes, anything off never pays', () => {
  const ok = { ok: true, spin: UID, day: 20000, kind: 'free', slot: 2, prize: 'gems', amount: 60, streak: 3, bonus: 'hot', claimed: false };
  assert.equal(normalizeSpin(ok).amount, 60);
  assert.equal(normalizeSpin({ ...ok, spin: 'nope' }), null);
  assert.equal(normalizeSpin({ ...ok, slot: 9 }), null);
  assert.equal(normalizeSpin({ ...ok, amount: 99999 }), null);
  assert.equal(normalizeSpin({ ...ok, prize: 'ticket' }), null); // a ticket prize needs its ticket
  assert.equal(normalizeSpin({ ...ok, prize: 'ticket', ticket: { id: UID, tier: 'legendary' } }).ticket.tier, 'legendary');
  assert.equal(normalizeSpin({ ...ok, prize: 'cosmetic', cosmetic: 'pup' }), null); // only the wheel set
  assert.equal(normalizeSpin({ ...ok, ok: false }), null);
});

test('the wheel cosmetics exist in the kit, are never sold, and the migration hands out exactly that set', () => {
  for (const id of WHEEL_COSMETICS) {
    const k = kitById(id);
    assert.ok(k && k.wheel && !k.price, id);
  }
  assert.match(SQL, /array\['lucky', 'jackpot', 'confetti'\]/);
});

test('streak bonus: HOT from day 3, SUPER every 7th', () => {
  assert.equal(nextBonus(0), null); // tomorrow = day 1
  assert.equal(nextBonus(1), null);
  assert.equal(nextBonus(2), 'hot');
  assert.equal(nextBonus(6), 'super');
  assert.equal(nextBonus(7), 'hot');
  assert.equal(nextBonus(13), 'super');
});

test('payLanded pays a spin into the save ONCE; a claimed spin (another device) pays nothing', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const paid = [];
  const deps = { grantGems: (n, r) => paid.push(['gems', n, r]), grantFx: (k, m) => paid.push([k, m]), grantKit: (id) => paid.push(['kit', id]) };
  const s = normalizeSpin({ ok: true, spin: UID, day: 1, kind: 'free', slot: 2, prize: 'gems', amount: 60 });
  assert.equal(payLanded(s, deps), true);
  assert.equal(payLanded(s, deps), false);
  assert.deepEqual(paid, [['gems', 60, 'wheel']]);
  assert.deepEqual(readWheel().paid, [UID]);
  const other = normalizeSpin({ ok: true, spin: UID.replace('1111', '2222'), day: 2, kind: 'free', slot: 1, prize: 'xp', amount: 10, claimed: true });
  assert.equal(payLanded(other, deps), false);
  assert.equal(paid.length, 1);
  store.delete(WHEEL_KEY);
  delete globalThis.localStorage;
});

test('the ad spin is OFF until rewarded ads are approved', () => {
  assert.equal(WHEEL_AD_ON, false);
  assert.match(SQL, /ad_on boolean not null default false/);
});
