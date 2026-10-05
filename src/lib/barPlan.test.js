import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planBar, createBarPlayer, flashMsFor, FLASH_MS, FINAL_FILL_MS, CHUNK_FLASHES, FLASH_BUDGET_MS } from './barPlan.js';

const flashes = (p) => p.steps.filter((s) => s.kind === 'flash');
const fills = (p) => p.steps.filter((s) => s.kind === 'fill');
const levelsCrossed = (p) => flashes(p).reduce((s, x) => s + x.levels, 0);

test('one level: one 100 ms flash from the shown fraction, then a fill to the real %', () => {
  const p = planBar({ level: 4, frac: 0.6 }, { level: 5, frac: 0.3 });
  assert.equal(flashes(p).length, 1);
  assert.deepEqual(flashes(p)[0], { kind: 'flash', level: 4, levels: 1, fromFrac: 0.6, toFrac: 1, ms: FLASH_MS });
  assert.deepEqual(fills(p), [{ kind: 'fill', level: 5, fromFrac: 0, toFrac: 0.3, ms: FINAL_FILL_MS }]);
  assert.equal(p.steps.at(-1).kind, 'fill');
  assert.equal(p.totalMs, FLASH_MS + FINAL_FILL_MS);
});

test('five levels: five 100 ms flashes, the level ticking 1 each, then the fill', () => {
  const p = planBar({ level: 10, frac: 0.2 }, { level: 15, frac: 0.5 });
  const f = flashes(p);
  assert.equal(f.length, 5);
  assert.deepEqual(f.map((s) => s.level), [10, 11, 12, 13, 14]);
  assert.ok(f.every((s) => s.levels === 1 && s.ms === 100 && s.toFrac === 1));
  assert.deepEqual(f.map((s) => s.fromFrac), [0.2, 0, 0, 0, 0]);
  assert.equal(levelsCrossed(p), 5);
  assert.equal(fills(p)[0].toFrac, 0.5);
});

test('fifty levels: flashes compress to ≤ 1 s, chunks sum to exactly 50', () => {
  const p = planBar({ level: 1, frac: 0 }, { level: 51, frac: 0.25 });
  const f = flashes(p);
  assert.equal(f.length, CHUNK_FLASHES);
  assert.equal(levelsCrossed(p), 50);
  const flashTotal = f.reduce((s, x) => s + x.ms, 0);
  assert.ok(flashTotal <= FLASH_BUDGET_MS, `flashes ${flashTotal}ms`);
  assert.ok(f.every((s) => s.ms >= 30));
  // chunks are near-even (2 or 3 here) and the levels run contiguously
  assert.ok(f.every((s) => s.levels === 2 || s.levels === 3));
  for (let i = 1; i < f.length; i += 1) assert.equal(f[i].level, f[i - 1].level + f[i - 1].levels);
  assert.ok(p.totalMs <= FLASH_BUDGET_MS + FINAL_FILL_MS);
});

test('compression: every level count keeps the flashes within budget and ≥ 30 ms', () => {
  for (let n = 1; n <= 500; n += 1) {
    const p = planBar({ level: 1, frac: 0 }, { level: 1 + n, frac: 0.5 });
    const f = flashes(p);
    assert.equal(levelsCrossed(p), n);
    assert.ok(f.reduce((s, x) => s + x.ms, 0) <= FLASH_BUDGET_MS, `n=${n}`);
    assert.ok(f.every((s) => s.ms >= 30), `n=${n}`);
  }
  assert.equal(flashMsFor(10), 100);
  assert.equal(flashMsFor(20), 50);
  assert.equal(flashMsFor(30), 33);
});

test('same level: a single fill to the real value; no gain = no steps; behind = drop', () => {
  const p = planBar({ level: 7, frac: 0.2 }, { level: 7, frac: 0.6 }, { sameLevelMs: 300 });
  assert.deepEqual(p.steps, [{ kind: 'fill', level: 7, fromFrac: 0.2, toFrac: 0.6, ms: 300 }]);
  assert.equal(planBar({ level: 7, frac: 0.6 }, { level: 7, frac: 0.6 }).steps.length, 0);
  assert.equal(planBar({ level: 7, frac: 0.6 }, { level: 7, frac: 0.1 }).drop, true);
  assert.equal(planBar({ level: 9, frac: 0 }, { level: 3, frac: 0.9 }).drop, true);
  // landing on exactly 0 needs no final fill
  const z = planBar({ level: 2, frac: 0.5 }, { level: 4, frac: 0 });
  assert.equal(fills(z).length, 0);
  assert.equal(z.steps.at(-1).level + z.steps.at(-1).levels, 4);
});

// A fake clock + rAF so the player runs deterministically.
function harness(opts = {}) {
  let t = 0;
  let q = [];
  const frames = [];
  const levels = [];
  const p = createBarPlayer({
    reduced: () => false,
    now: () => t,
    raf: (fn) => {
      q.push(fn);
      return q.length;
    },
    caf: () => {
      q = [];
    },
    onFrame: (level, frac, phase) => frames.push({ t, level, frac, phase }),
    onLevel: (l) => levels.push(l),
    ...opts,
  });
  const advance = (ms, dt = 16) => {
    for (let e = 0; e < ms; e += dt) {
      t += dt;
      const run = q;
      q = [];
      run.forEach((fn) => fn(t));
    }
  };
  return { p, frames, levels, advance };
}

const key = (s) => s.level + s.frac; // level + fraction: a monotonic measure of progress

test('player: a 5-level climb ticks every level and lands exactly on the real value', () => {
  const h = harness({ level: 3, frac: 0.5 });
  h.p.to(8, 0.4);
  h.advance(2000);
  assert.deepEqual(h.levels, [4, 5, 6, 7, 8]);
  const last = h.frames.at(-1);
  assert.equal(last.level, 8);
  assert.equal(last.frac, 0.4);
  assert.equal(last.phase, 'rest');
  assert.equal(h.p.running, false);
  // landed within the plan's time (5×100 + 200 ms + a frame)
  const restAt = h.frames.find((f) => f.phase === 'rest').t;
  assert.ok(restAt <= 5 * 100 + 200 + 16, `rest at ${restAt}`);
});

test('player: re-plan mid-flight continues from the shown state and never goes backwards', () => {
  const h = harness({ level: 1, frac: 0 });
  h.p.to(6, 0.5);
  h.advance(250); // mid-climb
  const mid = { level: h.p.level, frac: h.p.frac };
  assert.ok(mid.level > 1 && mid.level < 6, `mid ${mid.level}`);
  h.p.to(40, 0.2); // a new gain arrives
  h.advance(2000);
  for (let i = 1; i < h.frames.length; i += 1) {
    const a = h.frames[i - 1];
    const b = h.frames[i];
    assert.ok(key(b) >= key(a) - 1e-12, `backwards at ${i}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  }
  assert.equal(h.p.level, 40);
  assert.equal(h.p.frac, 0.2);
  // every level from 2 to 6 was shown once; past it the count may jump in chunks but only upward
  for (let i = 1; i < h.levels.length; i += 1) assert.ok(h.levels[i] > h.levels[i - 1]);
  assert.ok(h.levels.includes(2) && h.levels.at(-1) === 40);
});

test('player: a drop (rebirth) lands instantly; reduced motion lands instantly', () => {
  const h = harness({ level: 50, frac: 0.5 });
  h.p.to(1, 0.1);
  assert.equal(h.p.level, 1);
  assert.equal(h.p.frac, 0.1);
  assert.equal(h.p.running, false);
  const r = harness({ level: 1, frac: 0, reduced: () => true });
  r.p.to(30, 0.7);
  assert.equal(r.p.level, 30);
  assert.equal(r.p.frac, 0.7);
  assert.equal(r.p.running, false);
});

test('player: the same target again does not restart the plan', () => {
  const h = harness({ level: 1, frac: 0 });
  h.p.to(3, 0.5);
  h.advance(150);
  const before = { level: h.p.level, frac: h.p.frac };
  h.p.to(3, 0.5);
  h.advance(16);
  assert.ok(key(h.p) >= key(before));
  h.advance(1000);
  assert.equal(h.p.level, 3);
  assert.equal(h.p.frac, 0.5);
});
