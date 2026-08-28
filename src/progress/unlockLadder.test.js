// unlockLadder.test.js — the free unlock ladder (Job 3). Pure, node --test.
// FRAMES-ONLY since the merge into main: the theme half of the ladder was dropped (main's themes
// system owns menu colour), so every entry is now a FRAME and the spacing widened to every 8
// levels through LV35, then one frame per rebirth.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LADDER,
  MAX_LADDER_LEVEL,
  rebirthUnlock,
  nextUnlock,
  levelUnlockIds,
  currentCosmetic,
} from './unlockLadder.js';

test('the ladder levels are strictly increasing (monotonic)', () => {
  for (let i = 1; i < LADDER.length; i++) {
    assert.ok(LADDER[i].level > LADDER[i - 1].level, `entry ${i} not increasing`);
  }
});

test('every entry is reachable: first ≤ LV5, gaps ≤ 8, all ≤ LV40', () => {
  assert.ok(LADDER[0].level <= 5, 'first unlock should come early');
  for (let i = 1; i < LADDER.length; i++) {
    const gap = LADDER[i].level - LADDER[i - 1].level;
    assert.ok(gap >= 3 && gap <= 8, `gap ${gap} at entry ${i} outside 3-8`);
  }
  assert.equal(LADDER[LADDER.length - 1].level, MAX_LADDER_LEVEL);
  assert.ok(LADDER.every((e) => e.level >= 1 && e.level <= 40));
});

test('nothing unlocks twice: unique ids AND unique levels, distinct from rebirth ids', () => {
  const ids = LADDER.map((e) => e.id);
  const levels = LADDER.map((e) => e.level);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ladder id');
  assert.equal(new Set(levels).size, levels.length, 'duplicate ladder level');
  // Rebirth ids never collide with level ids, and are unique across r.
  const rids = new Set();
  for (let r = 1; r <= 50; r++) {
    const id = rebirthUnlock(r).id;
    assert.ok(!ids.includes(id), `rebirth id ${id} collides with a ladder id`);
    assert.ok(!rids.has(id), `rebirth id ${id} duplicated`);
    rids.add(id);
  }
});

test('every entry is a FRAME now (theme half dropped on merge)', () => {
  for (const e of LADDER) assert.equal(e.kind, 'frame');
  assert.equal(rebirthUnlock(1).kind, 'frame');
  assert.equal(rebirthUnlock(2).kind, 'frame');
});

test('levelUnlockIds returns exactly what a level-N player has earned', () => {
  assert.deepEqual(levelUnlockIds(1), []);
  assert.deepEqual(levelUnlockIds(3), ['frame-bolt']);
  assert.deepEqual(levelUnlockIds(11), ['frame-bolt', 'frame-tape']);
  assert.equal(levelUnlockIds(35).length, LADDER.length);
  assert.equal(levelUnlockIds(999).length, LADDER.length); // never over-grants
});

test('nextUnlock is the first UNOWNED unlock, level-annotated, and never null', () => {
  // Fresh player owns nothing -> first ladder entry.
  const first = nextUnlock([], 0);
  assert.equal(first.id, 'frame-bolt');
  assert.equal(first.at, 'LV 3');
  assert.equal(first.kindLabel, 'FRAME');

  // Owning through LV19 (bolt, tape, chrome) -> next is SPIKE at LV27.
  const owned = levelUnlockIds(19);
  const nxt = nextUnlock(owned, 0);
  assert.equal(nxt.id, 'frame-spike');
  assert.equal(nxt.at, 'LV 27');

  // Owning EVERYTHING through the cap -> next is the first rebirth unlock (post-rebirth safe).
  const all = levelUnlockIds(MAX_LADDER_LEVEL);
  const afterCap = nextUnlock(all, 0);
  assert.equal(afterCap.id, 'rebirth-1');
  assert.equal(afterCap.at, 'REBIRTH 1');

  // Owning all level unlocks + rebirth-1 -> rebirth-2 next.
  const r2 = nextUnlock([...all, 'rebirth-1'], 1);
  assert.equal(r2.id, 'rebirth-2');
});

test('currentCosmetic picks the highest-order owned FRAME', () => {
  const owned = levelUnlockIds(19); // frames: bolt, tape, chrome
  assert.equal(currentCosmetic(owned, 'frame', 0), 'frame-chrome');
  assert.equal(currentCosmetic([], 'frame', 0), null);
  // A rebirth frame outranks every level frame.
  assert.equal(currentCosmetic([...levelUnlockIds(MAX_LADDER_LEVEL), 'rebirth-1'], 'frame', 1), 'rebirth-1');
});
