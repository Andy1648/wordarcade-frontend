// packOdds.test.js — the EXACT odds shown on a paid pack's card (089) are the server's: the tier odds are
// private.pick_ticket_gear's (the game's 1/x weights at luck ×1 above the floor, from the gear pool in the latest migration),
// and every gear inside a tier is even. The numbers the report and the 089 header quote are pinned here too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { packOdds, pct, PACK_SHINY } from './packOdds.js';
import { ROLL_PACKS } from './packs.js';
import { ROLL_MARKS } from '../progress/markRollsCore.js';

const sum = (a) => a.reduce((s, x) => s + x, 0);

test('MYTHIC PACK: MYTHIC 15/17, SECRET 2/17; 14 mythics and 3 secrets, each even inside its tier', () => {
  const o = packOdds('mythic');
  assert.deepEqual(o.map((r) => r.tier), ['secret', 'mythic']);
  const by = Object.fromEntries(o.map((r) => [r.tier, r]));
  assert.ok(Math.abs(by.mythic.p - 15 / 17) < 1e-12);
  assert.ok(Math.abs(by.secret.p - 2 / 17) < 1e-12);
  assert.equal(by.mythic.items.length, 14);
  assert.equal(by.secret.items.length, 3);
  assert.equal(pct(by.mythic.p), '88.24%');
  assert.equal(pct(by.secret.p), '11.76%');
  assert.equal(pct(by.mythic.items[0].p), '6.30%');
  assert.equal(pct(by.secret.items[0].p), '3.92%');
  assert.ok(Math.abs(sum(o.flatMap((r) => r.items.map((i) => i.p))) - 1) < 1e-12);
});

test('SECRET PACK: always SECRET, a third each', () => {
  const o = packOdds('secret');
  assert.deepEqual(o.map((r) => [r.tier, r.p]), [['secret', 1]]);
  assert.deepEqual(o[0].items.map((i) => i.name), ROLL_MARKS.filter((m) => m.tier === 'secret').map((m) => m.name));
  assert.equal(pct(o[0].items[0].p), '33.33%');
  assert.equal(pct(PACK_SHINY), '1.50%');
});

test('every pack floor has odds, and the gears listed are exactly the server pool\'s for those tiers', () => {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  const last = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().filter((f) => readFileSync(join(dir, f), 'utf8').includes('insert into private.gear_pool')).pop();
  const sql = readFileSync(join(dir, last), 'utf8');
  for (const p of ROLL_PACKS) {
    const o = packOdds(p.tier);
    assert.ok(o.length > 0, p.id);
    for (const r of o) {
      const server = [...sql.matchAll(new RegExp(`\\('(mk-[a-z0-9-]+)', '${r.tier}', ([0-9.]+),`, 'g'))];
      assert.deepEqual(r.items.map((i) => i.id).sort(), server.map((m) => m[1]).sort(), `${last}: ${r.tier}`);
      // same 1/x per gear in a tier on both sides, so the tier weight is the same
      for (const [, id, x] of server) assert.equal(ROLL_MARKS.find((m) => m.id === id).x, Number(x), id);
    }
  }
});
