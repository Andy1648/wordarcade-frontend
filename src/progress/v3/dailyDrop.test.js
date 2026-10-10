// dailyDrop.test.js — THE DAILY FREE DROP (season 2): the printed odds, the tap-climb, one claim per local day, the
// midnight reset, and the payouts (gems through the one door; MYTHIC = the STOCK overdrive's own path).
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
globalThis.location = { search: '?season2=1' };
const { V3 } = await import('../season.js');
await import('./install.js');
const D = await import('./dailyDrop.js');
const G = await import('../gemsCore.js');
const ST = await import('./stock.js');

// a fixed LOCAL noon, so "tomorrow" is unambiguous whatever TZ the runner is in
const NOON = new Date(2026, 9, 9, 12, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;
const gems = () => G.loadGemState().bal;

test('installed into the V3 holder (ShopV2 + the menu dot read it there)', () => {
  assert.equal(V3.drop, D);
  assert.equal(D.DROP_KEY, 'taw.s2.drop');
});

test('the printed odds sum to 100 and are the approved 55 / 28 / 12 / 4 / 1', () => {
  assert.deepEqual(D.DROP_TIERS.map((t) => t.p), [55, 28, 12, 4, 1]);
  assert.equal(D.DROP_TIERS.reduce((s, t) => s + t.p, 0), 100);
  assert.deepEqual(D.DROP_TIERS.map((t) => t.name), ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC']);
});

test('rollTier maps the rng onto exactly those bands', () => {
  const at = (r) => D.rollTier(() => r);
  assert.equal(at(0), 0);
  assert.equal(at(0.5499), 0);
  assert.equal(at(0.55), 1);
  assert.equal(at(0.8299), 1);
  assert.equal(at(0.83), 2);
  assert.equal(at(0.95), 3);
  assert.equal(at(0.99), 4);
  assert.equal(at(0.999999), 4);
  // a seeded sweep lands within a point of every printed odd
  const n = 100_000;
  const hits = [0, 0, 0, 0, 0];
  for (let i = 0; i < n; i += 1) hits[D.rollTier(() => (i + 0.5) / n)] += 1;
  D.DROP_TIERS.forEach((t, i) => assert.ok(Math.abs((hits[i] / n) * 100 - t.p) < 0.01, `${t.name} ${hits[i]}`));
});

test('the climb: 4 taps, each stays or steps up ONE tier, and always ends exactly on the rolled tier', () => {
  for (let final = 0; final < 5; final += 1) {
    for (let s = 0; s < 400; s += 1) {
      let x = s * 7919 + final;
      const rng = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
      const c = D.planClimb(final, rng);
      assert.equal(c.length, 4);
      assert.equal(c[3], final, `final ${final}: ${c}`);
      let prev = 0;
      for (const t of c) {
        assert.ok(t - prev === 0 || t - prev === 1, `steps 0/1: ${c}`);
        prev = t;
      }
    }
  }
  assert.deepEqual(D.planClimb(4, () => 0.99), [1, 2, 3, 4], 'MYTHIC climbs every tap');
  assert.deepEqual(D.planClimb(0, () => 0), [0, 0, 0, 0], 'COMMON never steps');
});

test('one claim per local day: the 2nd claim pays nothing; the roll is saved on the first tap (no rerolls)', () => {
  mem.clear();
  G.saveGemState({ ...G.loadGemState(), bal: 100 });
  assert.equal(D.dropReady(NOON), true);
  const o = D.openDrop(NOON, () => 0.7); // RARE (55 … 83)
  assert.deepEqual(o, { ok: true, tier: 1 });
  assert.equal(D.openDrop(NOON + 1000, () => 0.999).tier, 1, 'reopening mid-climb replays the same tier');
  assert.equal(D.dropReady(NOON), true, 'still READY until the 4th tap claims');
  const c = D.claimDrop(NOON + 2000);
  assert.deepEqual(c, { ok: true, tier: 1, gems: 30 });
  assert.equal(gems(), 130);
  assert.equal(D.dropReady(NOON + 3000), false);
  assert.deepEqual(D.claimDrop(NOON + 4000), { ok: false, reason: 'claimed', tier: 1 });
  assert.deepEqual(D.openDrop(NOON + 4000).reason, 'claimed');
  assert.equal(gems(), 130, 'a second claim the same day pays nothing');
  assert.deepEqual(JSON.parse(mem.get('taw.s2.drop')), { day: D.dayKey(NOON), claimed: true, tier: 1 });
});

test('a new local day resets it (midnight, not 24 h after the claim)', () => {
  mem.clear();
  const late = new Date(2026, 9, 9, 23, 59, 30).getTime();
  D.openDrop(late, () => 0);
  D.claimDrop(late);
  assert.equal(D.dropReady(late), false);
  assert.equal(D.msToReset(late), 30_000);
  assert.equal(D.formatCountdown(D.msToReset(late)), '00:00:30');
  assert.equal(D.formatCountdown(13 * 3600_000 + 42 * 60_000 + 7_000), '13:42:07');
  const next = new Date(2026, 9, 10, 0, 0, 1).getTime();
  assert.equal(D.dropReady(next), true, '31 s later it is a new day');
  assert.deepEqual(D.readDrop(next), { day: '2026-10-10', claimed: false, tier: null });
  assert.equal(D.dropReady(NOON + DAY), true);
});

test('the payouts: COMMON 15 / RARE 30 / EPIC 60 / LEGENDARY 150 gems; MYTHIC = ×10 OVERDRIVE for 5 min (the STOCK path)', () => {
  const pays = [];
  for (let tier = 0; tier < 4; tier += 1) {
    mem.clear();
    G.saveGemState({ ...G.loadGemState(), bal: 0 });
    mem.set('taw.s2.drop', JSON.stringify({ day: D.dayKey(NOON), claimed: false, tier }));
    D.claimDrop(NOON);
    pays.push(gems());
  }
  assert.deepEqual(pays, [15, 30, 60, 150]);
  assert.deepEqual([0, 1, 2, 3, 4].map(D.payText), ['+15 GEMS', '+30 GEMS', '+60 GEMS', '+150 GEMS', 'OVERDRIVE ×10 · 5 MIN']);
  mem.clear();
  G.saveGemState({ ...G.loadGemState(), bal: 0 });
  mem.set('taw.s2.drop', JSON.stringify({ day: D.dayKey(NOON), claimed: false, tier: 4 }));
  assert.deepEqual(D.claimDrop(NOON), { ok: true, tier: 4, overdrive: { mult: 10, min: 5 } });
  assert.equal(gems(), 0, 'MYTHIC pays no gems');
  const b = JSON.parse(mem.get(ST.BOOST1_KEY));
  assert.deepEqual(b, { until: NOON + 5 * 60_000, mult: 10 });
  // time stacks, the multiplier never does — exactly like a 2nd STOCK buy
  ST.grantOverdrive(10, 5, NOON + 60_000);
  assert.deepEqual(JSON.parse(mem.get(ST.BOOST1_KEY)), { until: NOON + 10 * 60_000, mult: 10 });
});

test('a corrupt / foreign row reads as today\'s fresh drop', () => {
  mem.set('taw.s2.drop', '{oops');
  assert.deepEqual(D.readDrop(NOON), { day: D.dayKey(NOON), claimed: false, tier: null });
  mem.set('taw.s2.drop', JSON.stringify({ day: D.dayKey(NOON), claimed: false, tier: 9 }));
  assert.equal(D.readDrop(NOON).tier, null);
});
