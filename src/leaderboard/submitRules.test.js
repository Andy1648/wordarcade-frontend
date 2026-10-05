// The 017_board_reality.sql and 018_rebirth_rush.sql write rules, modelled in submitRules.js (kept in sync with the SQL).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decideSubmit, decideSubmitRR, CONV_CAP } from './submitRules.js';

const T0 = Date.UTC(2026, 9, 3, 17, 0, 0);
const HOUR = 3600 * 1000;

test("Andy's row (LV12 R7, 0 words) + a submit of LV175 R0 = a RESET baseline at LV175, then increases are clamped", () => {
  // his last ACCEPTED submit was long ago — every submit since his local-only reset was dropped by 015/016
  const row = { level: 12, rebirths: 7, lifetime_words: 0, lifetime_letters: 0, submitted_at: T0 - 5 * HOUR };
  const a = decideSubmit(row, { level: 175, rebirths: 0, words: 0, letters: 0 }, T0);
  assert.equal(a.action, 'reset');
  assert.equal(a.row.level, 175);
  assert.equal(a.row.rebirths, 0);
  assert.equal(a.weekDelta, 0);
  assert.equal(a.row.submitted_at, T0);

  // 5 s later (just past the throttle) at LV176 → an INCREASE, inside the clamp (5 s × 0.5 = 2 levels)
  const b = decideSubmit(a.row, { level: 176, rebirths: 0, words: 0, letters: 0 }, T0 + 5001);
  assert.equal(b.action, 'increase');
  assert.equal(b.row.level, 176);
  // …and a forged LV999 in the same window is clamped to 175 + 2
  const c = decideSubmit(a.row, { level: 999, rebirths: 0, words: 0, letters: 0 }, T0 + 5001);
  assert.equal(c.action, 'increase');
  assert.equal(c.row.level, 177);
  // exactly 5 s or less is throttled (SQL: submitted_at >= now() - 5 s)
  assert.equal(decideSubmit(a.row, { level: 176, rebirths: 0, words: 0, letters: 0 }, T0 + 5000).action, 'throttled');
});

test('the first submit is a baseline as submitted (no clamp, no weekly words)', () => {
  const r = decideSubmit({ level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, submitted_at: null }, { level: 900, rebirths: 3, words: 50000, letters: 250000 }, T0);
  assert.equal(r.action, 'first');
  assert.deepEqual(r.row, { level: 900, rebirths: 3, lifetime_words: 50000, lifetime_letters: 250000, submitted_at: T0 });
  assert.equal(r.weekDelta, 0);
});

test('every lower number is a reset: rebirths, words, letters, or level at the same rebirth count', () => {
  const row = { level: 300, rebirths: 2, lifetime_words: 1000, lifetime_letters: 5000, submitted_at: T0 - HOUR };
  const same = { level: 300, rebirths: 2, words: 1000, letters: 5000 };
  for (const lower of [{ rebirths: 1 }, { words: 999 }, { letters: 4999 }, { level: 299 }]) {
    const r = decideSubmit(row, { ...same, ...lower }, T0);
    assert.equal(r.action, 'reset', JSON.stringify(lower));
    assert.equal(r.weekDelta, 0);
  }
  // a full wipe lands exactly as submitted
  const wipe = decideSubmit(row, { level: 1, rebirths: 0, words: 0, letters: 0 }, T0);
  assert.deepEqual(wipe.row, { level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, submitted_at: T0 });
  // a level DROP across a rebirth is a normal rebirth (increase path), not a reset
  assert.equal(decideSubmit(row, { level: 5, rebirths: 3, words: 1000, letters: 5000 }, T0).action, 'increase');
});

test('a lower submit is written as submitted, never clamped down further', () => {
  const row = { level: 5222, rebirths: 0, lifetime_words: 800, lifetime_letters: 4000, submitted_at: T0 - 10_000 };
  const r = decideSubmit(row, { level: 4000, rebirths: 0, words: 800, letters: 4000 }, T0);
  assert.equal(r.action, 'reset');
  assert.equal(r.row.level, 4000);
});

test('MIXED: rebirths lower but level higher — the level is capped by the clamp counted from 1 (never below the stored level)', () => {
  // 10 s since the last accepted submit: allowance = 5 levels → cap = max(stored 12, 1 + 5) = 12
  const row = { level: 12, rebirths: 7, lifetime_words: 0, lifetime_letters: 0, submitted_at: T0 - 10_000 };
  const r = decideSubmit(row, { level: 175, rebirths: 0, words: 0, letters: 0 }, T0);
  assert.equal(r.action, 'reset');
  assert.equal(r.row.level, 12);
  // 100 s: allowance 50 → cap = max(12, 51) = 51
  const r2 = decideSubmit({ ...row, submitted_at: T0 - 100_000 }, { level: 175, rebirths: 0, words: 0, letters: 0 }, T0);
  assert.equal(r2.row.level, 51);
  // a 1-level-row reset with a higher level: counted from 1 → 1 + allowance
  const r3 = decideSubmit({ level: 1, rebirths: 4, lifetime_words: 0, lifetime_letters: 0, submitted_at: T0 - 20_000 }, { level: 500, rebirths: 0, words: 0, letters: 0 }, T0);
  assert.equal(r3.row.level, 11);
  // words lower but rebirths/words/letters UP elsewhere: rebirths ≤ +1, letters capped at 150/s (not rejected)
  const r4 = decideSubmit(
    { level: 50, rebirths: 2, lifetime_words: 100, lifetime_letters: 100, submitted_at: T0 - 10_000 },
    { level: 50, rebirths: 9, words: 0, letters: 1_000_000 },
    T0,
  );
  assert.equal(r4.action, 'reset');
  assert.equal(r4.row.rebirths, 3);
  assert.equal(r4.row.lifetime_letters, 100 + 1500);
  assert.equal(r4.row.lifetime_words, 0);
});

test('increases stay rate-checked exactly as 015: words/letters too fast → rejected; rebirth restarts the clamp at 1', () => {
  const row = { level: 100, rebirths: 1, lifetime_words: 1000, lifetime_letters: 5000, submitted_at: T0 - 10_000 };
  assert.equal(decideSubmit(row, { level: 101, rebirths: 1, words: 1201, letters: 5000 }, T0).action, 'rejected');
  assert.equal(decideSubmit(row, { level: 101, rebirths: 1, words: 1000, letters: 6501 }, T0).action, 'rejected');
  const ok = decideSubmit(row, { level: 101, rebirths: 1, words: 1200, letters: 6500 }, T0);
  assert.equal(ok.action, 'increase');
  assert.equal(ok.weekDelta, 200);
  const reb = decideSubmit(row, { level: 80, rebirths: 4, words: 1000, letters: 5000 }, T0);
  assert.equal(reb.row.rebirths, 2);
  assert.equal(reb.row.level, 6); // counted from 1: 1 + 5
  // the 20-minute bank: 2 h away → at most 600 levels
  const back = decideSubmit({ ...row, submitted_at: T0 - 2 * HOUR }, { level: 5000, rebirths: 1, words: 1000, letters: 5000 }, T0);
  assert.equal(back.row.level, 700);
});

test('017 SQL carries the same branches + constants as this model', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '017_board_reality.sql'), 'utf8');
  assert.match(sql, /KEEP IN SYNC WITH src\/leaderboard\/submitRules\.js/);
  assert.match(sql, /interval '5 seconds'/);
  assert.match(sql, /rb < old\.rebirths or w < old\.lifetime_words or l < old\.lifetime_letters\s+or \(lv < old\.level and rb = old\.rebirths\)/);
  assert.match(sql, /least\(lv::bigint, greatest\(old\.level::bigint, 1 \+ max_rise\)\)/);
  assert.match(sql, /floor\(least\(secs, 1200\) \* 0\.5\)/);
  assert.match(sql, /20 \* secs/);
  assert.match(sql, /150 \* secs/);
  assert.match(sql, /least\(rb, old\.rebirths \+ 1\)/);
  assert.match(sql, /econ = 10/);
});

// ---- REBIRTH RUSH: 018_rebirth_rush.sql's private.lb_board_write_rr, modelled by decideSubmitRR ----------------
const MIN = 60 * 1000;
const rrRow = (o) => ({ level: 1, rebirths: 0, lifetime_words: 1000, lifetime_letters: 5000, econ: 12, rb_clock: null, submitted_at: T0 - 10 * MIN, ...o });
const same = (r) => ({ level: r.level, rebirths: r.rebirths, words: r.lifetime_words, letters: r.lifetime_letters });

test('RR conversion: the real board rows land at their converted rebirth count in ONE submit, once', () => {
  for (const [name, lv, r, want] of [['snapplemelon', 195, 4, 11], ['Xavi', 168, 8, 9], ['elol', 156, 7, 8]]) {
    // last written on econ 11, just past the throttle, with an EMPTY token bucket — only the bonus can lift it
    const row = rrRow({ level: lv, rebirths: r, econ: 11, rb_clock: T0 - 10, submitted_at: T0 - 5001 });
    const d = decideSubmitRR(row, { ...same(row), level: 1, rebirths: want }, T0);
    assert.equal(d.action, 'increase', name);
    assert.equal(d.row.rebirths, want, name);
    assert.equal(d.row.level, 1, name);
    assert.equal(d.row.econ, 12, name);
    assert.equal(d.row.rb_clock, row.rb_clock, `${name}: conversion rebirths spend no tokens`);
    // the bonus is spent: the same jump again (row now econ 12) is held to the (empty) token bucket
    const again = decideSubmitRR({ ...d.row, submitted_at: T0 - 5001, rb_clock: T0 - 10 }, { ...same(d.row), rebirths: want + 7 }, T0);
    assert.equal(again.row.rebirths, want, `${name}: no second conversion`);
  }
  // a row below its gate (Daan / Tangie / maSON / creator / NoBuffCookies shape): no bonus
  const keep = rrRow({ level: 120, rebirths: 10, econ: 11, rb_clock: T0 - 10, submitted_at: T0 - 5001 });
  assert.equal(decideSubmitRR(keep, { ...same(keep), rebirths: 12 }, T0).row.rebirths, 10);
});

test('RR conversion bonus is CAPPED at 15 rebirths: a forged old level cannot mint hundreds', () => {
  assert.equal(CONV_CAP, 15);
  // a forged LV5000 R0 on econ 11 would convert to +278; the board grants at most +15 (empty bucket)
  const forged = rrRow({ level: 5000, rebirths: 0, econ: 11, rb_clock: T0 - 10, submitted_at: T0 - 5001 });
  assert.equal(decideSubmitRR(forged, { ...same(forged), level: 1, rebirths: 278 }, T0).row.rebirths, 15);
  // exactly at the cap: LV267 R0 → floor(252/18)+1 = 15, all granted
  const edge = rrRow({ level: 267, rebirths: 0, econ: 11, rb_clock: T0 - 10, submitted_at: T0 - 5001 });
  assert.equal(decideSubmitRR(edge, { ...same(edge), level: 1, rebirths: 15 }, T0).row.rebirths, 15);
});

test('RR rebirths: a token bucket — 1 per minute, 60 banked, no free +1 per submit', () => {
  // full bucket (null clock): an hour of play without a menu load lands up to 60 rebirths at once
  const full = rrRow({ rebirths: 5 });
  const a = decideSubmitRR(full, { ...same(full), rebirths: 40 }, T0);
  assert.equal(a.row.rebirths, 40);
  assert.equal(a.row.rb_clock, T0 - 60 * MIN + 35 * MIN, '35 tokens spent from a full bucket');
  assert.equal(decideSubmitRR(full, { ...same(full), rebirths: 500 }, T0).row.rebirths, 65, 'capped at the 60-token burst');
  // spamming submits every 5 s with an empty bucket mints nothing; a minute after the clock mints one
  let row = rrRow({ rebirths: 5, rb_clock: T0, submitted_at: T0 });
  for (let i = 1; i <= 11; i++) row = decideSubmitRR(row, { ...same(row), rebirths: 99 }, T0 + i * 5001).row;
  assert.equal(row.rebirths, 5, '55 s of spam: still no token');
  row = decideSubmitRR(row, { ...same(row), rebirths: 99 }, T0 + 61_000).row;
  assert.equal(row.rebirths, 6, 'one minute → one rebirth');
  // honest early pace from an EMPTY bucket: a rebirth every 2 min, submitting after each, never clamped
  let h = rrRow({ rebirths: 0, rb_clock: T0, submitted_at: T0 });
  for (let i = 1; i <= 30; i++) {
    const d = decideSubmitRR(h, { ...same(h), level: 1, rebirths: i }, T0 + i * 2 * MIN);
    assert.equal(d.row.rebirths, i);
    h = d.row;
  }
});

test("RR level: free within the next gate + 50 headroom (019); past that, 015's +0.5/s", () => {
  // rebirthed to R20 and climbed to LV525 inside one submit window (019 gate(R20) = 25 × 21 = 525)
  const row = rrRow({ level: 480, rebirths: 19, submitted_at: T0 - 6000 });
  assert.equal(decideSubmitRR(row, { ...same(row), level: 525, rebirths: 20 }, T0).row.level, 525);
  assert.equal(decideSubmitRR(row, { ...same(row), level: 900, rebirths: 20 }, T0).row.level, 25 * (20 + 1) + 50);
  // same run, no rebirth, already past the headroom: 015's allowance from the stored level (100 s → +50)
  const past = rrRow({ level: 600, rebirths: 20, submitted_at: T0 - 100_000 });
  assert.equal(decideSubmitRR(past, { ...same(past), level: 999 }, T0).row.level, 650);
  // a rebirth drops the level: an increase (rebirths went up), not a reset
  const reb = decideSubmitRR(row, { ...same(row), level: 3, rebirths: 20 }, T0);
  assert.equal(reb.action, 'increase');
  assert.equal(reb.row.level, 3);
});

test('RR keeps 017: throttle, first baseline, reset as baseline, words/letters rate rejects', () => {
  const row = rrRow({ level: 50, rebirths: 3 });
  assert.equal(decideSubmitRR({ ...row, submitted_at: T0 - 5000 }, same(row), T0).action, 'throttled');
  const first = decideSubmitRR({ ...row, submitted_at: null }, { level: 9000, rebirths: 400, words: 1, letters: 1 }, T0);
  assert.equal(first.action, 'first');
  assert.equal(first.row.rebirths, 400);
  const wipe = decideSubmitRR(row, { level: 1, rebirths: 0, words: 0, letters: 0 }, T0);
  assert.equal(wipe.action, 'reset');
  assert.deepEqual([wipe.row.level, wipe.row.rebirths, wipe.row.lifetime_words], [1, 0, 0]);
  assert.equal(decideSubmitRR(row, { ...same(row), words: 1000 + 20 * 600 + 1 }, T0).action, 'rejected');
  assert.equal(decideSubmitRR(row, { ...same(row), letters: 5000 + 150 * 600 + 1 }, T0).action, 'rejected');
  // NoBuffCookies-style mixed reset: rebirths lower, level higher → capped at gate(R0) + 50 = 75 (019), counted from 1
  const nb = rrRow({ level: 12, rebirths: 7, submitted_at: T0 - 10_000 });
  assert.equal(decideSubmitRR(nb, { ...same(nb), level: 175, rebirths: 0 }, T0).row.level, 75);
});

test('018 SQL carries the same branches + constants as decideSubmitRR, gated on econ 12, board rebirths-first', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '018_rebirth_rush.sql'), 'utf8');
  assert.match(sql, /KEEP IN SYNC WITH src\/leaderboard\/submitRules\.js \(decideSubmitRR\)/);
  assert.match(sql, /RB_SECS constant integer := 60;/);
  assert.match(sql, /RB_BURST constant integer := 60;/);
  assert.match(sql, /LV_HEADROOM constant integer := 36;/);
  assert.match(sql, /coalesce\(old\.econ, 0\) < 12 and old\.level >= old_gate/);
  assert.match(sql, /least\(CONV_CAP, floor\(\(old\.level - old_gate\) \/ 18\.0\)::bigint \+ 1\)/);
  assert.match(sql, /CONV_CAP constant integer := 15;/);
  assert.match(sql, /least\(rb::bigint, old\.rebirths::bigint \+ conv \+ tokens\)/);
  assert.match(sql, /greatest\(15 \+ 18 \* rb::bigint \+ LV_HEADROOM, base_lv \+ max_rise\)/);
  assert.match(sql, /floor\(least\(secs, 1200\) \* 0\.5\)/);
  assert.match(sql, /interval '5 seconds'/);
  assert.match(sql, /20 \* secs/);
  assert.match(sql, /150 \* secs/);
  assert.equal((sql.match(/p_econ is distinct from 12/g) || []).length, 3, 'lb_submit3 / lb_save2 / lb_load2');
  assert.doesNotMatch(sql, /p_econ is distinct from 1[01]\b/);
  assert.match(sql, /'econ', 12\)/);
  assert.match(sql, /order by rebirths desc, level desc, lifetime_words desc, created_at asc/);
});

test('019 SQL mirrors decideSubmitRR: round gate 25 × (R+1) + 50 headroom, conversion frozen at 15 + 18R', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '019_round_rebirth_gate.sql'), 'utf8');
  assert.match(sql, /LV_HEADROOM constant integer := 50;/);
  assert.match(sql, /lv_cap := greatest\(25 \* \(rb::bigint \+ 1\) \+ LV_HEADROOM, base_lv \+ max_rise\);/);
  assert.match(sql, /old_gate := 15 \+ 18 \* old\.rebirths/);
});
