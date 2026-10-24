import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { answerKey } from './answerKey.js';
import { DAILY_POOL, TIER_ORDER, PER_TIER, RETIRED } from './pool.js';
import {
  PROMPTS, dayNumberFor, dateKeyFor, promptsForDay, judge, displayFor, crowdPoints, crowdWeight, scoreAnswer,
  bandFor, scoreDay, formatPct, buildShareText, shareLink, CROWD_MIN, CROWD_FULL,
} from './engine.js';
import { newRun, loadRun, saveRun, resumeAt, finishDay, currentStreak, loadStreak } from './store.js';
import { parseTallies } from './client.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'));

test('answerKey matches the server examples (blitzLists.js)', () => {
  assert.equal(answerKey('Spider-Man'), 'spiderman');
  assert.equal(answerKey('spider man'), 'spiderman');
  assert.equal(answerKey('Henry VIII'), answerKey('henry 8'));
  assert.equal(answerKey('Henry the Eighth'), answerKey('henry 8th'));
  assert.equal(answerKey('The Beatles'), 'beatles');
  assert.equal(answerKey('Côte d’Ivoire'), 'cotedivoire');
  assert.equal(answerKey('Ivan IV'), 'ivan4');
  assert.equal(answerKey('  '), '');
});

test('PROMPTS = tiers x PER_TIER', () => assert.equal(PROMPTS, TIER_ORDER.length * PER_TIER));

test('day numbers: 2026-01-01 is #1 and round-trip', () => {
  assert.equal(dayNumberFor('2026-01-01'), 1);
  assert.equal(dayNumberFor('2026-10-22'), 295);
  assert.equal(dateKeyFor(295), '2026-10-22');
  assert.ok(Number.isNaN(dayNumberFor('nope')));
});

test('every pool name has a list in data.json', () => {
  for (const tier of TIER_ORDER) {
    for (const name of DAILY_POOL[tier]) {
      assert.ok(data.cats[name], `${name} is in data.json`);
      assert.ok(data.cats[name].a.length >= 10, `${name} has a real list`);
    }
  }
});

test('promptsForDay: six, deterministic, ramped by tier, no repeats inside a cycle', () => {
  const a = promptsForDay(295);
  assert.equal(a.length, PROMPTS);
  assert.deepEqual(promptsForDay(295), a);
  assert.notDeepEqual(promptsForDay(296), a);
  TIER_ORDER.forEach((tier, t) => {
    for (let i = 0; i < PER_TIER; i++) assert.ok(DAILY_POOL[tier].includes(a[t * PER_TIER + i]), `${a[t * PER_TIER + i]} is ${tier}`);
  });
  const easyLen = Math.floor(DAILY_POOL.easy.length / PER_TIER);
  const start = easyLen * 3; // a whole cycle
  const seen = new Set();
  for (let d = start + 1; d <= start + easyLen; d++) {
    for (const n of promptsForDay(d).slice(0, PER_TIER)) {
      assert.ok(!seen.has(n), `easy ${n} repeats inside its cycle`);
      seen.add(n);
    }
  }
  for (let d = 1; d < 400; d++) assert.equal(new Set(promptsForDay(d)).size, PROMPTS);
});

test('RETIRED: days <= 298 are byte-identical to the pre-retirement schedule; no future day shows Studio Ghibli', () => {
  // sha256 of "d:p1|p2|..|p6" for days 1..298 joined by newlines, computed from origin/main's engine BEFORE any
  // retirement existed. Past answers pages and the day being played (298 = 2026-10-25, UTC+14) must not move.
  const past = [];
  for (let d = 1; d <= 298; d++) past.push(`${d}:${promptsForDay(d).join('|')}`);
  assert.equal(createHash('sha256').update(past.join('\n')).digest('hex'),
    '6a77133e9c5e923306b13c6eaf87db1df7bf7dfee98594b5b513ef9bd4e41df8');
  // the retirement map never touches a day before its fromDay (the same schedule with no retirements)
  for (let d = 1; d <= 298; d++) assert.deepEqual(promptsForDay(d), promptsForDay(d, DAILY_POOL, {}), `day ${d}`);
  assert.ok(promptsForDay(297).includes('Studio Ghibli Movies'), 'the live day still has it');
  for (const [old, r] of Object.entries(RETIRED)) {
    assert.equal(r.fromDay, 299);
    assert.ok(!Object.values(DAILY_POOL).some((names) => names.includes(r.replacement)), `${r.replacement} not in the pool`);
    assert.ok(data.cats[r.replacement], `${r.replacement} is in data.json`);
    assert.ok(data.cats[old], `${old} stays in data.json for past answers pages`);
    assert.equal(data.cats[r.replacement].tier, data.cats[old].tier, 'same tier');
    let swapped = 0;
    for (let d = r.fromDay; d < r.fromDay + 400; d++) {
      const p = promptsForDay(d);
      assert.ok(!p.includes(old), `day ${d} still schedules ${old}`);
      assert.equal(new Set(p).size, PROMPTS);
      if (p.includes(r.replacement)) swapped++;
    }
    assert.ok(swapped > 0, 'the replacement actually plays');
  }
});

test('judge: on the list, aliases fold to the canonical key, misses explain themselves', () => {
  const states = data.cats['US states'];
  const tx = judge(states, '  TEXAS ');
  assert.equal(tx.ok, true);
  assert.equal(tx.key, 'texas');
  assert.equal(tx.display, 'Texas');
  assert.ok(tx.prior >= 20 && tx.prior <= 80);
  assert.equal(judge(states, 'Tennesee').key, 'tennessee');
  assert.deepEqual(judge(states, 'Narnia'), { ok: false, reason: 'not_on_list' });
  assert.deepEqual(judge(states, '!!'), { ok: false, reason: 'empty' });
  assert.equal(displayFor(states, 'newyork'), 'New York');
  assert.equal(judge(data.cats['Minecraft mobs'], 'axolotls').key, 'axolotl');
});

test('prior: a familiar answer scores below an obscure one in the same list', () => {
  const states = data.cats['US states'];
  assert.ok(judge(states, 'Texas').prior < judge(states, 'Wyoming').prior);
});

test('crowd scoring: rarer = more, 10..100, blends in from CROWD_MIN to CROWD_FULL plays', () => {
  assert.equal(crowdPoints(0), 100);
  assert.equal(crowdPoints(1), 10);
  assert.ok(crowdPoints(0.5) < crowdPoints(0.1));
  assert.ok(crowdPoints(0.1) < crowdPoints(0.01));
  assert.equal(crowdWeight(CROWD_MIN - 1), 0);
  assert.equal(crowdWeight(CROWD_FULL), 1);
  assert.equal(scoreAnswer({ prior: 40 }, null), 40);
  assert.equal(scoreAnswer({ prior: 40 }, { count: 1, plays: 3 }), 40); // too few plays: the prior
  assert.equal(scoreAnswer({ prior: 40 }, { count: 1, plays: 200 }), crowdPoints(1 / 200));
  assert.equal(scoreAnswer({ prior: null }, { count: 1, plays: 200 }), 0);
});

test('bands: 0 is a MISS, then COMMON..OBSCURE', () => {
  assert.equal(bandFor(0).id, 'miss');
  assert.equal(bandFor(12).id, 'common');
  assert.equal(bandFor(40).id, 'uncommon');
  assert.equal(bandFor(60).id, 'rare');
  assert.equal(bandFor(97).id, 'obscure');
});

test('scoreDay: totals, rarest pick, crowd % per answer', () => {
  const rows = [
    { key: 'texas', display: 'Texas', prior: 20 },
    { key: null },
    { key: 'a', display: 'A', prior: 70 },
    { key: 'b', display: 'B', prior: 30 },
    { key: 'c', display: 'C', prior: 50 },
    { key: 'd', display: 'D', prior: 60 },
  ];
  const noCrowd = scoreDay(rows, null);
  assert.equal(noCrowd.total, 230);
  assert.equal(noCrowd.rarest, 2);
  assert.equal(noCrowd.rows[1].band.id, 'miss');
  const tallies = { plays: 100, prompts: [{ mine: 50 }, { mine: null }, { mine: 2 }, { mine: 40 }, { mine: 1 }, { mine: 10 }] };
  const withCrowd = scoreDay(rows, tallies);
  assert.equal(withCrowd.rows[0].pct, 0.5);
  assert.equal(withCrowd.rows[0].points, crowdPoints(0.5));
  assert.equal(withCrowd.rarest, 4); // 1% beats 2%
  const quiet = scoreDay(rows, { plays: 5, prompts: [{ mine: 2 }, { mine: null }, { mine: 1 }, { mine: 1 }, { mine: 1 }, { mine: 1 }] });
  assert.equal(quiet.rows[0].pct, null, 'below CROWD_MIN the % is the prior estimate, not 2 of 5');
  assert.equal(quiet.rows[0].points, 20);
});

test('formatPct', () => {
  assert.equal(formatPct(0.314), '31%');
  assert.equal(formatPct(0.004), '<1%');
  assert.equal(formatPct(null), '');
});

test('share text: spoiler-free squares + score + streak + ?s=share link', () => {
  const rows = [70, 90, 10, 0, 40, 60].map((p) => ({ points: p, band: bandFor(p) }));
  const txt = buildShareText({ dayNumber: 295, rows, total: 270, streak: 3, origin: 'https://typeaword.com' });
  assert.equal(txt, 'TYPE A WORD · DAILY BLITZ #295\n🟪🟨⬜⬛🟦🟪 270/600\n🔥 3-DAY STREAK\nhttps://typeaword.com/daily?s=share');
  assert.ok(!buildShareText({ dayNumber: 1, rows, total: 1, streak: 1 }).includes('STREAK'));
  assert.equal(shareLink('http://localhost:5173/'), 'http://localhost:5173/daily?s=share');
});

function memStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('store: one run a day — a reload mid-prompt counts that prompt as a miss', () => {
  const s = memStore();
  const run = newRun(295);
  run.rows.push({ key: 'texas', display: 'Texas', prior: 20, typed: 'texas' });
  run.started = 2; // prompt 2 started, never answered
  saveRun(run, s);
  const { run: r, at } = resumeAt(loadRun(295, s));
  assert.equal(at, 2);
  assert.equal(r.rows[1].key, null);
  assert.equal(loadRun(296, s).rows.length, 0); // another day: fresh
});

test('store: streak counts consecutive days once each', () => {
  const s = memStore();
  finishDay(10, 300, s);
  finishDay(10, 500, s); // same day again
  finishDay(11, 200, s);
  assert.equal(loadStreak(s).streak, 2);
  assert.equal(currentStreak(12, s), 2);
  assert.equal(currentStreak(13, s), 0);
});

test('parseTallies: normalises the 062 payload, rejects junk', () => {
  assert.equal(parseTallies(null), null);
  assert.equal(parseTallies({ plays: 3 }), null);
  const t = parseTallies({ plays: 12, prompts: [{ mine: 3, top: [['texas', 5], [1, 2]] }] });
  assert.equal(t.plays, 12);
  assert.equal(t.prompts.length, PROMPTS);
  assert.deepEqual(t.prompts[0], { mine: 3, top: [['texas', 5]] });
  assert.deepEqual(t.prompts[5], { mine: null, top: [] });
});

test('migration 062: private tables, two granted doors, no PII columns', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/062_daily_blitz.sql', import.meta.url), 'utf8');
  assert.match(sql, /grant execute on function public\.daily_blitz_submit\(text, date, text\[\]\) to anon, authenticated/);
  assert.match(sql, /grant execute on function public\.daily_blitz_tallies\(date, text\[\]\) to anon, authenticated/);
  assert.match(sql, /revoke all on private\.daily_blitz_tally from anon, authenticated/);
  assert.doesNotMatch(sql, /\b(ip|email|username|name)\b\s+text/i);
  assert.ok([...sql].every((ch) => ch.charCodeAt(0) < 128), 'ASCII only');
});

test('priorPct runs crowdPoints backwards (the reveal / quiet-day estimate)', async () => {
  const { priorPct, crowdPoints } = await import('./engine.js');
  for (const prior of [20, 35, 55, 80]) {
    assert.ok(Math.abs(crowdPoints(priorPct(prior)) - prior) <= 1, `prior ${prior}`);
  }
  assert.ok(priorPct(20) > priorPct(80), 'a familiar answer reads as more-said');
  assert.equal(priorPct(100), 0);
});
