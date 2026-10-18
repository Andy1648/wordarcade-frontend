// unlisted.test.js — THE UNLISTED: the grant (once, never out of season), the serial (server-only, "#0042"), the index
// MASK (riddles only — no name, art or odds for an unfound gear; "?/?" until the first find), the season gear's
// detector, and that the tier never touches the roll pool or the odds.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UNLISTED_GEARS, UNLISTED_KEY, grantUnlisted, setUnlistedSerial, formatSerial, cleanSerial, unlistedIndex, loadUnlisted,
  pendingSerialIds, grantForPastSecrets, bootUnlisted, gearForSecret, wearUnlisted, ownsUnlisted, normalizeUnlisted,
  SECRETS_FOUND_KEY,
} from './unlisted.js';
import { doublePairs, createWordTracker } from './seasonSecret.js';
import { isTripleDouble, TRIPLE_DOUBLE_WORDS } from './tripleDouble.js';
import { emitReveal, subscribeReveal, patchRevealSerial, peekReveal, clearReveal } from './revealBus.js';
import { claimSerial } from './serial.js';
import { SECRETS } from '../secrets/secrets.js';

function mem(init = {}) {
  const map = new Map(Object.entries(init));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), _map: map };
}
const T = Date.UTC(2026, 9, 17, 12);

// ------------------------------------------------------------------------------------------- catalog
test('six gears: one per word-secret + one season gear; ids pass the showcase id rule', () => {
  assert.equal(UNLISTED_GEARS.length, 6);
  for (const sid of Object.keys(SECRETS)) assert.ok(gearForSecret(sid), `secret ${sid} grants a gear`);
  assert.equal(UNLISTED_GEARS.filter((g) => g.season != null).length, 1);
  for (const g of UNLISTED_GEARS) {
    assert.match(g.id, /^mk-[a-z0-9-]{1,24}$/, 'lb_showcase_set keeps only ^mk-[a-z0-9-]{1,24}$');
    assert.match(g.id, /^mk-ul-[a-z0-9-]{1,20}$/, '052 unlisted_pool check');
    assert.equal(g.tier, 'unlisted');
    assert.ok(g.riddle.length > 0 && g.riddle.length <= 48, `${g.id} riddle is one short line`);
    assert.equal(g.riddle, g.riddle.toUpperCase());
  }
});

// ------------------------------------------------------------------------------------------- grant
test('grant: fresh the first time, null after (once per gear)', () => {
  const s = mem();
  const a = grantUnlisted('mk-ul-mirror', { word: 'racecar', now: T, storage: s });
  assert.ok(a && a.fresh);
  assert.equal(a.gear.name, 'MIRROR');
  assert.equal(a.word, 'RACECAR');
  assert.equal(a.serial, null, 'a serial is never invented locally');
  assert.equal(grantUnlisted('mk-ul-mirror', { word: 'level', now: T + 1, storage: s }), null);
  assert.equal(loadUnlisted(s).owned['mk-ul-mirror'].word, 'RACECAR', 'the first find is kept');
  assert.ok(ownsUnlisted('mk-ul-mirror', s));
});

test('grant: unknown id → null; a season gear only in its season (never returns)', () => {
  const s = mem();
  assert.equal(grantUnlisted('mk-origin', { storage: s }), null);
  assert.equal(grantUnlisted('mk-ul-tripledouble', { season: 3, storage: s }), null, 'season over');
  assert.ok(grantUnlisted('mk-ul-tripledouble', { season: 2, word: 'bookkeeper', storage: s }));
});

test('grant: a junk word is dropped, the gear still granted', () => {
  const s = mem();
  const g = grantUnlisted('mk-ul-wishbone', { word: '<script>', storage: s });
  assert.ok(g);
  assert.equal(g.word, null);
});

test('grant survives blocked storage (no throw)', () => {
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.doesNotThrow(() => grantUnlisted('mk-ul-og', { storage: bad }));
});

test('back-fill: secrets found before the tier existed grant their gear once; the season gear is never back-filled', () => {
  const s = mem({ [SECRETS_FOUND_KEY]: JSON.stringify({ found: ['newgrounds', 'palindrome', 'tripledouble', 'nope'] }) });
  assert.deepEqual(bootUnlisted({ storage: s, now: T }).sort(), ['mk-ul-mirror', 'mk-ul-og']);
  assert.deepEqual(bootUnlisted({ storage: s, now: T }), [], 'idempotent');
  assert.deepEqual(grantForPastSecrets(['tripledouble'], { storage: s }), []);
  assert.deepEqual(bootUnlisted({ storage: mem() }), []);
});

test('wear: only an OWNED unlisted gear can be worn (taw.mark)', () => {
  const s = mem();
  assert.equal(wearUnlisted('mk-ul-og', s), false);
  grantUnlisted('mk-ul-og', { storage: s });
  assert.equal(wearUnlisted('mk-ul-og', s), true);
  assert.equal(s.getItem('taw.mark'), 'mk-ul-og');
  assert.equal(wearUnlisted('mk-origin', s), false);
});

// ------------------------------------------------------------------------------------------- serial
test('serial: "#0042" format, pending "#····", invalid rejected', () => {
  assert.equal(formatSerial(42), '#0042');
  assert.equal(formatSerial(1), '#0001');
  assert.equal(formatSerial(12345), '#12345');
  assert.equal(formatSerial(null), '#····');
  for (const bad of [0, -1, 1.5, 'x', 100000, NaN, undefined]) assert.equal(cleanSerial(bad), null, String(bad));
});

test('serial: stored only for an owned gear; pending list shrinks', () => {
  const s = mem();
  assert.equal(setUnlistedSerial('mk-ul-og', 7, s), null, 'not owned');
  grantUnlisted('mk-ul-og', { storage: s, now: T });
  grantUnlisted('mk-ul-midas', { storage: s, now: T + 5 });
  assert.deepEqual(pendingSerialIds(s).sort(), ['mk-ul-midas', 'mk-ul-og']);
  assert.equal(setUnlistedSerial('mk-ul-og', 'nope', s), null);
  assert.equal(setUnlistedSerial('mk-ul-og', 7, s), 7);
  assert.deepEqual(pendingSerialIds(s), ['mk-ul-midas']);
  assert.equal(loadUnlisted(s).owned['mk-ul-og'].serial, 7);
});

test('claimSerial: asks lb_unlisted_claim with the secret + gear; a failure never throws (stays pending)', async () => {
  const calls = [];
  const ok = { getSecret: () => 'a'.repeat(48), rpc: async (fn, body) => { calls.push([fn, body]); return { ok: true, serial: 42 }; } };
  await claimSerial('mk-ul-og', { client: ok });
  assert.deepEqual(calls[0], ['lb_unlisted_claim', { p_secret: 'a'.repeat(48), p_gear: 'mk-ul-og' }]);
  const fail = { getSecret: () => 'a'.repeat(48), rpc: async () => { throw new Error('http_404'); } };
  assert.equal(await claimSerial('mk-ul-og', { client: fail }), null, 'a 404 (052 not run) never throws');
  const noSecret = { getSecret: () => null, rpc: async () => { throw new Error('must not be called'); } };
  assert.equal(await claimSerial('mk-ul-og', { client: noSecret }), null);
});

// ------------------------------------------------------------------------------------------- index mask
test('index: "?/?" and pure riddles before the first find — no name, art, serial or odds', () => {
  const idx = unlistedIndex({ storage: mem() });
  assert.equal(idx.label, '?/?');
  assert.equal(idx.total, null, 'the total is the secret');
  assert.equal(idx.tiles.length, 6);
  for (const t of idx.tiles) {
    assert.equal(t.owned, false);
    assert.equal(t.name, '???');
    assert.equal(t.art, null);
    assert.equal(t.serial, null);
    assert.ok(t.riddle);
    const keys = Object.keys(t).join(' ');
    assert.doesNotMatch(keys, /odds|oneIn|chance|x\b/i, 'no odds field exists to leak');
    assert.doesNotMatch(JSON.stringify(t), /1 IN|%/, 'no odds text');
  }
});

test('index: after a find → "1/6", the found tile is named with its serial, the rest stay masked', () => {
  const s = mem();
  grantUnlisted('mk-ul-typewriter', { storage: s });
  setUnlistedSerial('mk-ul-typewriter', 42, s);
  const idx = unlistedIndex({ storage: s });
  assert.equal(idx.label, '1/6');
  const t = idx.tiles.find((x) => x.id === 'mk-ul-typewriter');
  assert.equal(t.name, 'TYPEWRITER');
  assert.equal(t.serialText, '#0042');
  assert.equal(t.art, '/gear/unlisted/typewriter.webp');
  assert.ok(idx.tiles.filter((x) => !x.owned).every((x) => x.name === '???' && x.art === null));
});

test('index: a season gear not found in its season disappears; found, it stays', () => {
  const s = mem();
  assert.equal(unlistedIndex({ storage: s, season: 3 }).tiles.length, 5);
  grantUnlisted('mk-ul-tripledouble', { storage: s, season: 2 });
  const later = unlistedIndex({ storage: s, season: 3 });
  assert.equal(later.tiles.length, 6);
  assert.equal(later.label, '1/6');
});

test('normalize repairs junk', () => {
  assert.deepEqual(normalizeUnlisted(null), { owned: {} });
  const n = normalizeUnlisted({ owned: { 'mk-ul-og': { at: 'x', serial: -3, word: 'ok' }, 'mk-fake': {} } });
  assert.deepEqual(Object.keys(n.owned), ['mk-ul-og']);
  assert.equal(n.owned['mk-ul-og'].serial, null);
  assert.equal(n.owned['mk-ul-og'].word, null, 'lowercase is not a stored word');
  assert.equal(UNLISTED_KEY, 'taw.unlisted');
});

// ------------------------------------------------------------------------------------------- season detector
test('TRIPLE DOUBLE: three separate double pairs, real words only', () => {
  assert.equal(doublePairs('bookkeeper'), 3);
  assert.equal(doublePairs('aaa'), 1);
  assert.ok(isTripleDouble('BOOKKEEPER'));
  assert.ok(isTripleDouble('committee'));
  assert.ok(!isTripleDouble('coffee'), 'two pairs is not enough');
  assert.ok(!isTripleDouble('aabbcc'), 'gibberish is not a find');
  for (const w of TRIPLE_DOUBLE_WORDS) assert.ok(doublePairs(w) >= 3, w);
});

test('word tracker: a boundary closes the word; backspace edits; modifiers ignored', () => {
  const tr = createWordTracker();
  for (const k of 'bookx') tr.onKey(k);
  tr.onKey('Backspace');
  tr.onKey('Shift');
  for (const k of 'keeper') tr.onKey(k);
  assert.equal(tr.current(), 'bookkeeper');
  assert.equal(tr.onKey('Enter'), 'bookkeeper');
  assert.equal(tr.current(), '');
  assert.equal(tr.onKey(' '), null, 'an empty word closes nothing');
});

// ------------------------------------------------------------------------------------------- reveal bus
test('reveal bus: subscribers get the reveal; the serial patches it in place (same key)', () => {
  const seen = [];
  const off = subscribeReveal((r) => seen.push(r));
  const g = UNLISTED_GEARS[0];
  const r = emitReveal({ gear: g, word: 'NEWGROUNDS', serial: null });
  patchRevealSerial(g.id, 9);
  patchRevealSerial('mk-ul-other', 1); // another gear: ignored
  off();
  assert.equal(seen.length, 2);
  assert.equal(seen[1].key, r.key);
  assert.equal(seen[1].serial, 9);
  assert.equal(peekReveal().serial, 9);
  clearReveal(r.key);
  assert.equal(peekReveal(), null);
  assert.equal(emitReveal(null), null);
});

// ------------------------------------------------------------------------------------------- the gear system
test('never rolled: no UNLISTED gear in the roll pool; a worn one pays the PERMANENT main (×3), below ORIGIN', async () => {
  const core = await import('../progress/markRollsCore.js');
  for (const g of UNLISTED_GEARS) {
    assert.equal(core.rollMarkById(g.id), null, `${g.id} is not rollable`);
    assert.equal(core.oneInX(g.id), null, `${g.id} has no odds`);
    assert.equal(core.mainMultOf(g.id, null), 3);
    assert.ok(core.mainMultOf(g.id, null) < core.mainMultOf('mk-origin', null));
    assert.equal(core.markEntry(g.id).tier, 'unlisted');
  }
  assert.ok(core.tierRank('unlisted') > core.tierRank('secret'));
  assert.ok(!core.ROLLABLE_TIERS.includes('unlisted'));
});

test('the index card never prints SECRET odds', async () => {
  const { cardModel, MASKED_ODDS } = await import('../components/markCard/cardModel.js');
  const c = cardModel({ id: 'mk-origin', kind: 'roll', tier: 'secret', name: 'ORIGIN', locked: true });
  assert.equal(c.odds, MASKED_ODDS);
  assert.equal(c.oddsNum, MASKED_ODDS);
  const m = cardModel({ id: 'mk-hydra', kind: 'roll', tier: 'mythic', name: 'HYDRA', locked: true });
  assert.match(m.odds, /^1 IN /, 'the rolled tiers below SECRET keep their published odds');
});
