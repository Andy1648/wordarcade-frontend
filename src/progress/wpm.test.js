// wpm.test.js — pins the WPM calculation, the recent-sessions cap (oldest evicted first), the
// all-time average, and graceful degradation when storage is blocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  wpmFrom,
  recordSession,
  loadWpm,
  allTimeAvgWpm,
  recentAvgWpm,
  bestWpm,
  bestWpmOverall,
  RECENT_CAP,
} from './wpm.js';

function withStorage(fn, opts = {}) {
  const saved = globalThis.localStorage;
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => {
      if (opts.throwOnGet) throw new Error('blocked');
      return map.has(k) ? map.get(k) : null;
    },
    setItem: (k, v) => {
      if (opts.throwOnSet) throw new Error('blocked');
      map.set(k, String(v));
    },
    removeItem: (k) => map.delete(k),
  };
  try {
    return fn(map);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
}

test('wpmFrom: standard 5-char-word formula against a known input', () => {
  // 25 chars in 6000ms (0.1 min): (25/5)/0.1 = 50 WPM.
  assert.equal(wpmFrom(25, 6000), 50);
  // 300 chars in 60000ms (1 min): (300/5)/1 = 60 WPM.
  assert.equal(wpmFrom(300, 60000), 60);
  // Non-positive / non-finite → 0 (never NaN/Infinity).
  assert.equal(wpmFrom(0, 6000), 0);
  assert.equal(wpmFrom(25, 0), 0);
  assert.equal(wpmFrom(NaN, 6000), 0);
  assert.equal(wpmFrom(25, Infinity), 0); // non-finite ms → 0
});

test('recordSession: bumps best, folds all-time average, appends to recent', () => {
  withStorage(() => {
    recordSession({ mode: 'chain', chars: 300, ms: 60000 }); // 60 WPM
    recordSession({ mode: 'chain', chars: 250, ms: 60000 }); // 50 WPM
    assert.equal(bestWpm('chain'), 60); // best keeps the higher
    assert.equal(allTimeAvgWpm(), 55); // (60+50)/2
    const data = loadWpm();
    assert.equal(data.recent.length, 2);
    assert.deepEqual(data.recent[data.recent.length - 1], { m: 'chain', w: 50 });
  });
});

test('recordSession: per-mode bests are independent; overall = max across modes', () => {
  withStorage(() => {
    recordSession({ mode: 'satRush', chars: 200, ms: 60000 }); // 40
    recordSession({ mode: 'fuse', chars: 350, ms: 60000 }); // 70
    assert.equal(bestWpm('satRush'), 40);
    assert.equal(bestWpm('fuse'), 70);
    assert.equal(bestWpmOverall(), 70);
  });
});

test('turn-based modes are NOT tracked (Word Bomb / Blitz dropped from WPM_MODES, §2)', () => {
  withStorage(() => {
    recordSession({ mode: 'wordBomb', chars: 300, ms: 60000 }); // meaningless in a turn-based mode
    recordSession({ mode: 'blitz', chars: 300, ms: 60000 });
    assert.equal(bestWpm('wordBomb'), 0); // not a tracked mode → never recorded
    assert.equal(bestWpm('blitz'), 0);
    assert.equal(loadWpm().recent.length, 0);
  });
});

test('recentAvgWpm averages ONLY tracked-mode sessions in the recent ring (§2d)', () => {
  withStorage(() => {
    recordSession({ mode: 'satRush', chars: 200, ms: 60000 }); // 40
    recordSession({ mode: 'chain', chars: 300, ms: 60000 }); // 60
    assert.equal(recentAvgWpm(), 50); // (40+60)/2
    // A stale wordBomb entry left in storage from before the mode was dropped is filtered on load,
    // so it can never contaminate the average.
    const data = loadWpm();
    data.recent.push({ m: 'wordBomb', w: 999 });
    localStorage.setItem('taw.wpm', JSON.stringify(data));
    assert.equal(recentAvgWpm(), 50); // wordBomb entry dropped by loadWpm's mode filter
  });
});

test('recent ring caps at RECENT_CAP and evicts OLDEST first', () => {
  withStorage(() => {
    // 35 sessions, all above the MIN thresholds, with an identifiable WPM each: ms=60000 →
    // wpm = chars/5; chars = 5*(10+i) → wpm = 10+i (so 11..45), never below the min-chars floor.
    for (let i = 1; i <= RECENT_CAP + 5; i++) {
      recordSession({ mode: 'menu', chars: 5 * (10 + i), ms: 60000 });
    }
    const data = loadWpm();
    assert.equal(data.recent.length, RECENT_CAP);
    // The first 5 sessions (wpm 11..15) were evicted; the oldest kept is i=6 → wpm 16.
    assert.equal(data.recent[0].w, 16);
    assert.equal(data.recent[data.recent.length - 1].w, 10 + RECENT_CAP + 5); // newest = 45
    // All-time count still reflects EVERY session (not just the retained 30).
    assert.equal(loadWpm().n, RECENT_CAP + 5);
  });
});

test('trivial sessions are ignored (too short / too few chars)', () => {
  withStorage(() => {
    recordSession({ mode: 'chain', chars: 5, ms: 60000 }); // < MIN_CHARS
    recordSession({ mode: 'chain', chars: 300, ms: 500 }); // < MIN_MS
    assert.equal(bestWpm('chain'), 0);
    assert.equal(loadWpm().n, 0);
  });
});

test('storage failure defaults cleanly (reads empty, never throws)', () => {
  withStorage(
    () => {
      assert.doesNotThrow(() => recordSession({ mode: 'chain', chars: 300, ms: 60000 }));
      assert.equal(bestWpm('chain'), 0);
      assert.equal(allTimeAvgWpm(), 0);
      assert.deepEqual(loadWpm().recent, []);
    },
    { throwOnGet: true, throwOnSet: true }
  );
});

test('MEASURE: localStorage bytes for a FULL history (30 recent + all bests)', () => {
  withStorage((map) => {
    for (let i = 1; i <= RECENT_CAP; i++) {
      const mode = WPM_MODES_SAMPLE[i % WPM_MODES_SAMPLE.length];
      recordSession({ mode, chars: 5 * (40 + (i % 60)), ms: 60000 });
    }
    const raw = map.get('taw.wpm');
    const bytes = Buffer.byteLength(raw, 'utf8');
    // Hard ceiling assertion so the footprint can't silently balloon. The measured value is
    // logged for the report.
    // eslint-disable-next-line no-console
    console.log(`[wpm] full-history localStorage cost: ${bytes} bytes (${raw.length} chars)`);
    assert.ok(bytes < 1200, `wpm history should stay under ~1.2KB, was ${bytes}`);
  });
});

const WPM_MODES_SAMPLE = ['satRush', 'chain', 'fuse', 'menu'];
