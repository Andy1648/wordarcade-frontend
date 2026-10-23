// node --test — the SAVE CODE (Andy oct22 "fix save code - its buggy"): every code generation round-trips, every way a
// paste gets mangled in the wild still loads (or says in plain English why not), a season-1 code can't wipe a season-2
// save, and a heavy save's code is short enough to paste.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'fflate';
import { exportSave, parseSave, importSave, PRE_RESTORE_KEY } from './saveBackup.js';
import { exportSaveCode, parseAnySave, importAnySave, crc32, cleanPaste, SAVE_ERRORS, readPreRestore } from './saveCode.js';

function makeStore(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _dump: () => Object.fromEntries(m),
  };
}
const without = (o, k) => { const c = { ...o }; delete c[k]; return c; };

// a season-2 save: the mapped keys twice (as the Storage patch exports them), unicode in a record, today's new keys
const S2 = {
  'taw.econ': '13',
  'taw.xp': JSON.stringify({ lv: 44, f: 0.5, rc: 7, v: 10 }),
  'taw.s2.xp': JSON.stringify({ lv: 44, f: 0.5, rc: 7, v: 10 }),
  'taw.rebirths': '7',
  'taw.s2.rebirths': '7',
  'taw.s2.wins': '987654321',
  'taw.s2.gems': '420',
  'taw.s2.heroes': JSON.stringify(['riot', 'blaze']),
  'taw.s2.lvchest': JSON.stringify({ n: 3 }),
  'taw.s2.stars': '2',
  'taw.main': 'blaze',
  'taw.contracts': JSON.stringify({ day: '2026-10-22', picks: ['a'], done: ['a'] }),
  'taw.unlisted': JSON.stringify({ owned: ['ul-moth'] }),
  'taw.markRolls': JSON.stringify({ marks: [{ id: 'g1' }] }),
  'taw.records': JSON.stringify({ rarest: 'naïve — ✨ word' }),
  'taw.wordsenseRefunded': '1',
};
const S2_OPTS = { season2: true };
const DEVICE = { 'taw.musicMuted': '1', 'taw.lb.secret': 'abc', 'taw.s2.seenWelcome': '1' };

test('TAW2: export → import round-trips a season-2 save exactly, device keys untouched, the old save snapshotted', () => {
  const code = exportSaveCode(makeStore({ ...S2, ...DEVICE }));
  assert.match(code, /^TAW2\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
  const dst = makeStore({ 'taw.econ': '13', 'taw.s2.rebirths': '1', 'taw.musicMuted': '0' });
  const r = importAnySave(code, dst, S2_OPTS);
  assert.equal(r.ok, true);
  const out = dst._dump();
  assert.deepEqual(without(without(out, PRE_RESTORE_KEY), 'taw.musicMuted'), S2);
  assert.equal(out['taw.musicMuted'], '0');
  assert.equal(readPreRestore(dst).src, 'restore');
  assert.equal(parseSave(readPreRestore(dst).code).keys['taw.s2.rebirths'], '1'); // the replaced save
});

test('every OLDER code still loads: plain v1 (season 2 + season 1 in season 1), the packed cloud copy (tawz1:)', () => {
  const v1 = exportSave(makeStore(S2));
  assert.deepEqual(parseAnySave(v1, S2_OPTS).keys, S2);
  const s1 = exportSave(makeStore({ 'taw.econ': '12', 'taw.rebirths': '40', 'taw.wins': '5' }));
  assert.equal(parseAnySave(s1, { season2: false }).ok, true);
  const json = Buffer.from(v1, 'base64');
  const packed = 'tawz1:' + Buffer.from(gzipSync(new Uint8Array(json))).toString('base64');
  assert.deepEqual(parseAnySave(packed, S2_OPTS).keys, S2);
  // the PRE-gzip + PRE-checksum plain code with a URL-safe alphabet and no padding (copied through a link)
  const urlsafe = v1.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.deepEqual(parseAnySave(urlsafe, S2_OPTS).keys, S2);
});

test('a SEASON 1 code (or one with no econ stamp) is refused in season 2 — it can no longer trigger the season-2 wipe', () => {
  for (const keys of [{ 'taw.econ': '12', 'taw.rebirths': '40' }, { 'taw.rebirths': '3' }]) {
    const store = makeStore({ 'taw.econ': '13', 'taw.s2.rebirths': '9' });
    for (const code of [exportSave(makeStore(keys)), exportSaveCode(makeStore(keys))]) {
      const r = importAnySave(code, store, S2_OPTS);
      assert.equal(r.ok, false);
      assert.equal(r.error, SAVE_ERRORS.season1);
      assert.deepEqual(store._dump(), { 'taw.econ': '13', 'taw.s2.rebirths': '9' }, 'nothing written, no snapshot');
    }
  }
  // the old sync path (cloud restore, STATS) refuses it too
  assert.equal(importSave(exportSave(makeStore({ 'taw.econ': '12' })), makeStore({}), S2_OPTS).ok, false);
});

test('ADVERSARIAL PASTES that are still the whole code all load', () => {
  const code = exportSaveCode(makeStore(S2));
  const v1 = exportSave(makeStore(S2));
  const mangle = (c) => ({
    plain: c,
    wrapped76: c.replace(/(.{76})/g, '$1\n'),
    crlf: c.replace(/(.{60})/g, '$1\r\n'),
    spaces: c.replace(/(.{10})/g, '$1 '),
    tabs: `\t${c}\t`,
    nbsp: c.replace(/(.{200})/g, '$1\u00a0'),
    zeroWidth: c.slice(0, 50) + '\u200b\u200d' + c.slice(50) + '\ufeff',
    quoted: `"${c}"`,
    smartQuotes: `\u201c${c}\u201d`,
    singleSmart: `\u2018${c}\u2019`,
    backticks: '```' + c + '```',
    sentence: `here is my save code: ${c}`,
    fullStop: `${c}.`,
    angle: `<${c}>`,
  });
  for (const [label, c] of [['TAW2', code], ['v1', v1]]) {
    for (const [name, paste] of Object.entries(mangle(c))) {
      const r = parseAnySave(paste, S2_OPTS);
      assert.equal(r.ok, true, `${label} ${name}: ${r.error}`);
      assert.deepEqual(r.keys, S2, `${label} ${name}`);
    }
  }
  // a chat app that turned every + of a plain code into a space
  const plusy = exportSave(makeStore({ ...S2, 'taw.s2.note': '>>>???>>>' }));
  assert.ok(plusy.includes('+') || plusy.includes('/'), 'fixture has + or /');
  assert.equal(parseAnySave(plusy.replace(/\+/g, ' '), S2_OPTS).ok, true);
});

test('a BROKEN paste gets a plain-English reason and writes nothing', () => {
  const code = exportSaveCode(makeStore(S2));
  const cases = [
    ['', SAVE_ERRORS.empty],
    ['   \n ', SAVE_ERRORS.empty],
    [code.slice(0, code.length - 3), SAVE_ERRORS.cutOff], // the checksum's tail
    [code.slice(0, Math.floor(code.length / 2)), SAVE_ERRORS.cutOff], // half of it (a textarea or chat cap)
    [code.slice(0, 200), SAVE_ERRORS.cutOff],
    [code.slice(12), SAVE_ERRORS.startMissing], // the start missing
    [code.slice(0, 40) + (code[40] === 'A' ? 'B' : 'A') + code.slice(41), SAVE_ERRORS.changed], // one letter changed
    [code.replace(/\.([0-9a-f]{8})$/, '.00000000'), SAVE_ERRORS.changed],
    ['hello there', SAVE_ERRORS.notOurs],
    ['AAAA-BBBB-CCCC-DDDD', SAVE_ERRORS.notOurs], // a recovery code pasted into the save box
    [Buffer.from(JSON.stringify({ format: 'other', keys: {} })).toString('base64'), SAVE_ERRORS.notOurs],
    [Buffer.from(JSON.stringify({ format: 'taw-save', v: 1, keys: { 'taw.wins': 5 } })).toString('base64'), SAVE_ERRORS.damaged],
  ];
  const v1 = exportSave(makeStore(S2));
  cases.push([v1.slice(0, v1.length - 40), SAVE_ERRORS.damaged]); // an old plain code, cut off
  for (const [paste, error] of cases) {
    const store = makeStore({ 'taw.econ': '13', 'taw.s2.rebirths': '9' });
    const r = importAnySave(paste, store, S2_OPTS);
    assert.equal(r.ok, false, `should refuse ${JSON.stringify(paste.slice(0, 30))}`);
    assert.equal(r.error, error, `${JSON.stringify(paste.slice(0, 30))}`);
    assert.deepEqual(store._dump(), { 'taw.econ': '13', 'taw.s2.rebirths': '9' });
  }
});

test('a HEAVY save (5,000 collected words): the code is ≤ 1/3 of the old one and round-trips', () => {
  const w = {};
  for (let i = 0; i < 5000; i += 1) w[`w${i.toString(36)}q${(i * 7919).toString(36)}`] = [i % 6, i % 4, 20380 + (i % 40), i];
  const heavy = { ...S2, 'taw.collection': JSON.stringify({ v: 2, seq: 8000, w, ms: [100, 500], ev: Array.from({ length: 3000 }, (_, i) => `gone${i}`) }) };
  const old = exportSave(makeStore(heavy));
  const code = exportSaveCode(makeStore(heavy));
  assert.ok(old.length > 200000, `old code ${old.length}`); // the old paste box cut it here
  assert.ok(code.length * 3 <= old.length, `TAW2 ${code.length} vs plain ${old.length}`);
  assert.deepEqual(parseAnySave(code, S2_OPTS).keys, heavy);
});

test('cleanPaste / crc32 are stable', () => {
  assert.equal(crc32('123456789'), 'cbf43926'); // the standard CRC-32 check value
  assert.equal(cleanPaste(' \u201cTAW2.abc.0011aabb\u201d. '), 'TAW2.abc.0011aabb');
  assert.equal(cleanPaste('my code is eyJmb3Jt'), 'eyJmb3Jt');
});
