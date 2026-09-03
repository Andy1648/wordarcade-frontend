// schema.test.js — proves the versioned save envelope (feat/save-schema). Pure, keyless, Map-backed
// storage stub. Covers the 5 cases the spec requires: v0->v1 on a realistic blob, corrupt->defaults
// without throwing, an interrupted migration stays recoverable, export->import round-trips after
// migration, and the v2 stub proving the chain runs in order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRESS_KEYS } from './saveBackup.js';
import {
  CURRENT_VERSION, SAVE_KEY, buildV0FromLegacy, migrate, loadSave,
  exportVersionedSave, importVersionedSave, parseVersionedSave,
} from './schema.js';

function makeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    _m: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
  };
}

// A realistic populated legacy world: all 23 progression keys + the 5 device/UX keys = 28 loose keys.
function realisticLegacy() {
  return {
    'taw.wins': '1234',
    'taw.winsLifetime': '98765',
    'taw.xp': JSON.stringify({ lv: 12, into: 340 }),
    'taw.rebirths': '1',
    'taw.keytier': '5',
    'taw.wordsense': '3',
    'taw.momentum': '20',
    'taw.mastery': JSON.stringify({ 'word-bomb': 4, 'sat-rush': 2 }),
    'taw.collection': JSON.stringify({ quixotic: [3, 1, '2026-09-01'] }),
    'taw.achievements': JSON.stringify(['vol-1', 'reb-1', 'obs-1']),
    'taw.records': JSON.stringify({ rarest: 'quixotic' }),
    'taw.records.seen': '1',
    'taw.streak': JSON.stringify({ count: 4, lastDay: '2026-09-02', freezes: 0 }),
    'taw.equipped': 'pop-classic',
    'taw.owned': JSON.stringify(['pop-classic', 'sound-arcade']),
    'taw.themesOwned': JSON.stringify(['neon']),
    'taw.theme': 'neon',
    'taw.freeUnlocks': JSON.stringify(['frame-bolt']),
    'taw.chain.runs': '7',
    'taw.fuse.runs': '3',
    'taw.rounds': '42',
    'taw.returnClaim': JSON.stringify({ ts: 1234567 }),
    'taw.wpm': JSON.stringify({ best: 88 }),
    // 5 device/UX keys — deliberately EXCLUDED from the blob (allowlist = PROGRESS_KEYS):
    'taw.seenWinsHint': '1',
    'taw.sfxEvents': '{}',
    'taw.clack': '1',
    'taw.audioVolume': '0.8',
    'taw.musicMuted': '0',
  };
}

// 1) v0 -> v1 on a realistic 28-key blob: every PROGRESS value is wrapped VERBATIM, device keys excluded.
test('v0->v1: realistic 28-key legacy world wraps every progress value verbatim; device keys excluded', () => {
  const s = makeStorage(realisticLegacy());
  const v0 = buildV0FromLegacy(s);
  assert.equal(v0.v, 0);
  assert.equal(Object.keys(v0.data).length, 23, 'only the 23 progress keys enter the blob');
  for (const k of PROGRESS_KEYS) assert.equal(v0.data[k], s.getItem(k), `${k} verbatim in v0`);
  for (const dev of ['taw.seenWinsHint', 'taw.sfxEvents', 'taw.clack', 'taw.audioVolume', 'taw.musicMuted']) {
    assert.ok(!(dev in v0.data), `${dev} must NOT be in the blob`);
  }
  // Migrating the v0 blob to CURRENT never transforms a real player value (v0->v1 is a verbatim wrap).
  const migrated = migrate(v0);
  assert.equal(migrated.v, CURRENT_VERSION);
  for (const k of PROGRESS_KEYS) assert.equal(migrated.data[k], s.getItem(k), `${k} still verbatim after migration`);
});

// 2) corrupt data yields defaults without throwing; a garbage import writes nothing.
test('corrupt taw.save falls back to legacy without throwing; garbage import is rejected (no write)', () => {
  const s = makeStorage({ ...realisticLegacy(), [SAVE_KEY]: '{not valid json' });
  let save;
  assert.doesNotThrow(() => { save = loadSave(s); });
  assert.equal(save.v, CURRENT_VERSION);
  assert.equal(save.data['taw.wins'], '1234', 'recovered from legacy despite corrupt blob');

  // A structurally-broken stored save (data:null) + empty legacy → safe empty default, no throw.
  const s2 = makeStorage({ [SAVE_KEY]: JSON.stringify({ v: 1, data: null }) });
  let save2;
  assert.doesNotThrow(() => { save2 = loadSave(s2); });
  assert.equal(save2.v, CURRENT_VERSION);
  assert.deepEqual(save2.data, {});

  // Import of non-base64 garbage: rejected, nothing written.
  const s3 = makeStorage(realisticLegacy());
  const before = s3.getItem('taw.wins');
  const r = importVersionedSave('@@ not a code @@', s3);
  assert.equal(r.ok, false);
  assert.equal(s3.getItem('taw.wins'), before, 'a rejected import must not touch storage');
  assert.equal(s3.getItem(SAVE_KEY), null);
});

// 3) an interrupted migration/write-back leaves a recoverable state (legacy never deleted).
test('an interrupted taw.save write never deletes legacy and stays recoverable on the next load', () => {
  const base = realisticLegacy();
  const m = new Map(Object.entries(base));
  let failWrite = true;
  const s = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (k === SAVE_KEY && failWrite) throw new Error('quota'); m.set(k, String(v)); },
  };
  let save;
  assert.doesNotThrow(() => { save = loadSave(s); });
  assert.equal(save.data['taw.wins'], '1234', 'save migrated in memory even though the write failed');
  assert.equal(m.has(SAVE_KEY), false, 'a failed write leaves NO half-blob');
  for (const k of PROGRESS_KEYS) assert.equal(m.get(k), base[k], `legacy ${k} fully intact after the failed write`);

  // Recovery: writes now succeed → the next load persists the versioned save.
  failWrite = false;
  const save2 = loadSave(s);
  assert.equal(save2.v, CURRENT_VERSION);
  assert.equal(JSON.parse(m.get(SAVE_KEY)).data['taw.wins'], '1234');
});

// 4) export -> wipe -> import round-trips exactly, after migration.
test('export -> wipe -> import round-trips every progress key (and lands at CURRENT_VERSION)', () => {
  const s = makeStorage(realisticLegacy());
  const code = exportVersionedSave(s);
  const parsed = parseVersionedSave(code);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.save.v, CURRENT_VERSION);

  const wiped = makeStorage({});
  const r = importVersionedSave(code, wiped);
  assert.equal(r.ok, true);
  assert.equal(r.imported, 23);
  for (const k of PROGRESS_KEYS) assert.equal(wiped.getItem(k), s.getItem(k), `restored ${k} into the read path`);
  assert.equal(JSON.parse(wiped.getItem(SAVE_KEY)).v, CURRENT_VERSION);
});

// 5) the v2 stub proves the chain runs EVERY step, in order.
test('the migration chain runs every step in order (v0 -> v1 -> v2) and is pure', () => {
  const input = { v: 0, data: { 'taw.__probe': 'start' } };
  const out = migrate(input);
  assert.equal(out.v, CURRENT_VERSION); // 2
  assert.equal(out.data['taw.__probe'], 'start:v1:v2', 'v1 ran, then v2 — in order');
  // starting mid-chain applies ONLY the later step
  assert.equal(migrate({ v: 1, data: { 'taw.__probe': 'start' } }).data['taw.__probe'], 'start:v2');
  // migrate is PURE — the input is not mutated
  assert.equal(input.data['taw.__probe'], 'start', 'migrate must not mutate its input');
  // a save claiming a version newer than the app is rejected (throws), never silently mangled
  assert.throws(() => migrate({ v: CURRENT_VERSION + 1, data: {} }));
});
