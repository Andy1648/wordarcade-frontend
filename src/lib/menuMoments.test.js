import test from 'node:test';
import assert from 'node:assert/strict';
import { createMoments, GAP_MS, PRIORITY } from './moments.js';
import { MENU_MOMENTS, momentOpts, playOrder, CARD_MS, WALL_FX_MS, WALL_SETTLE_MS, RANKUP_MS, CLAIM_TUCK_MS } from './menuMoments.js';

function clock() {
  let t = 0;
  let timers = [];
  let id = 0;
  return {
    now: () => t,
    setTimer: (fn, ms) => { const h = ++id; timers.push({ h, at: t + ms, fn }); return h; },
    clearTimer: (h) => { timers = timers.filter((x) => x.h !== h); },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        t = next.at;
        next.fn();
      }
      t = end;
    },
  };
}

test('every safety release (maxMs) is longer than the moment really plays', () => {
  for (const [k, m] of Object.entries(MENU_MOMENTS)) assert.ok(m.maxMs >= m.ms, `${k}: maxMs ${m.maxMs} < ${m.ms}`);
  assert.ok(MENU_MOMENTS.wall.maxMs > WALL_SETTLE_MS + WALL_FX_MS);
  assert.ok(MENU_MOMENTS['tier-up'].maxMs > CARD_MS);
  assert.ok(MENU_MOMENTS.rebirth.maxMs > CARD_MS);
  assert.ok(MENU_MOMENTS['rank-up'].maxMs > RANKUP_MS);
  assert.ok(MENU_MOMENTS['claim-pop'].maxMs > CLAIM_TUCK_MS);
});

test('the ladder: level / wall / rank-up > reward (claim popup) > info cards > tutorials', () => {
  assert.equal(MENU_MOMENTS.wall.priority, PRIORITY.LEVEL);
  assert.equal(MENU_MOMENTS['tier-up'].priority, PRIORITY.LEVEL);
  assert.equal(MENU_MOMENTS['rank-up'].priority, PRIORITY.LEVEL);
  assert.equal(MENU_MOMENTS['claim-pop'].priority, PRIORITY.REWARD);
  assert.equal(MENU_MOMENTS.tutorial.priority, PRIORITY.TUTORIAL);
  assert.deepEqual(
    playOrder(['tutorial', 'claim-pop', 'mark-up', 'wall', 'tier-up', 'rank-up']),
    ['wall', 'tier-up', 'rank-up', 'claim-pop', 'mark-up', 'tutorial'],
  );
});

test('LV100 (wall + tier-up due on one mount): the wall first, the tier-up after it — no wallWait()+1850 guess', () => {
  assert.deepEqual(playOrder(['wall', 'tier-up']), ['wall', 'tier-up']);
  const c = clock();
  const m = createMoments(c);
  const log = [];
  m.announce({ ...momentOpts('wall'), start: (done) => { log.push(`wall@${c.now()}`); c.setTimer(done, WALL_SETTLE_MS + WALL_FX_MS); } });
  m.announce({ ...momentOpts('tier-up'), start: (done) => { log.push(`tier@${c.now()}`); c.setTimer(done, CARD_MS); } });
  c.advance(10000);
  assert.deepEqual(log, ['wall@0', `tier@${WALL_SETTLE_MS + WALL_FX_MS + GAP_MS}`]);
});

test('the claim popup (child, announced first) steps aside for the wall and comes back after it', () => {
  const c = clock();
  const m = createMoments(c);
  const log = [];
  const claim = () => m.announce({ ...momentOpts('claim-pop'), start: () => log.push(`claim@${c.now()}`), onInterrupt: () => { log.push('claim-hide'); claim(); } });
  claim();
  m.announce({ ...momentOpts('wall'), start: (done) => { log.push(`wall@${c.now()}`); c.setTimer(done, 3000); } });
  c.advance(10000);
  assert.deepEqual(log, ['claim@0', 'claim-hide', `wall@${GAP_MS}`, `claim@${GAP_MS + 3000 + GAP_MS}`]);
});

test('a rank-up arriving while a tutorial is queued plays first; an open panel holds both', () => {
  const c = clock();
  const m = createMoments(c);
  const log = [];
  const unhold = m.hold();
  m.announce({ ...momentOpts('tutorial', 'tutorial:fuse'), start: () => log.push('tutorial') });
  m.announce({ ...momentOpts('rank-up'), start: (done) => { log.push('rank-up'); c.setTimer(done, RANKUP_MS); } });
  c.advance(5000);
  assert.deepEqual(log, [], 'nothing starts under a panel');
  unhold();
  c.advance(10000);
  assert.deepEqual(log, ['rank-up', 'tutorial']);
});

test("momentOpts carries the kind's priority / maxMs and a per-instance id", () => {
  assert.deepEqual(momentOpts('tutorial', 'tutorial:fuse'), { id: 'tutorial:fuse', priority: PRIORITY.TUTORIAL, maxMs: MENU_MOMENTS.tutorial.maxMs, interruptible: false });
  assert.equal(momentOpts('claim-pop').interruptible, true);
  assert.throws(() => momentOpts('nope'));
});
