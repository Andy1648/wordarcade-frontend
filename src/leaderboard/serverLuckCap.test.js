// serverLuckCap.test.js — 061_server_luck_cap.sql: lb_roll clamps the browser's luck to a PER-ACCOUNT cap the server
// builds from what it knows (owned gears, stars, INDEX, worn ROLL LUCK, rebirths) + a fixed allowance for what it can't
// see (BOOST, PERMANENT marks, the STOCK x2). The SQL's table and constants are the game's; serverCap below is the SQL
// line for line, and a legit save's real luck() is never above it (a maxed save, a fresh one, 2,000 random ones).
// claude/sql-sandbox/061-server-luck-cap.mjs runs the SQL itself on PGlite and checks it against these same numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
globalThis.location = { search: '?season2=1' }; // the live season: GEAR OP's stat sizes, the R5 / R7 unlocks, the STOCK

await import('../progress/season.js');
await import('../progress/v3/install.js');
const C = await import('../progress/markRollsCore.js');
const { luck, migrate, LUCK_SOURCES } = await import('../progress/markRolls.js');
const { UNLISTED_IDS } = await import('../unlisted/unlistedIds.js');
const { unlockAt, LUCK_UNLOCK_MULT } = await import('../progress/v3/unlocks.js');
const { STOCK, STOCK_FX_KEY } = await import('../progress/v3/stock.js');
const { MARK2_KEY, S2_PREFIX } = await import('../progress/v3/store.js');
const { MARKS_EQUIPPED_KEY } = await import('../progress/marks.js');

const read = (f) => readFileSync(join(process.cwd(), 'supabase', 'migrations', f), 'utf8').replace(/\r\n/g, '\n');
const sql = read('061_server_luck_cap.sql');
const has = (s) => assert.ok(sql.includes(s), `061 is missing: ${s}`);

// ---- a gear's ROLL LUCK at star 0, in % (its MAIN if that is luckPct + its L substats), as the card pays it
const luck0 = (id) => {
  const st = C.statOf(id, null);
  return (st && st.kind === 'luckPct' ? st.value : 0) + C.substatsOf(id, null).filter((x) => x.kind === 'luckPct').reduce((s, x) => s + x.value, 0);
};
const ROLLED = new Set(C.ROLL_MARKS.map((m) => m.id));
const TIER = new Map(C.ROLL_MARKS.map((m) => [m.id, m.tier]));
const ALL_IDS = [...C.ROLL_MARKS.map((m) => m.id), ...C.PERMANENT_MARKS.map((m) => m.id), ...UNLISTED_IDS];
const LUCK_ROWS = new Map((sql.match(/\('mk-[a-z0-9-]+', [\d.]+\)/g) || []).map((r) => {
  const [, id, v] = r.match(/\('(mk-[a-z0-9-]+)', ([\d.]+)\)/);
  return [id, Number(v)];
}));
const MILESTONE_ROWS = (sql.match(/\('(base|gold|rainbow)', \d+, [\d.]+\)/g) || []).map((r) => {
  const [, track, pct, l] = r.match(/\('(\w+)', (\d+), ([\d.]+)\)/);
  return { track, pct: Number(pct), luck: Number(l) };
});
const constant = (name) => {
  const m = sql.match(new RegExp(`${name} constant [a-z ]+ := ([\\d.]+);`));
  assert.ok(m, `061 has no ${name}`);
  return Number(m[1]);
};
const K = Object.fromEntries(['LUCK_CAP', 'MIN_POOL', 'PIP', 'MAX_PIPS', 'PIP_STEP', 'SHINY_MULT', 'PERM_ALLOW', 'BOOST', 'STOCK_MULT',
  'UNLOCK_MULT', 'UNLOCK_AT', 'MARK2_AT', 'REBIRTH_SLACK'].map((k) => [k, constant(k)]));

/**
 * private.luck_cap, line for line. view = what the SERVER holds: { pre (created before ROLL_CUTOFF), tester, rebirths,
 * stars, owned: [{ id, copies, shiny }] } (gear_owned rows; a gear no longer in the pool is dropped by the join).
 */
function serverCap(view) {
  if (view.pre || view.tester) return K.LUCK_CAP;
  const reb = (view.rebirths || 0) + K.REBIRTH_SLACK;
  const slots = reb >= K.MARK2_AT || (view.stars || 0) >= 1 ? 2 : 1;
  const per = { rare: 5, epic: 3, legendary: 2 };
  const o = (view.owned || []).filter((g) => ROLLED.has(g.id))
    .map((g) => ({ ...g, pips: Math.min(K.MAX_PIPS, Math.floor(Math.max(0, g.copies - 1) / (per[TIER.get(g.id)] || 1))) }));
  const cand = [
    ...o.filter((g) => LUCK_ROWS.has(g.id)).map((g) => (LUCK_ROWS.get(g.id) / 100) * (1 + K.PIP_STEP * g.pips) * (g.shiny ? K.SHINY_MULT : 1)),
    ...[...LUCK_ROWS].filter(([id]) => !ROLLED.has(id)).map(([, v]) => v / 100),
  ].sort((a, b) => b - a);
  const worn = cand.slice(0, slots).reduce((s, v) => s + v, 0);
  const n = { base: o.length, gold: o.filter((g) => g.pips > 0).length, rainbow: o.filter((g) => g.pips >= K.MAX_PIPS).length };
  const ms = MILESTONE_ROWS.filter((m) => (n[m.track] * 100) / K.MIN_POOL >= m.pct - 1e-9).reduce((s, m) => s + m.luck, 0);
  const pipAdd = o.reduce((s, g) => s + g.pips, 0) * K.PIP;
  const unlock = reb >= K.UNLOCK_AT || (view.stars || 0) >= 1 ? K.UNLOCK_MULT : 1;
  return Math.min(K.LUCK_CAP, (1 + K.PERM_ALLOW + K.BOOST + pipAdd + ms + worn) * unlock * K.STOCK_MULT);
}

// ---- drive the REAL luck() through the save keys it reads -------------------------------------------------------------
/** save = { marks: { id: { n, p, shiny } }, main, mark2, rebirths, stock, boost, permanentOwned, perms: [ids] } → luck() */
function clientLuck(save) {
  mem.clear();
  const raw = { v: C.ROLL_STATE_VERSION, rolls: 0, marks: save.marks, milestones: [] };
  const state = migrate(C.normalize(raw)); // migrate() pays every INDEX milestone the state has reached
  if (save.milestones) state.milestones = [...new Set([...state.milestones, ...save.milestones])];
  localStorage.setItem(C.ROLL_STATE_KEY, JSON.stringify(state));
  if (save.main) localStorage.setItem(MARKS_EQUIPPED_KEY, save.main);
  if (save.mark2) localStorage.setItem(MARK2_KEY, save.mark2);
  if (save.perms) localStorage.setItem('taw.permanentMarks', JSON.stringify(save.perms));
  localStorage.setItem(`${S2_PREFIX}rebirths`, String(save.rebirths || 0));
  if (save.stock) localStorage.setItem(STOCK_FX_KEY, JSON.stringify({ luck: Date.now() + 600000 }));
  return luck(C.loadRollState(), { permanentOwned: save.permanentOwned || 0, boost: !!save.boost });
}
const viewOf = (save, rebirths = save.rebirths) => ({
  rebirths, stars: 0, owned: Object.entries(save.marks).map(([id, e]) => ({ id, copies: e.n, shiny: !!e.shiny })),
});
const earnedPips = (id, n) => Math.min(C.MAX_PIPS, Math.floor(Math.max(0, n - 1) / C.DUPES_PER_PIP[TIER.get(id)]));

test('the server luck table IS the game: every gear with ROLL LUCK, its star-0 % (season 2 sizes), none extra', () => {
  const want = ALL_IDS.filter((id) => luck0(id) > 0);
  for (const id of want) assert.equal(LUCK_ROWS.get(id), luck0(id), `061 gear_luck for ${id}`);
  assert.equal(LUCK_ROWS.size, want.length, 'no extra gear in gear_luck');
  assert.ok(LUCK_ROWS.get('mk-shamrock') >= 400, 'season 2 sizes (GEAR OP), not season 1');
});

test('the cap constants are the game constants (pips, shiny, milestones, boost, permanents, stock, unlocks)', () => {
  assert.equal(K.PIP, LUCK_SOURCES.pip);
  assert.equal(K.MAX_PIPS, C.MAX_PIPS);
  assert.equal(K.PIP_STEP, C.PIP_STEP);
  assert.equal(K.SHINY_MULT, C.SHINY_MULT);
  assert.equal(K.BOOST, LUCK_SOURCES.boost);
  assert.ok(Math.abs(K.PERM_ALLOW - LUCK_SOURCES.permanent * C.PERMANENT_MARKS.length) < 1e-9, 'every PERMANENT mark');
  assert.equal(K.STOCK_MULT, STOCK.find((s) => s.fx === 'luck').mult);
  assert.equal(K.UNLOCK_MULT, LUCK_UNLOCK_MULT);
  assert.equal(K.UNLOCK_AT, unlockAt('luck'));
  assert.equal(K.MARK2_AT, unlockAt('mark2'));
  assert.equal(K.LUCK_CAP, 10, 'the hard ceiling stays 038\'s');
  for (const [t, d] of Object.entries(C.DUPES_PER_PIP)) if (d > 1) has(`when '${t}' then ${d}`);
  assert.deepEqual(MILESTONE_ROWS, C.COLLECTION_MILESTONES.map((m) => ({ track: m.track, pct: m.pct, luck: m.luck })));
  has("ROLL_CUTOFF constant timestamptz := timestamptz '2026-10-13 00:00:00+00';");
  has('WRITE-ONLY: Claude never runs migrations');
});

test('MIN_POOL is the smallest pool any migration ever seeded (a milestone paid on it stays paid)', () => {
  const sizes = ['036_server_rolls.sql', '044_easier_rolls.sql', '048_rarer_friendlier.sql', '055_more_legendaries.sql', '059_gear_expansion.sql', '063_legendary_harder.sql']
    .map((f) => (read(f).match(/\('mk-[a-z0-9-]+', '[a-z]+', [\d.]+, \d+\)/g) || []).length);
  assert.ok(sizes.every((n) => n > 0));
  assert.equal(K.MIN_POOL, Math.min(...sizes));
  assert.ok(K.MIN_POOL <= C.ROLL_MARKS.length);
});

test('lb_roll is 047 line for line except the luck clamp (pity sync, budget, double roll, rate limit unchanged)', () => {
  const body = (s) => {
    const a = s.indexOf('create or replace function public.lb_roll');
    return s.slice(a, s.indexOf('end $$;', a)).split('\n').map((l) => l.trim()).filter(Boolean);
  };
  const old = body(read('047_pity_sync.sql')).filter((l) => !l.includes('LUCK_CAP'));
  const neu = body(sql);
  let j = 0;
  for (const l of old) {
    while (j < neu.length && neu[j] !== l) j += 1;
    assert.ok(j < neu.length, `061 lb_roll lost 047's line: ${l}`);
    j += 1;
  }
  assert.ok(!neu.some((l) => l.includes('LUCK_CAP')), 'no flat cap left in lb_roll');
  has('cap := private.luck_cap(pid);');
  has('L := least(cap, greatest(1, coalesce(p_luck, 1)));');
  has("insert into private.cheat_flags (profile_id, reason, detail) values (pid, 'clamped'");
  has('revoke all on function private.luck_cap(uuid) from anon, authenticated;');
});

test('the browser sends luck() WITHOUT the x2 bonus roll; the server doubles on its own count, on top of the cap', () => {
  const rs = readFileSync(join(process.cwd(), 'src', 'components', 'rollScreen', 'RollScreen.jsx'), 'utf8');
  assert.ok(rs.includes("import { luck as rollLuck } from '../../progress/markRolls'"));
  assert.equal((rs.match(/prepareServerRoll\(rollLuck\(st, \{ permanentOwned: permanentOwnedCount\(\), boost: isBoostActive\(\) \}\)/g) || []).length, 2);
  const s = { marks: { 'mk-talisman': { n: 1 } }, main: 'mk-talisman' };
  mem.clear();
  const a = clientLuck(s);
  const st = C.loadRollState();
  assert.equal(luck({ ...st, rolls: 9 }, {}), luck({ ...st, rolls: 3 }, {}), 'luck() does not move on the 10th roll');
  assert.ok(a > 1);
  has('select * into pk from private.pick_gear(L * (case when bonus then 2 else 1 end), se, sl);');
});

test('a fresh account is capped at x6.6 (was x10); a console 10 is cut to it; old accounts and the tester keep x10', () => {
  // (1 + PERMANENTS 1 + BOOST 1 + the best unseen EARNED / UNLISTED gear 0.3) x STOCK 2
  assert.ok(Math.abs(serverCap({ rebirths: 0, owned: [] }) - 6.6) < 1e-9);
  assert.equal(serverCap({ pre: true, owned: [] }), 10);
  assert.equal(serverCap({ tester: true, owned: [] }), 10);
  // the same fresh save, legit: x1 with nothing running, x6 with every unseen source running at once
  assert.equal(clientLuck({ marks: {} }), 1);
  assert.ok(clientLuck({ marks: {}, boost: true, stock: true, permanentOwned: C.PERMANENT_MARKS.length }) <= serverCap({ rebirths: 0, owned: [] }) + 1e-9);
});

test('NEVER LOWER: a maxed legit save (every gear, star 5, shiny, best two luck gears worn, R30, BOOST, STOCK, all marks)', () => {
  const marks = {};
  for (const m of C.ROLL_MARKS) marks[m.id] = { n: 200, p: earnedPips(m.id, 200), shiny: true };
  const save = { marks, main: 'mk-shamrock', mark2: 'mk-talisman', rebirths: 30, boost: true, stock: true, permanentOwned: C.PERMANENT_MARKS.length };
  const mine = clientLuck(save);
  const cap = serverCap(viewOf(save));
  // a maxed save's real luck is far past 038's x10 ceiling (shiny star-5 SHAMROCK alone is +16): it rolled at x10
  // before this file and still does - the per-account cap reaches the ceiling, so nothing changes for it
  assert.ok(mine > K.LUCK_CAP, `luck ${mine}`);
  assert.equal(cap, K.LUCK_CAP, `maxed legit save capped at ${cap}`);
  // the uncapped server number is >= the real luck too (the cap would cover it without the ceiling)
  const big = { ...K };
  K.LUCK_CAP = Infinity;
  try { assert.ok(mine <= serverCap(viewOf(save)) + 1e-9, `maxed legit luck ${mine} > uncapped server cap ${serverCap(viewOf(save))}`); } finally { Object.assign(K, big); }
  // the server row one rebirth behind (a rebirth in flight) still covers R7 / R5
  const r7 = { ...save, rebirths: 7 };
  assert.ok(Math.min(K.LUCK_CAP, clientLuck(r7)) <= serverCap(viewOf(r7, 6)) + 1e-9);
  const r5 = { ...save, rebirths: 5, stock: false, boost: false, marks: { 'mk-talisman': { n: 1 }, 'mk-slipstream': { n: 1 } }, main: 'mk-talisman', mark2: 'mk-slipstream' };
  assert.ok(clientLuck(r5) <= serverCap(viewOf(r5, 4)) + 1e-9, 'R5 2nd slot with the row at R4');
});

test('NEVER LOWER: a milestone paid on the 28-gear pool stays covered after the pool grew', () => {
  const first = C.ROLL_MARKS.slice(0, 14).map((m) => m.id); // 14 / 28 = 50% then, 14 / 48 now
  const marks = Object.fromEntries(first.map((id) => [id, { n: 1 }]));
  const save = { marks, milestones: ['base-25', 'base-50'] };
  assert.ok(clientLuck(save) <= serverCap(viewOf(save)) + 1e-9);
});

test('NEVER LOWER: 2,000 random legit saves (owned gears, copies, frozen stars, shiny, worn pair, rebirths, boosts)', () => {
  let seed = 61;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  let worst = 0;
  for (let i = 0; i < 2000; i += 1) {
    const marks = {};
    const k = Math.floor(rnd() * C.ROLL_MARKS.length);
    for (let j = 0; j < k; j += 1) {
      const m = pick(C.ROLL_MARKS);
      const n = 1 + Math.floor(rnd() * rnd() * 80);
      marks[m.id] = { n, p: Math.floor(rnd() * (earnedPips(m.id, n) + 1)), shiny: rnd() < 0.1 };
    }
    const ids = Object.keys(marks);
    const perms = rnd() < 0.3 ? [pick(C.PERMANENT_MARKS).id] : [];
    const rebirths = Math.floor(rnd() * 25);
    const save = {
      marks, rebirths, perms, boost: rnd() < 0.3, stock: rnd() < 0.3, permanentOwned: Math.floor(rnd() * (C.PERMANENT_MARKS.length + 1)),
      main: perms.length && rnd() < 0.5 ? perms[0] : ids.length ? pick(ids) : null,
      mark2: ids.length > 1 ? pick(ids) : null,
    };
    const mine = clientLuck(save);
    const cap = Math.min(K.LUCK_CAP, serverCap(viewOf(save, Math.max(0, rebirths - (rnd() < 0.2 ? 1 : 0)))));
    worst = Math.max(worst, mine / cap);
    assert.ok(Math.min(mine, K.LUCK_CAP) <= cap + 1e-9, `save ${i}: luck ${mine} > cap ${cap} (${JSON.stringify(save)})`);
  }
  assert.ok(worst > 0.3, `the cap is not slack everywhere (closest legit luck / cap = ${worst.toFixed(2)})`);
});
