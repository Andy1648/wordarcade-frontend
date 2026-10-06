// season2Convert.test.js — THE SEASON 2 CONVERSION, CLIENT HALF, WITH THE FLAG ON (v3/convertLocal.js run by install.js,
// v3/season2Update.js's server half + card plan). The flag is fixed at module load, so this file turns it on and seeds a
// SEASON-1 save BEFORE importing install.js (node --test: one process per file) — exactly like a browser at the flip:
// install maps the season keys and converts the save before anything reads it. Flag OFF: season2Off.test.js.
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

// the season-1 save at the flip: R13, KEY 6, LV300 at 40% of the bar, 5,000 wins, 900 gems — plus identity, settings,
// marks, achievements, words / letters, and a pre-launch season-2 test save
const SEASON1 = {
  'taw.econ': '12', 'taw.xp': '{"lv":300,"f":0.4,"rc":13,"v":10}', 'taw.xpv10': '{"lv":300,"f":0.4,"rc":13,"v":10}',
  'taw.rebirths': '13', 'taw.keytier': '6', 'taw.wins': '5000', 'taw.winsLifetime': '987654', 'taw.winsCarry': '0.5',
  'taw.gems': '{"v":1,"bal":900,"peak":300,"streak":2,"mig":1}', 'taw.records': '{"maxLevel":612}', 'taw.claims': '[]',
  'taw.markRolls': '{"marks":{"m1":1}}', 'taw.achievements': '{"a":1}', 'taw.letters': '99999', 'taw.mastery.chain': '120',
  'taw.lb.secret': 'a'.repeat(48), 'taw.lb.profile': '{"id":"p1","username":"snapplemelon"}', 'taw.reduceMotion': '1',
  'taw.s2.rebirths': '2', 'taw.s2.xp': '{"lv":50,"f":0,"rc":2,"v":10}',
};
for (const [k, v] of Object.entries(SEASON1)) mem.set(k, v);

const S = await import('../season.js');
await import('./install.js');
const L = await import('./convertLocal.js');
const U = await import('./season2Update.js');
const XP = await import('../xp.js');
const WINS = await import('../wins.js');
const GEMS = await import('../gemsCore.js');
const STORE = await import('./store.js');
const HOOKS = await import('./hooks.js');

const conv = () => JSON.parse(mem.get(L.CONV_KEY));

test('the flag is on, the flip line is still off', () => {
  assert.equal(S.SEASON2, true);
  assert.equal(S.SEASON2_LIVE, false);
});

test('AT INSTALL the season-1 save converted: R13 KEY6 → R10 ★0 P9; level, wins, gems kept as-is', () => {
  const c = conv();
  assert.equal(c.st, 'pending');
  assert.equal(c.had, true);
  assert.deepEqual(c.from, { rebirths: 13, keyTier: 6, level: 300, wins: 5000, gems: 900 });
  assert.deepEqual(c.to, { rebirths: 10, stars: 0, power: 9, level: 300, wins: 5000 });
  // the live modules (through the mapped storage) read the converted season-2 save
  assert.equal(XP.getRebirths(), 10);
  assert.equal(XP.getKeyTier(), 9, 'POWER');
  assert.equal(XP.loadProgress().level, 300);
  assert.ok(Math.abs(XP.loadProgress().frac - 0.4) < 1e-9, 'the bar fraction is kept');
  assert.equal(WINS.getWins(), 5000);
  assert.equal(WINS.getWinsLifetime(), 987654);
  assert.equal(GEMS.getGems(), 900);
  assert.equal(STORE.getStarsV3(), 0);
});

test('NO WIPE: every season-1 key is byte-for-byte what it was; nothing outside taw.s2.* was written', () => {
  for (const [k, v] of Object.entries(SEASON1)) {
    if (k.startsWith('taw.s2.')) continue;
    assert.equal(mem.get(k), v, k);
  }
  const added = [...mem.keys()].filter((k) => !(k in SEASON1));
  for (const k of added) assert.ok(k.startsWith('taw.s2.'), `only season-2 keys are added (${k})`);
  // the pre-launch season-2 test save was kept aside, not lost
  assert.deepEqual(JSON.parse(mem.get(L.PRECONV_KEY)), { 'taw.s2.rebirths': '2', 'taw.s2.xp': '{"lv":50,"f":0,"rc":2,"v":10}' });
  // claims (the season-1 inbox) are not carried into season 2
  assert.equal(mem.has('taw.s2.claims'), false);
});

test('ONE-SHOT: converting again changes nothing (play since the flip is never overwritten)', () => {
  XP.saveRebirths(11); // played on in season 2
  const again = L.convertLocal();
  assert.equal(again.st, 'pending');
  assert.equal(XP.getRebirths(), 11);
  XP.saveRebirths(10);
});

test('RESET ALL PROGRESS never re-converts the season-1 save back in (the cookie mirror)', () => {
  const snapshot = new Map(mem);
  // a season-2 reset clears taw.s2.* (the mapped season-1 keys survive it) — then the next boot
  for (const k of [...mem.keys()]) if (k.startsWith('taw.s2.')) mem.delete(k);
  const out = L.convertLocal({ cookie: () => true });
  assert.equal(out.st, 'shown');
  assert.equal(out.had, false);
  assert.equal(mem.get('taw.s2.rebirths'), undefined, 'no season-2 progress written back');
  mem.clear();
  for (const [k, v] of snapshot) mem.set(k, v);
});

test('a NEW player (no season-1 save) gets no conversion and no card', () => {
  const store = new Map();
  const shim = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } };
  const o = L.convertLocal({ storage: shim, cookie: () => false, setCookie: () => {} });
  assert.deepEqual([o.st, o.had], ['none', false]);
  assert.equal(U.planCard(o), null);
  assert.deepEqual([...store.keys()], [L.CONV_KEY]);
});

test('the UPDATE card plan: R13 → R10 · ★0 · P9 (KEY 6), kept level', () => {
  assert.deepEqual(U.planCard(conv()), { before: { rebirths: 13, keyTier: 6 }, after: { rebirths: 10, stars: 0, power: 9, level: 300 }, starsAdded: 0 });
  assert.equal(U.planCard({ ...conv(), st: 'shown' }), null);
});

test('SERVER HALF: the server\'s converted numbers win on an untouched save (one reload); seen → no card', async () => {
  const snapshot = new Map(mem);
  const calls = [];
  const shown = [];
  let reloads = 0;
  const rpc = async (fn, body) => {
    calls.push([fn, body]);
    if (fn === 'lb_season2_conv') return { found: true, rebirths_before: 29, stars_before: 0, rebirths: 10, stars: 1, seen: false };
    return { ok: true };
  };
  const boot = (o = {}) => U.bootSeason2Update({ enabled: true, caps: async () => ({ season2Convert: true }), rpc, reload: () => { reloads += 1; }, show: (p) => shown.push(p), secret: 's'.repeat(48), hasProfile: true, cookie: () => false, ...o });
  assert.equal(await boot(), false, 'reloading onto the server numbers');
  assert.equal(reloads, 1);
  assert.equal(XP.getRebirths(), 10);
  assert.equal(STORE.getStarsV3(), 1, 'the server ★ (R29 on the board) — authoritative');
  assert.equal(XP.getKeyTier(), 9);
  assert.equal(conv().srv, 1);
  assert.deepEqual(conv().server, { before: 29, rebirths: 10, stars: 1 });
  // the reload's boot: the server half is done (never asked twice), the card shows ONCE with the server numbers
  assert.equal(await boot(), true);
  assert.equal(calls.filter(([f]) => f === 'lb_season2_conv').length, 1);
  assert.equal(shown.length, 1);
  assert.deepEqual(shown[0].before, { rebirths: 29, keyTier: 6 });
  assert.deepEqual(shown[0].after, { rebirths: 10, stars: 1, power: 9, level: 300 });
  // marked shown → never again
  U.markShown(HOOKS.rawStorage(localStorage), { rpc, secret: 's'.repeat(48) }); // what showUpdate does on mount
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(conv().st, 'shown');
  assert.ok(calls.some(([f]) => f === 'lb_season2_seen'));
  assert.equal(await boot(), true);
  assert.equal(shown.length, 1);
  mem.clear();
  for (const [k, v] of snapshot) mem.set(k, v);
});

test('SERVER HALF leaves a save that already moved on alone; seen on another device → no card; offline → retried', async () => {
  const snapshot = new Map(mem);
  XP.saveRebirths(0); // ascended / played since the conversion
  const shown = [];
  let reloads = 0;
  const rpc = async () => ({ found: true, rebirths_before: 13, stars_before: 0, rebirths: 10, stars: 0, seen: true });
  const ok = await U.bootSeason2Update({ enabled: true, caps: async () => ({ season2Convert: true }), rpc, reload: () => { reloads += 1; }, show: (p) => shown.push(p), secret: 's'.repeat(48), hasProfile: true, cookie: () => false });
  assert.equal(ok, true);
  assert.equal(reloads, 0);
  assert.equal(XP.getRebirths(), 0, 'never pulled back');
  assert.equal(conv().st, 'shown', 'seen on another device');
  assert.equal(shown.length, 0);
  mem.clear();
  for (const [k, v] of snapshot) mem.set(k, v);
  // offline: no change, the card still shows from the local numbers, the server is asked again next boot
  const off = await U.bootSeason2Update({ enabled: true, caps: async () => ({ season2Convert: true }), rpc: async () => { throw new Error('http_503'); }, reload: () => assert.fail('no reload'), show: (p) => shown.push(p), secret: 's'.repeat(48), hasProfile: true, cookie: () => false });
  assert.equal(off, true);
  assert.equal(conv().srv, 0);
  assert.equal(shown.length, 1);
  mem.clear();
  for (const [k, v] of snapshot) mem.set(k, v);
});
