// node --test — WRITE DOWN YOUR CODE: said once at LV 15, the first rebirth and LV 50; a veteran gets ONE card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dueNudge, readSaid, writeSaid, NUDGE_SEEN_KEY } from './codeNudge.js';
import { isProgressKey } from './saveBackup.js';
import { keepKey } from '../progress/keepKeys.js';

test('nothing before LV 15; LV 15 says it once', () => {
  assert.equal(dueNudge({ level: 14, rebirths: 0 }, []), null);
  assert.deepEqual(dueNudge({ level: 15, rebirths: 0 }, []), { id: 'lv15', mark: ['lv15'] });
  assert.equal(dueNudge({ level: 30, rebirths: 0 }, ['lv15']), null);
});

test('the first rebirth says it again (level is back to 1), then LV 50', () => {
  assert.deepEqual(dueNudge({ level: 1, rebirths: 1 }, ['lv15']), { id: 'r1', mark: ['lv15', 'r1'] });
  assert.equal(dueNudge({ level: 40, rebirths: 3 }, ['lv15', 'r1']), null);
  assert.deepEqual(dueNudge({ level: 50, rebirths: 3 }, ['lv15', 'r1']), { id: 'lv50', mark: ['lv15', 'r1', 'lv50'] });
  assert.equal(dueNudge({ level: 90, rebirths: 9 }, ['lv15', 'r1', 'lv50']), null);
});

test('a veteran past every milestone gets ONE card and all of them are noted', () => {
  const d = dueNudge({ level: 60, rebirths: 12 }, []);
  assert.equal(d.id, 'lv50');
  assert.deepEqual(d.mark.sort(), ['lv15', 'lv50', 'r1']);
  assert.equal(dueNudge({ level: 60, rebirths: 12 }, d.mark), null);
});

test('the said-list is UI state: never in a save code, kept through a wipe; junk storage reads as none', () => {
  assert.equal(isProgressKey(NUDGE_SEEN_KEY), false);
  assert.equal(keepKey(NUDGE_SEEN_KEY), true);
  const m = new Map();
  const st = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
  assert.deepEqual(readSaid(st), []);
  writeSaid(['lv15'], st);
  assert.deepEqual(readSaid(st), ['lv15']);
  m.set(NUDGE_SEEN_KEY, '{bad');
  assert.deepEqual(readSaid(st), []);
});
