// node --test — BATCH G: THE ECONOMY, ATTACKED.
//
// wins.test.js checks that the payout formula computes the right number. This file assumes the
// formula is right and asks a different question: can the LEDGER and the BALANCE ever disagree,
// and can anything mint money that the player was never shown?
//
// The load-bearing property is that every credit goes through ONE door (`credit()` in wins.js),
// which writes the balance, the lifetime total and the ledger in the same call. Everything below
// is a way of trying to get those three out of step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  bankWordWins,
  grantWins,
  getWins,
  getWinsLifetime,
  winsLedger,
  winsLedgerMark,
  winsLedgerSince,
  UNATTRIBUTED,
  MIN_WORDS,
  WINS_MULT,
} from './wins.js';

// A fresh in-memory localStorage per test, installed as the global. The ledger is module state, so
// each test also marks its own starting point rather than assuming an empty one.
function withStorage(fn) {
  const saved = globalThis.localStorage;
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
  try {
    return fn();
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
}

/** Play `n` words in `mode`, one bankWordWins call per word, exactly as the app does: the count
 *  gate is a per-word snapshot and the weight is cumulative. Returns the per-word grants. */
function playRun({ mode, words, weightPerWord = 1, difficulty, level }) {
  const grants = [];
  let weight = 0;
  for (let i = 1; i <= words; i += 1) {
    const prevWeight = weight;
    weight += weightPerWord;
    grants.push(
      bankWordWins({
        mode,
        difficulty,
        level,
        prevWords: i - 1,
        nowWords: i,
        prevWeight,
        nowWeight: weight,
      }),
    );
  }
  return grants;
}

const ALL_MODES = Object.keys(WINS_MULT); // wordBomb, blitz, satRush, chain, fuse

test('THE BOOKS BALANCE: ledger total == balance delta == lifetime delta, in every mode', () => {
  withStorage(() => {
    const mark = winsLedgerMark();
    const startBal = getWins();
    const startLife = getWinsLifetime();

    let handCounted = 0;
    for (const mode of ALL_MODES) {
      handCounted += playRun({ mode, words: 12, weightPerWord: 1.4, level: 40 }).reduce((a, b) => a + b, 0);
    }
    // ...and the bonus paths, which credit through the same door but are NOT per-word money.
    grantWins(250, 'ACHIEVEMENT — TEST');
    grantWins(90, 'COLLECTION — TEST');
    handCounted += 250 + 90;

    const entries = winsLedgerSince(mark);
    const ledgerTotal = entries.reduce((a, e) => a + e.amount, 0);

    assert.equal(ledgerTotal, handCounted, 'the ledger must record exactly what was granted');
    assert.equal(getWins() - startBal, ledgerTotal, 'balance moved by something other than the ledger');
    assert.equal(getWinsLifetime() - startLife, ledgerTotal, 'lifetime moved by something other than the ledger');
  });
});

test('no live path can credit UNATTRIBUTED money', () => {
  // A credit with no label is money the player cannot be shown a reason for. The fallback exists so
  // a missing label never COSTS anyone money, but nothing that actually runs may rely on it.
  withStorage(() => {
    const mark = winsLedgerMark();
    for (const mode of ALL_MODES) playRun({ mode, words: 6, weightPerWord: 2, level: 12 });
    grantWins(40, 'WELCOME BACK');
    for (const e of winsLedgerSince(mark)) {
      assert.notEqual(e.label, UNATTRIBUTED, `unattributed credit of ${e.amount} (kind=${e.kind})`);
      assert.ok(e.label && e.label.length > 0, 'every credit carries a label');
    }
  });
});

test('every grant ends in a zero — the stated payout invariant, per grant not just in total', () => {
  withStorage(() => {
    for (const mode of ALL_MODES) {
      for (const level of [1, 7, 23, 40]) {
        for (const g of playRun({ mode, words: 9, weightPerWord: 1.7, level })) {
          assert.equal(g % 10, 0, `${mode} @ lv${level} granted ${g}, which does not end in a zero`);
        }
      }
    }
  });
});

test('REPLAY: there is NO replay protection at this layer, and that is worth knowing', () => {
  // Written expecting an identical re-bank to pay zero. It pays in full, every time — and that is
  // correct: bankWordWins is a PURE function of its arguments with no memory of what it has already
  // paid. "The delta is zero on a repeat" is only true if the CALLER advances prev, which is the
  // same contract the test at the bottom of this file pins.
  //
  // So the only thing standing between a duplicated `word_result` frame and a double payout is
  // App.jsx's own bookkeeping. The guard there is partial: myOutstandingWordsRef splices the word
  // out on the first result, so a duplicate fails the word match — but `isMine` then falls back to
  // `submitter.id === myIdRef.current`, which is still true during the player's own turn. A
  // duplicate accept arriving before the turn advances increments the refs again and banks a second
  // word. This test pins the layer's behaviour so that fact stays visible.
  withStorage(() => {
    const args = {
      mode: 'wordBomb',
      level: 40,
      prevWords: 5,
      nowWords: 6,
      prevWeight: 5,
      nowWeight: 6,
    };
    const first = bankWordWins(args);
    assert.ok(first > 0, 'the first bank must pay');
    for (let i = 0; i < 3; i += 1) {
      assert.equal(
        bankWordWins(args),
        first,
        'bankWordWins is a pure delta: an identical call pays identically. Idempotency is the ' +
          "caller's job, and if this ever changes the callers need re-auditing.",
      );
    }
  });
});

test('THE GATE releases the first three words exactly once, and never re-releases', () => {
  withStorage(() => {
    const mark = winsLedgerMark();
    const grants = playRun({ mode: 'chain', words: 8, weightPerWord: 1, level: 40 });

    // Nothing is paid before the gate...
    for (let i = 0; i < MIN_WORDS - 1; i += 1) {
      assert.equal(grants[i], 0, `word ${i + 1} paid before the ${MIN_WORDS}-word gate`);
    }
    // ...the gate word pays for all three at once...
    assert.ok(grants[MIN_WORDS - 1] > 0, 'the gate word must release the withheld words');
    // ...and every later word pays a single word's worth, i.e. the release happened once.
    const single = grants[MIN_WORDS];
    for (let i = MIN_WORDS; i < grants.length; i += 1) {
      assert.equal(grants[i], single, 'post-gate words must pay a flat per-word amount');
    }
    assert.ok(
      grants[MIN_WORDS - 1] > single,
      'the gate word must pay MORE than a single word — it is three words of withheld weight',
    );

    // And the ledger agrees with the hand count.
    const total = grants.reduce((a, b) => a + b, 0);
    assert.equal(winsLedgerSince(mark).reduce((a, e) => a + e.amount, 0), total);
  });
});

test('ROUNDING RESIDUE DOES NOT ACCUMULATE: the run total is the sum of what was shown', () => {
  // Each grant is snapped to a round 10 independently. The risk is that the snapped per-word
  // numbers the player watched add up to something other than the balance they end with.
  withStorage(() => {
    for (const mode of ALL_MODES) {
      const mark = winsLedgerMark();
      const before = getWins();
      // A deliberately awkward weight, so every grant has rounding residue to lose.
      const grants = playRun({ mode, words: 40, weightPerWord: 1.0 / 3.0, level: 33 });
      const shown = grants.reduce((a, b) => a + b, 0);
      assert.equal(getWins() - before, shown, `${mode}: balance and the shown numbers disagree`);
      assert.equal(
        winsLedgerSince(mark).reduce((a, e) => a + e.amount, 0),
        shown,
        `${mode}: ledger and the shown numbers disagree`,
      );
    }
  });
});

test('GARBAGE IN CANNOT MINT MONEY', () => {
  withStorage(() => {
    const before = getWins();
    const bad = [
      { prevWords: 9, nowWords: 10, prevWeight: 10, nowWeight: Number.NaN },
      { prevWords: 9, nowWords: 10, prevWeight: Number.NaN, nowWeight: Number.NaN },
      { prevWords: 9, nowWords: 10, prevWeight: 10, nowWeight: -50 },
      { prevWords: 9, nowWords: 10, prevWeight: 10, nowWeight: 9 }, // weight went DOWN
      { prevWords: 10, nowWords: 9, prevWeight: 10, nowWeight: 10 }, // count went DOWN
      { prevWords: Number.POSITIVE_INFINITY, nowWords: 10, prevWeight: 1, nowWeight: 2 },
      {},
    ];
    for (const args of bad) {
      const got = bankWordWins({ mode: 'wordBomb', level: 40, ...args });
      assert.ok(Number.isFinite(got), `non-finite payout from ${JSON.stringify(args)}`);
      assert.ok(got >= 0, `negative payout from ${JSON.stringify(args)}`);
    }
    // An Infinity weight must not become an Infinity balance.
    bankWordWins({ mode: 'wordBomb', level: 40, prevWords: 9, nowWords: 10, prevWeight: 1, nowWeight: Number.POSITIVE_INFINITY });
    assert.ok(Number.isFinite(getWins()), 'the balance became non-finite');
    assert.ok(getWins() >= before, 'the balance went backwards');
  });
});

test('grantWins cannot be used to remove money', () => {
  withStorage(() => {
    const before = getWins();
    for (const n of [0, -1, -9999, Number.NaN, Number.POSITIVE_INFINITY, null, undefined, '50']) {
      grantWins(n, 'ATTACK');
    }
    assert.ok(getWins() >= before, 'a bonus grant reduced the balance');
    assert.ok(Number.isFinite(getWins()), 'the balance became non-finite');
  });
});

test("THE CALLER'S CONTRACT, pinned: resetting prev mid-run re-pays the whole run", () => {
  // This is NOT a bug in bankWordWins — it is a pure delta function and it is behaving correctly.
  // It is the contract every caller must honour: the prev/now pair must describe the SAME
  // continuous run. If a caller's cumulative refs reset to zero while the run continues, the next
  // word re-banks everything before it.
  //
  // In the shipped app the weight refs reset only on `game_started` (Word Bomb, App.jsx ~1077) and
  // `round_start` (Category Blitz, ~1421) — both of which also reset the accept COUNT, so the run
  // restarts below the gate and cannot re-pay. This test exists so that if anyone ever resets one
  // of those refs WITHOUT the other, or introduces a mid-run remount that reconstructs prev from
  // zero, the money consequence is written down here rather than discovered on a balance.
  withStorage(() => {
    const honest = playRun({ mode: 'fuse', words: 10, weightPerWord: 1, level: 40 });
    const honestTotal = honest.reduce((a, b) => a + b, 0);

    const before = getWins();
    // prev reset to 0 while the run's cumulative totals stayed at 10 words / weight 10.
    const reBanked = bankWordWins({
      mode: 'fuse',
      level: 40,
      prevWords: 0,
      prevWeight: 0,
      nowWords: 10,
      nowWeight: 10,
    });
    assert.equal(
      reBanked,
      honestTotal,
      'a prev reset re-pays exactly the run so far — keep the count and weight refs in lockstep',
    );
    assert.equal(getWins() - before, reBanked);
  });
});

test('the ledger is append-only and every entry is identifiable', () => {
  withStorage(() => {
    const mark = winsLedgerMark();
    playRun({ mode: 'satRush', words: 7, weightPerWord: 3, level: 20 });
    grantWins(10, 'WELCOME BACK');
    const entries = winsLedgerSince(mark);
    assert.ok(entries.length > 0, 'nothing was recorded');
    const ids = entries.map((e) => e.id);
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b), 'ledger ids are not monotonic');
    assert.equal(new Set(ids).size, ids.length, 'duplicate ledger ids');
    for (const e of entries) {
      assert.ok(Number.isFinite(e.amount) && e.amount > 0, 'a zero/!finite entry reached the ledger');
      assert.ok(e.kind === 'word' || e.kind === 'bonus', `unknown credit kind ${e.kind}`);
      if (e.kind === 'word') assert.ok(e.mode, 'per-word money must name its mode');
    }
    // winsLedger() is the whole session and must contain everything since the mark.
    const all = winsLedger();
    assert.ok(all.length >= entries.length);
  });
});

// ---------------------------------------------------------------------------------------------
// THE ONE DOOR, enforced against the source rather than against behaviour.
//
// wins.js documents credit() as the single door every payout goes through, which is what makes
// "the ledger and the balance agree" checkable at all. It was not actually true: useWordSecrets.js
// wrote saveWins/saveWinsLifetime directly, so secret payouts banked correctly but never reached
// the ledger, the credit toast, or the menu's pending stamp. A behavioural test could not catch it
// (secrets are a 1-in-750 roll per word, so a 20-word e2e run almost never fires one) — so this is
// a source scan instead.
test('nothing outside wins.js credits EARNINGS without going through credit()', () => {
  const SRC = join(process.cwd(), 'src');
  // SPENDING is not a credit and must NOT enter the earnings ledger: buying moves the spendable
  // balance down and deliberately never touches winsLifetime. These are the sanctioned writers.
  const ALLOW = new Set([
    'progress/wins.js', // the door itself
    'progress/shop.js', // buy() — spend
    'theme/themes.js', // theme purchase — spend
    'progress/wordSenseRefund.js', // a refund of a spend, not earnings
  ]);

  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        walk(p);
        continue;
      }
      if (!/\.(js|jsx)$/.test(name) || /\.test\.jsx?$/.test(name)) continue;
      const rel = relative(SRC, p).split(sep).join('/');
      if (ALLOW.has(rel)) continue;
      const src = readFileSync(p, 'utf8');
      // saveWinsLifetime is the tell: only EARNINGS raise the lifetime total, so any writer of it
      // outside wins.js is minting money the ledger will never see.
      if (/\bsaveWinsLifetime\s*\(/.test(src)) offenders.push(`${rel} writes saveWinsLifetime directly`);
    }
  };
  walk(SRC);

  assert.deepEqual(
    offenders,
    [],
    'earnings must be credited through grantWins()/bankWordWins() so they reach the ledger:\n  '
      + offenders.join('\n  '),
  );
});
