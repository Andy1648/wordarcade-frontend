// season2Boot.test.js — THE SEASON 2 RESET, CLIENT HALF, WITH THE FLAG ON (v3/season2Boot.js; 023_season2_reset.sql).
// The flag is fixed at module load, so this file turns it on BEFORE importing (node --test: one process per file) and
// installs v3 exactly like main.jsx — the storage layer then maps taw.xp → taw.s2.xp, and the wipe must still remove
// the RAW season-1 keys. Flag OFF is pinned in season2Off.test.js.
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

const S = await import('../season.js');
await import('./install.js');
const B = await import('./season2Boot.js');
const G = await import('../gemsCore.js');
const HOOKS = await import('./hooks.js');
const rawFor = () => HOOKS.rawStorage(globalThis.localStorage);
const { decideSeason2Claim, peekSeason2Grant } = await import('../../leaderboard/season2Rules.js');

const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const raw = () => Object.fromEntries(mem);
function seasonOneSave() {
  mem.clear();
  // the season-1 save (raw keys) + some pre-launch season-2 testing (taw.s2.*) + identity + settings
  for (const [k, v] of Object.entries({
    'taw.econ': '12', 'taw.xp': '{"level":300}', 'taw.rebirths': '7', 'taw.wins': '123456', 'taw.gems': '{"bal":900}',
    'taw.owned': '["pop-fire"]', 'taw.markRolls': '{}', 'taw.achievements': '{}', 'taw.letters': '99999', 'taw.keytier': '4',
    'taw.s2.xp': '{"level":50}', 'taw.s2.rebirths': '1', 'taw.s2.gems': '{"bal":40,"mig":1}', 'taw.s2.stars': '2', 'taw.s2.count': '{}',
    'taw.lb.secret': 'a'.repeat(48), 'taw.lb.profile': '{"id":"p1","username":"NoBuffCookies"}',
    'taw.reduceMotion': '1', 'taw.theme': 'midnight', 'taw.themesRetired': '1', 'taw.audioVolume': '0.4', 'taw.musicMuted': '1',
    'taw.sfxEvents': '0', 'taw.clack': 'soft', 'taw.flag.rolls': '1', 'taw.tut.init': '1', 'taw.seenMenu': '1', 'other.app': 'x',
  })) mem.set(k, v);
}
/** A fake server holding one grant row, run through the JS mirror of the SQL. */
function fakeServer(grant) {
  const db = { grant, calls: [] };
  db.rpc = async (fn, body) => {
    db.calls.push([fn, body]);
    if (db.down) throw new Error('http_503');
    if (fn === 'lb_season2_grant') return peekSeason2Grant(db.grant);
    if (fn === 'lb_season2_claim') {
      const out = decideSeason2Claim(db.grant, body.p_request_id);
      db.grant = out.grant;
      return out.result;
    }
    throw new Error(`unexpected ${fn}`);
  };
  return db;
}

test('the flag is on and the storage layer maps the season keys (the setup this file relies on)', () => {
  assert.equal(S.SEASON2, true);
  assert.equal(S.SEASON2_LIVE, true, 'the ONE flip line is ON (Oct 8)'); // node still opts in per test
  mem.clear();
  localStorage.setItem('taw.xp', 'x');
  assert.ok(mem.has('taw.s2.xp') && !mem.has('taw.xp'));
});

test('needsSeason2Wipe: anything below econ 13 (or unstamped) is a pre-season-2 save', () => {
  assert.equal(B.needsSeason2Wipe(null), true);
  assert.equal(B.needsSeason2Wipe('12'), true);
  assert.equal(B.needsSeason2Wipe('garbage'), true);
  assert.equal(B.needsSeason2Wipe('13'), false);
});

test('a season-1 save is wiped — season-1 AND taw.s2.* — except the identity and the settings; econ 13; welcome pending', () => {
  seasonOneSave();
  const out = B.wipeForSeason2(rawFor());
  assert.equal(out.oldRebirths, 7);
  assert.equal(out.hadSave, true);
  const left = raw();
  for (const k of ['taw.xp', 'taw.rebirths', 'taw.wins', 'taw.gems', 'taw.owned', 'taw.markRolls', 'taw.achievements', 'taw.letters',
    'taw.keytier', 'taw.s2.xp', 'taw.s2.rebirths', 'taw.s2.gems', 'taw.s2.stars', 'taw.s2.count']) {
    assert.ok(!(k in left), `${k} wiped`);
  }
  for (const k of ['taw.lb.secret', 'taw.lb.profile', 'taw.reduceMotion', 'taw.theme', 'taw.themesRetired', 'taw.audioVolume',
    'taw.musicMuted', 'taw.sfxEvents', 'taw.clack', 'taw.flag.rolls', 'taw.tut.init', 'taw.seenMenu', 'other.app']) {
    assert.ok(k in left, `${k} kept`);
  }
  assert.equal(left['taw.econ'], '13');
  const w = JSON.parse(left['taw.s2.welcome']);
  assert.equal(w.st, 'pending');
  assert.equal(w.r, 7);
  assert.ok(w.req);
});

test('boot: before the server reset ran (no caps.season2_reset) nothing is touched', async () => {
  seasonOneSave();
  const before = raw();
  const shown = [];
  const ok = await B.bootSeason2({ season2: true, enabled: true, caps: async () => ({ season2Reset: false }), show: (p) => shown.push(p), reload: () => assert.fail('no reload') });
  assert.equal(ok, true);
  assert.deepEqual(raw(), before);
  assert.equal(shown.length, 0);
});

test('boot: a season-1 save is wiped and the page reloads ONCE; the next boot shows the welcome (server numbers)', async () => {
  seasonOneSave();
  const srv = fakeServer({ gems: 580, rebirths: 7, claimed_at: null, claim_request: null });
  let reloads = 0;
  const shown = [];
  const opts = { season2: true, enabled: true, caps: async () => ({ season2Reset: true }), rpc: srv.rpc, show: (p) => shown.push(p), reload: () => { reloads += 1; } };
  assert.equal(await B.bootSeason2(opts), false, 'reloading into the wiped save');
  assert.equal(reloads, 1);
  assert.equal(shown.length, 0);
  assert.equal(raw()['taw.lb.profile'], '{"id":"p1","username":"NoBuffCookies"}', 'the username survives');
  // the reloaded boot: econ 13 → no second wipe; the welcome shows with the SERVER's gift
  assert.equal(await B.bootSeason2(opts), true);
  assert.equal(reloads, 1);
  assert.equal(shown.length, 1);
  assert.deepEqual([shown[0].server, shown[0].gems, shown[0].oldR], [true, 580, 7]);
});

test('collect: credits the server gems ONCE; a second collect / a reload credits nothing', async () => {
  seasonOneSave();
  B.wipeForSeason2(rawFor());
  const srv = fakeServer({ gems: 580, rebirths: 7, claimed_at: null, claim_request: null });
  const secret = 'a'.repeat(48);
  const plan = await B.planWelcome({ rpc: srv.rpc, secret, hasProfile: true, cookie: () => false });
  assert.equal(plan.gems, 580);
  const g0 = G.getGems();
  const r1 = await B.collectWelcome(plan, { rpc: srv.rpc, secret });
  assert.deepEqual(r1, { ok: true, gems: 580 });
  assert.equal(G.getGems(), g0 + 580);
  assert.ok(mem.has('taw.s2.gems'), 'the gems land in the SEASON-2 wallet');
  // collect again: the local flag says done → no call, no credit
  const n = srv.calls.length;
  const r2 = await B.collectWelcome(plan, { rpc: srv.rpc, secret });
  assert.equal(r2.ok, false);
  assert.equal(srv.calls.length, n);
  assert.equal(G.getGems(), g0 + 580);
  // a reload: the welcome is done → nothing to show
  assert.equal(await B.planWelcome({ rpc: srv.rpc, secret, hasProfile: true, cookie: () => false }), null);
});

test('server-flagged: another device (or a lost local flag) gets no welcome, and a claim there credits nothing', async () => {
  const srv = fakeServer({ gems: 340, rebirths: 1, claimed_at: Date.now(), claim_request: UUID(1) });
  const secret = 'b'.repeat(48);
  seasonOneSave();
  B.wipeForSeason2(rawFor());
  // the peek says claimed → no welcome, flag set
  assert.equal(await B.planWelcome({ rpc: srv.rpc, secret, hasProfile: true, cookie: () => false }), null);
  assert.equal(B.readWelcome().st, 'done');
  // a welcome already on screen when the other device claimed: the claim says 'claimed' → nothing credited
  seasonOneSave();
  B.wipeForSeason2(rawFor());
  const g0 = G.getGems();
  const r = await B.collectWelcome({ server: true, gems: 340, oldR: 1, req: UUID(9) }, { rpc: srv.rpc, secret });
  assert.deepEqual([r.ok, r.reason], [false, 'claimed']);
  assert.equal(G.getGems(), g0);
  assert.equal(B.readWelcome().st, 'done');
});

test('a lost answer: the retry with the SAME request id is the same claim (credited once, not twice)', async () => {
  seasonOneSave();
  B.wipeForSeason2(rawFor());
  const srv = fakeServer({ gems: 300, rebirths: 0, claimed_at: null, claim_request: null });
  const secret = 'c'.repeat(48);
  const plan = await B.planWelcome({ rpc: srv.rpc, secret, hasProfile: true, cookie: () => false });
  // the server claims, the answer is lost
  await srv.rpc('lb_season2_claim', { p_secret: secret, p_request_id: plan.req });
  const g0 = G.getGems();
  const r = await B.collectWelcome(plan, { rpc: srv.rpc, secret });
  assert.deepEqual(r, { ok: true, gems: 300 });
  assert.equal(G.getGems(), g0 + 300);
});

test('offline: the claim throws → retry, nothing credited, the welcome stays pending', async () => {
  seasonOneSave();
  B.wipeForSeason2(rawFor());
  const srv = fakeServer({ gems: 300, rebirths: 0, claimed_at: null, claim_request: null });
  const plan = await B.planWelcome({ rpc: srv.rpc, secret: 'd'.repeat(48), hasProfile: true, cookie: () => false });
  srv.down = true;
  const g0 = G.getGems();
  const r = await B.collectWelcome(plan, { rpc: srv.rpc, secret: 'd'.repeat(48) });
  assert.equal(r.retry, true);
  assert.equal(G.getGems(), g0);
  assert.equal(B.readWelcome().st, 'pending');
});

test('no board name: round5(300 + 40 × old R) on the local old run (R7 → 580), once, keyed by the local flag (and its cookie mirror)', async () => {
  seasonOneSave();
  mem.delete('taw.lb.profile');
  B.wipeForSeason2(rawFor());
  const rpc = async () => assert.fail('no server call without a name');
  const plan = await B.planWelcome({ rpc, secret: null, hasProfile: false, cookie: () => false });
  assert.deepEqual([plan.server, plan.gems, plan.oldR], [false, 580, 7]);
  const g0 = G.getGems();
  assert.deepEqual(await B.collectWelcome(plan, { rpc }), { ok: true, gems: 580 });
  assert.equal(G.getGems(), g0 + 580);
  assert.equal(await B.planWelcome({ rpc, hasProfile: false, cookie: () => false }), null, 'once');
  // RESET ALL PROGRESS wiped the local flag: the cookie mirror still says done
  mem.set('taw.s2.welcome', JSON.stringify({ st: 'pending', r: 0 }));
  assert.equal(await B.planWelcome({ rpc, hasProfile: false, cookie: () => true }), null);
});

test('a fresh browser (no save at all) is stamped without a reload and gets the welcome', async () => {
  mem.clear();
  let reloads = 0;
  const shown = [];
  const ok = await B.bootSeason2({ season2: true, enabled: true, caps: async () => ({ season2Reset: true }), show: (p) => shown.push(p), reload: () => { reloads += 1; } });
  assert.equal(ok, true);
  assert.equal(reloads, 0);
  assert.equal(raw()['taw.econ'], '13');
  assert.equal(shown.length, 1);
  assert.equal(shown[0].gems, 300);
});
