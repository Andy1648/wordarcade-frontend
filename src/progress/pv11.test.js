// node --test — PROGRESSION v11, amended oct3 18:15 (claude/econ-oct2/v11-spec.md): ONE fixed level curve
// (no KEY / rebirth power term); GAME WORDS PAY WINS ONLY; the bar fills from LETTERS typed (menu + in-game)
// × KEY (×1.2 a tier) × rebirth ×(1+R) × the worn mark; and everything v10 built that still holds: fraction
// storage, the legacy conversion, stale-tab protection, finite-need guards and the grandfathered gate.
// (Rewritten from pv10.test.js — every power-scaling assertion is now its v11 opposite.)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  need,
  needAt,
  needV9,
  round10,
  creditXp,
  loadProgress,
  saveProgress,
  progressOf,
  resolveXpState,
  storedLevel,
  doRebirth,
  rebirthThreshold,
  tableRebirthThreshold,
  keyTierXp,
  keyXpMult,
  rebirthXpMult,
  rebirthMult,
  levelXpPerLetter,
  xpPerInput,
  xpPerWord,
  clampFrac,
  FRAC_MAX,
  CURVE_V11_BASE,
  CURVE_V11_A,
  CURVE_V11_POW,
  CURVE_V11_LEAN,
  KEY_XP_STEP,
  REBIRTH_XP_STEP,
  LEVEL_XP_PER_LETTER,
  XP_KEY,
  XP_SHADOW_KEY,
  REBIRTH_GATE_KEY,
} from './xp.js';
import { migrateEconomyV11 } from './econMigrate.js';
import { awardWordXp, perWordXp } from './wins.js';
import { progressScoreFromKeys } from '../save/cloudSave.js';
import {
  lettersAdded,
  noteLetters,
  noteTypedLetters,
  flushLetterXp,
  creditLetterXp,
  resetLetterXp,
  markXpBoost,
  letterXpNow,
  MARK_XP_BOOST,
} from './letterXp.js';

function withStorage(seed, fn) {
  const saved = globalThis.localStorage;
  const map = new Map(Object.entries(seed || {}));
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  try {
    return fn(map);
  } finally {
    if (saved === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = saved;
  }
}
const legacy = (lv, into) => JSON.stringify({ lv, into });
const v10 = (lv, f, rc = 0) => JSON.stringify({ lv, f, rc, v: 10 });
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ---- the curve: ONE for everyone ------------------------------------------------------------------
test('v11 curve: round10(100 + 15·n²·1.004^(n−1)) — the published formula', () => {
  assert.equal(CURVE_V11_BASE, 100);
  assert.equal(CURVE_V11_A, 15);
  assert.equal(CURVE_V11_POW, 2);
  assert.equal(CURVE_V11_LEAN, 1.004);
  const formula = (n) => round10(100 + 15 * n * n * Math.pow(1.004, n - 1));
  for (const n of [1, 2, 10, 15, 30, 50, 99, 100, 101, 150, 200, 225, 400, 600, 1000]) assert.equal(need(n), formula(n), `LV${n}`);
});

test('need() is INDEPENDENT of KEY tier and rebirths (Andy: "never scales with the player")', () => {
  const at = {};
  for (const [kt, rc] of [[0, 0], [1, 0], [8, 0], [17, 8], [40, 25], [1000, 4]]) {
    withStorage({ 'taw.keytier': String(kt), 'taw.rebirths': String(rc) }, () => {
      for (const n of [1, 16, 100, 195, 400]) {
        const v = need(n);
        if (at[n] == null) at[n] = v;
        assert.equal(v, at[n], `need(${n}) at T${kt} R${rc}`);
      }
    });
  }
  // v10's complaint, pinned: R8 LV16 was 233M; LV1 after a rebirth was huge. Now both are the fresh numbers.
  withStorage({ 'taw.keytier': '17', 'taw.rebirths': '8' }, () => {
    assert.equal(need(16), 4180);
    assert.equal(need(1), 120);
  });
  // a v10 caller's second argument (P) is ignored
  assert.equal(needAt(100, 1e9), needAt(100));
});

test('need() is monotone increasing — every level a bit harder than the last', () => {
  for (let n = 2; n <= 20000; n++) assert.ok(need(n) > need(n - 1), `need(${n}) > need(${n - 1})`);
  // "each level only a BIT harder than the last": the step shrinks smoothly — +21% at LV10, +4.4% at LV50,
  // +2.4% at LV100, +1.4% at LV200 — and never reaches zero (the 1.004 lean keeps it above +0.4%)
  assert.ok(close(need(51) / need(50), 1.044, 2e-3));
  assert.ok(close(need(101) / need(100), 1.024, 2e-3));
  assert.ok(close(need(201) / need(200), 1.014, 2e-3));
  for (let n = 50; n < 5000; n++) assert.ok(need(n + 1) / need(n) > 1.004 && need(n + 1) / need(n) < 1.05, `step at LV${n}`);
  // past the double range it saturates at MAX_VALUE: non-decreasing, never Infinity
  for (const n of [171087, 200000, 1e6]) assert.ok(need(n) >= need(170000));
});

// ---- finite need + loop guard -------------------------------------------------------------------------
test('need is ALWAYS finite and > 0 — LV 1e6, Infinity / NaN / negative inputs', () => {
  for (const n of [1, 1000, 40000, 1e6, Infinity, NaN, -5, -Infinity]) {
    const v = needAt(n);
    assert.ok(Number.isFinite(v) && v > 0, `needAt(${n}) = ${v}`);
  }
  assert.ok(Number.isFinite(need(1e6)) && need(1e6) > 0);
  withStorage({ 'taw.keytier': '1000', 'taw.rebirths': '4' }, () => {
    for (const n of [1, 30, 31, 225, 1e6]) assert.ok(Number.isFinite(need(n)) && need(n) > 0);
  });
});

test('creditXp terminates at the extremes (Infinity / huge gains, LV 1e6)', () => {
  const t0 = Date.now();
  const a = creditXp({ level: 1e6, frac: 0.5 }, Number.MAX_VALUE);
  assert.ok(a.state.level >= 1e6 && Number.isFinite(a.state.level));
  assert.ok(a.state.frac >= 0 && a.state.frac < 1);
  const b = creditXp({ level: 1, intoLevel: 0 }, Infinity); // non-finite gain = 0
  assert.equal(b.state.level, 1);
  const d = creditXp({ level: 1, intoLevel: 0 }, 1e300);
  assert.ok(d.state.level > 1000 && Number.isFinite(d.state.level));
  assert.ok(Date.now() - t0 < 5000, 'no runaway loop');
});

test('creditXp across a level boundary carries the remainder exactly', () => {
  const L = 57;
  const r = creditXp({ level: L, frac: 0.75 }, need(L) * 0.25 + need(L + 1) * 0.4);
  assert.equal(r.state.level, L + 1);
  assert.equal(r.leveledUp, true);
  assert.ok(close(r.state.frac, 0.4, 1e-9), `frac ${r.state.frac}`);
  const r2 = creditXp({ level: L, frac: 0 }, need(L) + need(L + 1) + 10);
  assert.equal(r2.state.level, L + 2);
  assert.ok(close(r2.state.intoLevel, 10, 1e-6));
});

// ---- the XP side: KEY +25% a tier, rebirth +100%, wins untouched ------------------------------------------
test('KEY tier: ×1.2 XP / LETTER a tier ("+20%"), compounding; WINS keep their ×2.5', () => {
  assert.equal(KEY_XP_STEP, 1.2);
  assert.equal(LEVEL_XP_PER_LETTER, 10);
  assert.equal(keyXpMult(0), 1);
  assert.ok(close(keyXpMult(1), 1.2));
  assert.ok(close(keyXpMult(5), Math.pow(1.2, 5)));
  assert.equal(keyXpMult(NaN), 1);
  for (const t of [0, 3, 8, 15]) assert.ok(close(levelXpPerLetter(t + 1, 0) / levelXpPerLetter(t, 0), 1.2), `T${t} → T${t + 1} is +20%`);
  assert.ok(Number.isFinite(keyXpMult(5000)) && keyXpMult(5000) > 0, 'finite at absurd tiers');
  // ...while WINS keep KEY's big exponential step (×2.5 a tier past T8), untouched by v11
  assert.equal(keyTierXp(10) / keyTierXp(9), 2.5);
  const winsWord = (kt) => xpPerWord({ mode: 'word-bomb', keyTier: kt, rebirthCount: 0, wordLength: 5, streakMult: 1 });
  assert.ok(close(winsWord(10) / winsWord(9), 2.5, 1e-3));
});

test('rebirth: +100% XP / LETTER per rebirth (×(1+R), the same multiplier wins get); mark: +10–50%', () => {
  assert.equal(REBIRTH_XP_STEP, 1);
  for (const rc of [0, 1, 3, 4, 10, 20]) assert.equal(rebirthXpMult(rc), 1 + rc);
  for (const rc of [0, 1, 7, 26]) assert.equal(rebirthXpMult(rc), rebirthMult(rc), 'one rebirth number for wins and XP');
  assert.ok(close(levelXpPerLetter(4, 3), 10 * Math.pow(1.2, 4) * 4));
  assert.ok(close(levelXpPerLetter(0, 0, 1.3), 13));
  assert.deepEqual(MARK_XP_BOOST, { common: 0.1, rare: 0.2, epic: 0.3, legendary: 0.5 });
  withStorage({}, () => assert.equal(markXpBoost(), 1, 'nothing worn → ×1'));
  withStorage({ 'taw.mark': 'mk-bomber' }, () => assert.ok(markXpBoost() > 1, 'a worn legacy mark boosts letter XP'));
});

test('awardWordXp credits NOTHING to the bar; it still returns the wins product', () => {
  withStorage({ 'taw.keytier': '9', 'taw.rebirths': '4', [XP_KEY]: v10(120, 0.3), [XP_SHADOW_KEY]: v10(120, 0.3), 'taw.econ': '11' }, () => {
    const opts = { mode: 'word-bomb', difficulty: 'easy', wordLength: 6, weight: 1, word: 'qqqqqq', streakMult: 1 };
    const res = awardWordXp(opts);
    assert.equal(res.gain, perWordXp(opts), 'the wins basis is unchanged');
    assert.equal(res.leveledUp, false);
    assert.equal(res.levelXp, undefined);
    assert.equal(res.floor, undefined, 'Option F is gone');
    const p = loadProgress();
    assert.equal(p.level, 120);
    assert.ok(close(p.frac, 0.3, 1e-12), 'the bar did not move');
  });
});

test('LETTERS fill the bar: noteTypedLetters counts a–z added, skips deletions and pastes, batches to one credit', () => {
  assert.equal(lettersAdded('wat', 'wate'), 1);
  assert.equal(lettersAdded('', 'w'), 1);
  assert.equal(lettersAdded('water', 'wate'), 0, 'deletion');
  assert.equal(lettersAdded('', 'water'), 0, 'a paste / autocomplete of 3+ letters is not typing');
  assert.equal(lettersAdded('ab', 'ab1'), 0, 'digits are not letters');
  assert.equal(lettersAdded('ab', 'ab c'), 1);
  withStorage({ 'taw.keytier': '2', 'taw.rebirths': '1', [XP_KEY]: v10(50, 0, 1), [XP_SHADOW_KEY]: v10(50, 0, 1), 'taw.econ': '11' }, () => {
    resetLetterXp();
    let prev = '';
    for (const ch of 'water') {
      noteTypedLetters(prev, prev + ch, 'word-bomb');
      prev += ch;
    }
    assert.equal(loadProgress().intoLevel, 0, 'nothing is written per keystroke');
    const r = flushLetterXp();
    assert.equal(r.xp, Math.round(5 * 10 * 1.44 * 2), '5 letters × BASE 10 × KEY T2 ×1.44 × R1 ×2');
    assert.ok(close(loadProgress().intoLevel, r.xp, 1e-6));
    assert.equal(flushLetterXp(), null, 'an empty flush is a no-op');
  });
});

test('LETTERS: the same anti-mash cap as the menu — at most 30 credited letters a rolling second', () => {
  withStorage({}, () => {
    resetLetterXp();
    let ok = 0;
    for (let i = 0; i < 60; i++) ok += noteLetters(1, 'chain', 1000);
    assert.equal(ok, 30);
    assert.equal(noteLetters(1, 'chain', 2001), 1, 'the window slides');
    assert.equal(flushLetterXp().xp, 31 * 10);
  });
});

test('LETTERS: menu and game price a letter the same (BASE 10 × KEY × rebirth × mark)', () => {
  withStorage({ 'taw.keytier': '5', 'taw.rebirths': '3' }, () => {
    assert.ok(close(letterXpNow(), levelXpPerLetter(5, 3)));
    assert.equal(xpPerInput({}), Math.round(letterXpNow()));
  });
});

test('each KEY tier visibly speeds levels: +20% XP a letter = ~17% fewer letters a level', () => {
  const lettersFor = (kt) => Math.ceil(need(100) / levelXpPerLetter(kt, 0));
  for (const t of [0, 5, 12]) assert.ok(lettersFor(t + 1) / lettersFor(t) < 0.85, `T${t} → T${t + 1}`);
});

test('a rebirth re-climb is FASTER per level than the first climb (the boost is a reward)', () => {
  const climb = () => {
    let letters = 0;
    while (loadProgress().level < 15 && letters < 100000) {
      creditLetterXp(1, { mode: 'word-bomb' });
      letters += 1;
    }
    return letters;
  };
  withStorage({ 'taw.keytier': '3' }, (map) => {
    const first = climb(); // R0
    doRebirth(); // R1, back to LV1, same KEY tier
    assert.equal(loadProgress().level, 1);
    const second = climb();
    assert.ok(second < first, `R1 re-climb ${second} letters vs first climb ${first}`);
    assert.ok(second <= Math.ceil(first / 2) + 15, 'R1 doubles XP a letter → about half the letters');
    map.set('taw.rebirths', '1');
    assert.equal(need(1), 120, 'and the curve the re-climb pays for is the SAME curve');
  });
});

test('a v10 save keeps its level AND fraction under the v11 curve (nobody loses levels)', () => {
  for (const [lv, f, rc, kt] of [[195, 0.99, 4, 7], [168, 0.437, 8, 17], [16, 0.5, 8, 12], [1, 0, 0, 0]]) {
    withStorage({ [XP_KEY]: v10(lv, f, rc), [XP_SHADOW_KEY]: v10(lv, f, rc), 'taw.econ': '10', 'taw.rebirths': String(rc), 'taw.keytier': String(kt) }, (map) => {
      migrateEconomyV11();
      const p = loadProgress();
      assert.equal(p.level, lv);
      assert.ok(close(p.frac, f, 1e-12), `LV${lv} frac ${p.frac}`);
      assert.ok(close(progressOf(p).intoLevel, f * need(lv), 1e-3 * need(lv)), 'into = f × the v11 need');
      assert.equal(storedLevel(), lv);
      assert.equal(map.get(XP_KEY), v10(lv, f, rc), 'stored bytes untouched');
    });
  }
});

test('legacy conversion: LV195 R4 at 99% stays LV195 at 99%', () => {
  const into = Math.floor(needV9(195) * 0.99);
  withStorage({ [XP_KEY]: legacy(195, into), 'taw.rebirths': '4', 'taw.keytier': '10' }, (map) => {
    migrateEconomyV11();
    const p = loadProgress();
    assert.equal(p.level, 195);
    assert.ok(close(p.frac, into / needV9(195), 1e-12), `frac ${p.frac}`);
    assert.ok(p.frac > 0.989);
    const st = JSON.parse(map.get(XP_KEY));
    assert.deepEqual(Object.keys(st).sort(), ['f', 'lv', 'rc', 'v']);
    assert.equal(st.rc, 4);
    assert.ok(close(progressOf(p).intoLevel, p.frac * need(195), 1e-3 * need(195)));
  });
});

test('legacy conversion: a high-level save (v11 is CHEAPER there) neither zeroes nor bursts', () => {
  const into = Math.floor(needV9(400) * 0.9);
  assert.ok(into > need(400), 'the case under test: old into exceeds the new cost');
  withStorage({ [XP_KEY]: legacy(400, into) }, () => {
    migrateEconomyV11();
    const p = loadProgress();
    assert.equal(p.level, 400, 'no free levels');
    assert.ok(close(p.frac, 0.9, 1e-6), `frac ${p.frac} — not zeroed`);
    assert.equal(creditXp(p, 10).state.level, 400);
  });
  withStorage({ [XP_KEY]: legacy(50, 1e30) }, () => {
    const p = loadProgress();
    assert.equal(p.level, 50);
    assert.equal(p.frac, FRAC_MAX);
  });
});

test('a KEY buy mid-level moves NOTHING on the bar: same fraction, same cost', () => {
  withStorage({ 'taw.keytier': '4', 'taw.rebirths': '2' }, (map) => {
    saveProgress({ level: 80, frac: 0.5 });
    const before = progressOf(loadProgress());
    map.set('taw.keytier', '5'); // the buy
    const after = progressOf(loadProgress());
    assert.equal(after.level, 80);
    assert.equal(after.frac, before.frac);
    assert.equal(after.cost, before.cost, 'v11: the level costs the same at every KEY tier');
    const r = creditXp(loadProgress(), 100);
    assert.ok(r.state.frac > 0.5 && r.state.level === 80);
  });
});

test('a KEY / rebirth DROP (restore, reset) keeps the fraction — no burst', () => {
  withStorage({ 'taw.keytier': '12', 'taw.rebirths': '9' }, (map) => {
    saveProgress({ level: 150, frac: 0.97 });
    map.set('taw.keytier', '0');
    map.set('taw.rebirths', '0');
    const p = loadProgress();
    assert.equal(p.level, 150);
    assert.ok(close(p.frac, 0.97));
    assert.equal(creditXp(p, 1).state.level, 150, 'no burst of levels');
  });
});

test('a fraction is never ≥ 1 or negative', () => {
  assert.equal(clampFrac(1), FRAC_MAX);
  assert.equal(clampFrac(Infinity), FRAC_MAX);
  assert.equal(clampFrac(-0.2), 0);
  assert.equal(clampFrac(NaN), 0);
});

// ---- stale tabs / old bundles -------------------------------------------------------------------------
test('a legacy-shaped write AFTER the stamp never raises the level (the shadow is kept)', () => {
  withStorage({ [XP_KEY]: legacy(120, 0), 'taw.rebirths': '3' }, (map) => {
    migrateEconomyV11();
    saveProgress({ level: 121, frac: 0.3 });
    map.set(XP_KEY, legacy(400, 5)); // an old bundle farms the old curve and writes {lv, into}
    assert.equal(resolveXpState((k) => map.get(k) ?? null).source, 'stale');
    assert.equal(storedLevel(), 121);
    const p = loadProgress();
    assert.equal(p.level, 121);
    assert.ok(close(p.frac, 0.3));
    assert.equal(JSON.parse(map.get(XP_KEY)).v, 10, 'rewritten in the v10 shape');
    map.set(XP_KEY, legacy(999, 0));
    assert.equal(migrateEconomyV11().migrated, false);
    assert.equal(JSON.parse(map.get(XP_KEY)).lv, 121);
    map.set(XP_KEY, legacy(999, 0));
    const score = progressScoreFromKeys(Object.fromEntries(map));
    assert.equal(score, progressScoreFromKeys({ 'taw.rebirths': '3', [XP_KEY]: JSON.stringify({ lv: 121, f: 0.3, rc: 3, v: 10 }) }));
  });
});

test('a stale v10 tab (same shape, slower curve) writes a fraction the v11 tab reads as is', () => {
  withStorage({ [XP_KEY]: v10(60, 0.2, 2), [XP_SHADOW_KEY]: v10(60, 0.2, 2), 'taw.econ': '11', 'taw.rebirths': '2' }, (map) => {
    map.set(XP_KEY, v10(61, 0.1, 2)); // the v10 tab levelled once on its (slower) curve
    const p = loadProgress();
    assert.equal(p.level, 61);
    assert.ok(close(p.frac, 0.1));
  });
});

test('a rebirth done in a stale bundle is honoured (taw.rebirths > rc), never above the shadow level', () => {
  withStorage({ [XP_KEY]: legacy(120, 0), 'taw.rebirths': '3' }, (map) => {
    migrateEconomyV11();
    map.set('taw.rebirths', '4');
    map.set(XP_KEY, legacy(9, 0));
    const p = loadProgress();
    assert.equal(p.level, 9);
    assert.equal(JSON.parse(map.get(XP_KEY)).rc, 4);
  });
  withStorage({ [XP_KEY]: legacy(20, 0), 'taw.rebirths': '1' }, (map) => {
    migrateEconomyV11();
    map.set('taw.rebirths', '2');
    map.set(XP_KEY, legacy(300, 0));
    assert.equal(loadProgress().level, 20);
  });
});

test('a legacy save is detected by SHAPE: no shadow → converted; v10 shape → used as is whatever the stamp', () => {
  withStorage({ [XP_KEY]: legacy(60, 100), 'taw.econ': '10' }, () => {
    assert.equal(resolveXpState((k) => globalThis.localStorage.getItem(k)).source, 'legacy');
    assert.equal(loadProgress().level, 60);
  });
  withStorage({ [XP_KEY]: JSON.stringify({ lv: 77, f: 0.25, rc: 0, v: 10 }) }, () => {
    const p = loadProgress();
    assert.equal(p.level, 77);
    assert.equal(p.frac, 0.25);
  });
});

test('doRebirth writes the v10 shape with the NEW rebirth count', () => {
  withStorage({ 'taw.rebirths': '2' }, (map) => {
    saveProgress({ level: 40, frac: 0.6 });
    doRebirth();
    const st = JSON.parse(map.get(XP_KEY));
    assert.deepEqual(st, { lv: 1, f: 0, rc: 3, v: 10 });
    assert.equal(map.get(XP_SHADOW_KEY), map.get(XP_KEY));
  });
});

// ---- the grandfathered rebirth gate (v10, still honoured) ----------------------------------------------
test('the grandfathered rebirth gate: min(table, LV + 25) for the NEXT rebirth, used once', () => {
  withStorage({ [XP_KEY]: legacy(126, 0), 'taw.rebirths': '10' }, (map) => {
    const r = migrateEconomyV11();
    assert.deepEqual(r.gate, { rc: 10, lv: 151 });
    assert.equal(tableRebirthThreshold(10), 225);
    assert.equal(rebirthThreshold(10), 151);
    assert.equal(rebirthThreshold(11), tableRebirthThreshold(11), 'only the NEXT rebirth');
    migrateEconomyV11();
    assert.equal(rebirthThreshold(10), 151, 'a second boot does not move it');
    doRebirth();
    assert.equal(map.has(REBIRTH_GATE_KEY), false, 'spent');
    assert.equal(rebirthThreshold(11), 260);
    map.set('taw.rebirths', '10');
    assert.equal(rebirthThreshold(10), 225);
  });
  // a v10 browser's existing gate survives the bump to 11 untouched
  withStorage({ [XP_KEY]: v10(130, 0.1, 10), [XP_SHADOW_KEY]: v10(130, 0.1, 10), 'taw.econ': '10', 'taw.rebirths': '10', [REBIRTH_GATE_KEY]: JSON.stringify({ rc: 10, lv: 151 }) }, () => {
    migrateEconomyV11();
    assert.equal(rebirthThreshold(10), 151);
  });
  withStorage({ [XP_KEY]: legacy(50, 0), 'taw.rebirths': '3' }, (map) => {
    migrateEconomyV11();
    assert.equal(map.has(REBIRTH_GATE_KEY), false);
    assert.equal(rebirthThreshold(3), 60);
  });
  withStorage({}, (map) => {
    migrateEconomyV11();
    assert.equal(map.has(REBIRTH_GATE_KEY), false);
  });
});
