// node --test — daan (oct27): "his acct got reset … his leaderboard doesn't reflect his actual rebirths". His browser lost
// the board ACCOUNT (the device secret) while his progress survived; the progress came back under a NEW name whose row was
// clamped to R2 and could never climb. These pin every fix on the client side of the save:
//   * a save code carries the account and loading it brings the account back (an old code keeps this device's account);
//   * a mangled account inside a code refuses the WHOLE code; UNDO brings the replaced account back too;
//   * SHORT CODES (071): the server holds the long code under 10 unambiguous characters; a short code goes through the
//     same CRC + validation as a long one; every failure says so in a few words and writes nothing;
//   * RESET ACCOUNT never drops the account when the server can't be reached (it aborts instead).
import test from 'node:test';
import assert from 'node:assert/strict';
import { exportSave, PRE_RESTORE_KEY } from './saveBackup.js';
import {
  exportSaveCode, parseAnySave, importAnySave, applySave, adoptAccount, cleanAccount, readPreRestore,
  normalizeShort, formatShort, issueShortCode, fetchShortSave, cachedShortCode, rememberShortCode, SHORT_CACHE_KEY, SHORT_ALPHABET, SHORT_ERRORS, SAVE_ERRORS, crc32,
} from './saveCode.js';
import { resetOutcome, isMissingRpc } from './cloudSave.js';

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
const SECRET_A = 'a1'.repeat(24);
const SECRET_B = 'b2'.repeat(24);
const acctKeys = (secret, id, username) => ({ 'taw.lb.secret': secret, 'taw.lb.profile': JSON.stringify({ id, username }) });
const DAAN = { 'taw.econ': '13', 'taw.s2.rebirths': '27', 'taw.s2.xp': JSON.stringify({ lv: 514, f: 0.2, rc: 27, v: 10 }), 'taw.records': '{"sig":"assessment"}', ...acctKeys(SECRET_A, 'fe57cdaf', 'Daan') };

test('a save CODE carries the board account; the cloud copy never does', () => {
  const st = makeStore(DAAN);
  const parsed = parseAnySave(exportSaveCode(st));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.acct, { secret: SECRET_A, profile: { id: 'fe57cdaf', username: 'Daan' } });
  const cloud = JSON.parse(Buffer.from(exportSave(st), 'base64').toString('utf8'));
  assert.equal(cloud.acct, undefined, 'the cloud blob (backupNow → exportSave()) holds no secret');
  assert.equal(JSON.stringify(cloud).includes(SECRET_A), false);
});

test('daan: a wiped browser that auto-claimed a NEW name loads his code → his progress AND his account come back', () => {
  const code = exportSaveCode(makeStore(DAAN));
  const fresh = makeStore({ 'taw.econ': '13', ...acctKeys(SECRET_B, 'auto-row', 'NEONGOBLIN42'), 'taw.lb.rbreq': '{"id":"x","from":0}', 'taw.lb.lastRank': '57' });
  const res = importAnySave(code, fresh);
  assert.equal(res.ok, true);
  const d = fresh._dump();
  assert.equal(d['taw.s2.rebirths'], '27');
  assert.equal(d['taw.lb.secret'], SECRET_A, 'the account the code carried is this device\'s now');
  assert.deepEqual(JSON.parse(d['taw.lb.profile']), { id: 'fe57cdaf', username: 'Daan' });
  assert.equal(d['taw.lb.rbreq'], undefined, 'an unanswered rebirth id of the old account is dropped (it would rebirth the wrong row)');
  assert.equal(d['taw.lb.lastRank'], undefined, 'the old account\'s rank cache is dropped');
  // UNDO brings back what was replaced — including the auto-claimed account
  const undo = parseAnySave(readPreRestore(fresh).code);
  assert.equal(undo.ok, true);
  assert.equal(undo.acct.secret, SECRET_B);
  applySave(undo, fresh, { source: 'code' });
  assert.equal(fresh.getItem('taw.lb.secret'), SECRET_B);
});

test('an OLD code (no account inside) keeps this device\'s account; the same account is a no-op', () => {
  const old = Buffer.from(JSON.stringify({ format: 'taw-save', v: 1, keys: { 'taw.econ': '13', 'taw.s2.rebirths': '3' } })).toString('base64');
  const st = makeStore({ 'taw.econ': '13', ...acctKeys(SECRET_B, 'mine', 'Me') });
  assert.equal(importAnySave(old, st).ok, true);
  assert.equal(st.getItem('taw.lb.secret'), SECRET_B);
  assert.equal(adoptAccount({ secret: SECRET_B, profile: { id: 'mine', username: 'Me' } }, st), false);
});

test('a mangled account inside a code refuses the WHOLE code — nothing written', () => {
  for (const acct of [{ secret: 'nothex!', profile: { id: 'x', username: 'y' } }, { secret: SECRET_A }, { secret: SECRET_A, profile: { id: '', username: 'y' } }, 'str']) {
    const json = JSON.stringify({ format: 'taw-save', v: 1, keys: { 'taw.econ': '13', 'taw.s2.rebirths': '9' }, acct });
    const b64 = Buffer.from(json).toString('base64');
    const st = makeStore({ 'taw.s2.rebirths': '1' });
    const r = importAnySave(b64, st);
    assert.equal(r.ok, false, JSON.stringify(acct));
    assert.equal(r.error, SAVE_ERRORS.damaged);
    assert.equal(st.getItem('taw.s2.rebirths'), '1');
    assert.equal(st.getItem(PRE_RESTORE_KEY), null, 'not even the snapshot');
  }
  assert.equal(cleanAccount({ secret: SECRET_A.toUpperCase(), profile: { id: 'p', username: 'u' } }).secret, SECRET_A);
});

// ---- SHORT CODES ----------------------------------------------------------------------------------------------------------
test('short code: 10 characters from an alphabet with no 0 O 1 I L; typing / pasting noise is forgiven', () => {
  for (const c of '01OIL') assert.equal(SHORT_ALPHABET.includes(c), false, c);
  assert.equal(SHORT_ALPHABET.length, 31);
  assert.equal(normalizeShort('k7m2q-x9pah'), 'K7M2QX9PAH');
  assert.equal(normalizeShort(' “K7M2Q X9PAH”. '.replace('.', '')), 'K7M2QX9PAH');
  assert.equal(formatShort('K7M2QX9PAH'), 'K7M2Q-X9PAH');
  for (const bad of ['K7M2Q-X9PA', 'K7M2Q-X9PAHH', 'K0M2Q-X9PAH', 'TAW2.abc.12345678', '', null]) assert.equal(normalizeShort(bad), null, String(bad));
});

/** The 071 table as a fake server: lb_save_code_put / _get with the SQL's rules. */
function fakeServer() {
  const db = { rows: new Map(), byProfile: new Map(), down: false, missing: false, misses: 0, calls: [] };
  let n = 0;
  db.rpc = async (fn, body) => {
    db.calls.push(fn);
    if (db.missing) throw Object.assign(new Error('Could not find the function'), { code: 'PGRST202', status: 404 });
    if (db.down) throw Object.assign(new Error('Failed to fetch'), { code: 'Failed to fetch' });
    if (fn === 'lb_save_code_put') {
      if (body.p_secret !== SECRET_A) throw Object.assign(new Error('no_profile'), { code: 'no_profile', status: 400 });
      if (!String(body.p_blob).startsWith('TAW2.')) return { ok: false, reason: 'bad_blob' };
      let code = db.byProfile.get(body.p_secret);
      if (!code) { n += 1; code = `K7M2QX9P${SHORT_ALPHABET[n]}${SHORT_ALPHABET[n + 1]}`; db.byProfile.set(body.p_secret, code); }
      db.rows.set(code, body.p_blob);
      return { ok: true, code };
    }
    if (fn === 'lb_save_code_get') {
      if (db.misses >= 60) return { ok: false, reason: 'busy' };
      const b = db.rows.get(body.p_code);
      if (!b) { db.misses += 1; return { ok: false, reason: 'not_found' }; }
      return { ok: true, blob: b };
    }
    throw new Error(`unexpected ${fn}`);
  };
  return db;
}

test('short code round trip: COPY uploads the long code (with the account), the short one loads it on another device', async () => {
  const db = fakeServer();
  const a = makeStore(DAAN);
  const up = await issueShortCode({ rpc: db.rpc, secret: SECRET_A, storage: a });
  assert.equal(up.ok, true);
  assert.equal(normalizeShort(up.code), up.code);
  // COPY again: SAME code, newer save
  a.setItem('taw.s2.rebirths', '28');
  const again = await issueShortCode({ rpc: db.rpc, secret: SECRET_A, storage: a });
  assert.equal(again.code, up.code, 'one code per account, kept for good');
  const got = await fetchShortSave(formatShort(up.code).toLowerCase(), { rpc: db.rpc });
  assert.equal(got.ok, true);
  assert.equal(got.keys['taw.s2.rebirths'], '28', 'the code holds the LAST copy');
  assert.equal(got.acct.secret, SECRET_A);
  const b = makeStore({ 'taw.econ': '13' });
  applySave(got, b, { source: 'code' });
  assert.equal(b.getItem('taw.s2.rebirths'), '28');
  assert.equal(b.getItem('taw.lb.secret'), SECRET_A);
});

test('short code failures: plain words, nothing written; a damaged stored code is refused by its checksum', async () => {
  const db = fakeServer();
  assert.deepEqual(await fetchShortSave('K7M2Q-X9PAH', { rpc: db.rpc }), { ok: false, reason: 'not_found', error: SHORT_ERRORS.not_found });
  assert.equal((await fetchShortSave('nope', { rpc: db.rpc })).reason, 'bad_code');
  db.misses = 60;
  assert.equal((await fetchShortSave('K7M2Q-X9PAH', { rpc: db.rpc })).error, SHORT_ERRORS.busy);
  db.down = true;
  assert.equal((await fetchShortSave('K7M2Q-X9PAH', { rpc: db.rpc })).error, SHORT_ERRORS.offline);
  db.down = false;
  db.missing = true;
  assert.equal((await fetchShortSave('K7M2Q-X9PAH', { rpc: db.rpc })).reason, 'unavailable');
  // the server hands back a corrupted copy: the CRC catches it, nothing is applied
  const db2 = fakeServer();
  const up = await issueShortCode({ rpc: db2.rpc, secret: SECRET_A, storage: makeStore(DAAN) });
  const good = db2.rows.get(up.code);
  const mid = good.slice(5, good.lastIndexOf('.'));
  const flipped = mid.slice(0, 40) + (mid[40] === 'A' ? 'B' : 'A') + mid.slice(41);
  db2.rows.set(up.code, `TAW2.${flipped}.${good.slice(good.lastIndexOf('.') + 1)}`);
  assert.notEqual(crc32(flipped), good.slice(good.lastIndexOf('.') + 1));
  const bad = await fetchShortSave(up.code, { rpc: db2.rpc });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, SAVE_ERRORS.changed);
  db2.rows.set(up.code, good.slice(0, 200)); // cut off
  assert.equal((await fetchShortSave(up.code, { rpc: db2.rpc })).error, SAVE_ERRORS.cutOff);
});

test('COPY without 071 / offline / no account → no short code (the UI hands out the long code)', async () => {
  const db = fakeServer();
  db.missing = true;
  assert.equal((await issueShortCode({ rpc: db.rpc, secret: SECRET_A, storage: makeStore(DAAN) })).reason, 'unavailable');
  db.missing = false;
  db.down = true;
  assert.equal((await issueShortCode({ rpc: db.rpc, secret: SECRET_A, storage: makeStore(DAAN) })).reason, 'offline');
  db.down = false;
  assert.equal((await issueShortCode({ rpc: db.rpc, secret: SECRET_B, storage: makeStore(DAAN) })).reason, 'unavailable', 'no profile for that secret');
  assert.equal((await issueShortCode({ rpc: db.rpc, secret: null })).ok, false);
});

// ---- RESET ACCOUNT ---------------------------------------------------------------------------------------------------------
test('RESET ACCOUNT never drops the account when the server can\'t reset it: offline / an error → ABORT, nothing wiped', () => {
  assert.equal(resetOutcome({ named: true, answer: { reset: true } }), 'server');
  assert.equal(resetOutcome({ named: true, error: Object.assign(new Error('Failed to fetch'), {}) }), 'abort');
  assert.equal(resetOutcome({ named: true, error: Object.assign(new Error('http_503'), { status: 503 }) }), 'abort');
  assert.equal(resetOutcome({ named: true, answer: { reset: false } }), 'abort');
  assert.equal(resetOutcome({ named: true, error: Object.assign(new Error('PGRST202'), { code: 'PGRST202' }) }), 'local', '014 not deployed: the old local reset');
  assert.equal(resetOutcome({ named: false }), 'local');
  assert.equal(isMissingRpc({ status: 404 }), true);
  assert.equal(isMissingRpc({ code: 'no_profile', status: 400 }), false);
});

test('save-safety: opening SETTINGS on a device BEHIND the code never overwrites the higher save the code holds', async () => {
  const db = fakeServer();
  const a = makeStore(DAAN); // R27 LV514
  const up = await issueShortCode({ rpc: db.rpc, secret: SECRET_A, storage: a, profileId: 'fe57cdaf' });
  assert.equal(up.ok, true);
  assert.equal(cachedShortCode('fe57cdaf', a), up.code, 'the device remembers the code of its account');
  assert.equal(cachedShortCode('someone-else', a), null);
  // device B shares the account (it loaded the code once) but is behind: R5
  const b = makeStore({ 'taw.econ': '13', 'taw.s2.rebirths': '5', 'taw.s2.xp': JSON.stringify({ lv: 3, f: 0, rc: 5, v: 10 }), ...acctKeys(SECRET_A, 'fe57cdaf', 'Daan') });
  rememberShortCode('fe57cdaf', up.code, b);
  const puts = () => db.calls.filter((c) => c === 'lb_save_code_put').length;
  const before = puts();
  const kept = await issueShortCode({ rpc: db.rpc, secret: SECRET_A, storage: b, profileId: 'fe57cdaf' });
  assert.equal(kept.ok, true);
  assert.equal(kept.kept, true);
  assert.equal(kept.code, up.code);
  assert.equal(kept.held.keys['taw.s2.rebirths'], '27');
  assert.equal(puts(), before, 'no upload: the code still holds R27');
  assert.equal((await fetchShortSave(up.code, { rpc: db.rpc })).keys['taw.s2.rebirths'], '27');
  // B moves ahead (R28) → its save goes up as before
  b.setItem('taw.s2.rebirths', '28');
  b.setItem('taw.s2.xp', JSON.stringify({ lv: 1, f: 0, rc: 28, v: 10 }));
  const ahead = await issueShortCode({ rpc: db.rpc, secret: SECRET_A, storage: b, profileId: 'fe57cdaf' });
  assert.equal(ahead.kept, undefined);
  assert.equal((await fetchShortSave(up.code, { rpc: db.rpc })).keys['taw.s2.rebirths'], '28');
  // can't read what the code holds (offline) → never overwrite blind
  const c = makeStore({ 'taw.econ': '13', 'taw.s2.rebirths': '1', ...acctKeys(SECRET_A, 'fe57cdaf', 'Daan') });
  rememberShortCode('fe57cdaf', up.code, c);
  db.down = true;
  const off = await issueShortCode({ rpc: db.rpc, secret: SECRET_A, storage: c, profileId: 'fe57cdaf' });
  db.down = false;
  assert.equal(off.ok, false);
  assert.equal(off.reason, 'offline');
  assert.equal((await fetchShortSave(up.code, { rpc: db.rpc })).keys['taw.s2.rebirths'], '28');
  // the cache is account state, never progress: a save code does not carry it
  assert.equal(parseAnySave(exportSaveCode(b)).keys[SHORT_CACHE_KEY], undefined);
});

test('save-safety: UNDO onto a FRESH device puts back exactly the fresh save — progress and the bare secret', () => {
  const code = exportSaveCode(makeStore(DAAN));
  for (const bare of [SECRET_B, null]) {
    const fresh = makeStore({ 'taw.econ': '13', 'taw.s2.seenWelcome': '1', ...(bare ? { 'taw.lb.secret': bare } : {}) });
    assert.equal(importAnySave(code, fresh, { source: 'code' }).ok, true);
    assert.equal(fresh.getItem('taw.s2.rebirths'), '27');
    assert.equal(fresh.getItem('taw.lb.secret'), SECRET_A);
    const pre = readPreRestore(fresh);
    assert.equal(pre.secret, bare);
    const undo = parseAnySave(pre.code);
    assert.equal(undo.ok, true);
    assert.equal(undo.acct, undefined, 'the fresh save had no claimed account');
    applySave(undo, fresh, { source: 'code', exact: true, secret: pre.secret });
    const d = fresh._dump();
    assert.equal(d['taw.s2.rebirths'], undefined, 'the code\'s progress is gone again (it used to stay: a merge)');
    assert.equal(d['taw.s2.xp'], undefined);
    assert.equal(d['taw.records'], undefined);
    assert.equal(d['taw.econ'], '13');
    assert.equal(d['taw.s2.seenWelcome'], '1', 'device keys are never touched');
    assert.equal(d['taw.lb.secret'], bare ?? undefined, 'the device secret it had (or none) is back');
    assert.equal(d['taw.lb.profile'], undefined, 'the adopted account does not stay (its cloud restore would undo the undo)');
    // the undo itself can be undone: the account it dropped is in the new snapshot
    assert.equal(parseAnySave(readPreRestore(fresh).code).acct.secret, SECRET_A);
  }
});

test('save-safety: a normal code load still MERGES (never drops a key the code does not carry)', () => {
  const code = exportSaveCode(makeStore(DAAN));
  const dev = makeStore({ 'taw.econ': '13', 'taw.s2.heroes': '["riot"]', ...acctKeys(SECRET_A, 'fe57cdaf', 'Daan') });
  importAnySave(code, dev, { source: 'code' });
  assert.equal(dev.getItem('taw.s2.heroes'), '["riot"]');
  assert.equal(dev.getItem('taw.s2.rebirths'), '27');
});
