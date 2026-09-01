// node --test — save export/import (feat/save-export): exact round-trip, corrupt imports are
// rejected with a readable message and never wipe, and import never touches device keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { exportSave, importSave, parseSave, PROGRESS_KEYS } from './saveBackup.js';

// A Map-backed storage stub matching the {getItem,setItem} shape saveBackup expects.
function makeStore(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    _dump: () => Object.fromEntries(m),
    _raw: m,
  };
}

// A realistic populated progression save (a mix of numbers, JSON, and a string id).
const REAL = {
  'taw.wins': '12345',
  'taw.winsLifetime': '98765',
  'taw.xp': JSON.stringify({ lv: 12, into: 40 }),
  'taw.rebirths': '2',
  'taw.keytier': '3',
  'taw.wordsense': '1',
  'taw.momentum': '7',
  'taw.mastery': JSON.stringify({ wordBomb: 260, fuse: 12 }),
  'taw.collection': JSON.stringify({ count: 314 }),
  'taw.achievements': JSON.stringify(['first-blood', 'wordsmith']),
  'taw.records': JSON.stringify({ rarestWord: 'quixotic' }),
  'taw.records.seen': '1',
  'taw.streak': JSON.stringify({ count: 4, lastDay: 20000 }),
  'taw.equipped': JSON.stringify({ pop: 'confetti', sound: 'arcade' }),
  'taw.owned': JSON.stringify(['confetti']),
  'taw.themesOwned': JSON.stringify(['midnight']),
  'taw.freeUnlocks': JSON.stringify(['bolt-frame']),
  'taw.theme': 'midnight',
  'taw.chain.runs': '9',
  'taw.fuse.runs': '4',
  'taw.rounds': '55',
  'taw.returnClaim': JSON.stringify({ day: 20000 }),
  'taw.wpm': JSON.stringify({ best: 71 }),
};

test('export -> import round-trips every progress key EXACTLY', () => {
  const src = makeStore(REAL);
  const code = exportSave(src);
  // Restore into a WIPED store — proves the code alone reconstructs progress.
  const dst = makeStore({});
  const res = importSave(code, dst);
  assert.equal(res.ok, true);
  assert.equal(res.imported, Object.keys(REAL).length);
  assert.deepEqual(dst._dump(), REAL); // byte-for-byte identical
});

test('a corrupt import is REJECTED with a readable message and never wipes existing progress', () => {
  const existing = { 'taw.wins': '5000', 'taw.xp': JSON.stringify({ lv: 3, into: 10 }) };
  for (const bad of ['', '   ', 'not base64 !!!', btoa('{"nope":1}'), btoa('not json at all'), btoa(JSON.stringify({ format: 'other', keys: {} }))]) {
    const store = makeStore(existing);
    const res = importSave(bad, store);
    assert.equal(res.ok, false, `expected rejection for ${JSON.stringify(bad)}`);
    assert.equal(typeof res.error, 'string');
    assert.ok(res.error.length > 0 && /[a-z]/i.test(res.error), 'error is a readable sentence');
    assert.deepEqual(store._dump(), existing, 'existing progress untouched after a rejected import');
  }
});

test('a non-string field is rejected (corrupt) and writes nothing', () => {
  const store = makeStore({ 'taw.wins': '5000' });
  const evil = btoa(JSON.stringify({ format: 'taw-save', keys: { 'taw.wins': 5000 } })); // number, not string
  const res = importSave(evil, store);
  assert.equal(res.ok, false);
  assert.deepEqual(store._dump(), { 'taw.wins': '5000' });
});

test('import NEVER touches the excluded device/UX keys', () => {
  // Device keys pre-set locally; a normal progress code must leave them exactly as they are.
  const store = makeStore({
    'taw.musicMuted': '1',
    'taw.audioVolume': '0.3',
    'taw.clack': '1',
    'taw.sfxEvents': JSON.stringify({ x: 1 }),
    'taw.seenWinsHint': '1',
    'taw.wins': '10',
  });
  const code = exportSave(makeStore(REAL));
  importSave(code, store);
  assert.equal(store.getItem('taw.musicMuted'), '1');
  assert.equal(store.getItem('taw.audioVolume'), '0.3');
  assert.equal(store.getItem('taw.clack'), '1');
  assert.equal(store.getItem('taw.sfxEvents'), JSON.stringify({ x: 1 }));
  assert.equal(store.getItem('taw.seenWinsHint'), '1');
  assert.equal(store.getItem('taw.wins'), '12345'); // progress WAS restored
});

test('a malicious blob that smuggles a device key in its keys map cannot write it (allowlist)', () => {
  const store = makeStore({ 'taw.musicMuted': '1' });
  const evil = btoa(JSON.stringify({
    format: 'taw-save',
    keys: { 'taw.wins': '999', 'taw.musicMuted': '0', 'taw.evilArbitrary': 'x' },
  }));
  const res = importSave(evil, store);
  assert.equal(res.ok, true); // valid progress present (taw.wins)
  assert.equal(store.getItem('taw.wins'), '999'); // allowlisted key written
  assert.equal(store.getItem('taw.musicMuted'), '1'); // device key NOT overwritten
  assert.equal(store.getItem('taw.evilArbitrary'), null); // unknown key NOT written
});

test('export omits absent keys + excludes device keys; parseSave surfaces only progress', () => {
  const src = makeStore({ 'taw.wins': '10', 'taw.musicMuted': '1', 'taw.clack': '1' });
  const parsed = parseSave(exportSave(src));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.keys, { 'taw.wins': '10' }); // no device keys, no absent keys
});

test('PROGRESS_KEYS excludes the five device/UX keys', () => {
  for (const dev of ['taw.seenWinsHint', 'taw.sfxEvents', 'taw.clack', 'taw.audioVolume', 'taw.musicMuted']) {
    assert.ok(!PROGRESS_KEYS.includes(dev), `${dev} must not be a progress key`);
  }
  assert.equal(PROGRESS_KEYS.length, 23);
});
