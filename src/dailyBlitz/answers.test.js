// answers.test.js — the DAILY BLITZ ANSWERS pages: the day math (NEVER a day someone is still playing) and the
// server-rendered HTML (api/daily-answers.js renderRequest, with the tallies call stubbed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { latestPublishedDay, isPublished, newestLiveDay, buildAnswers, LAUNCH_DAY } from './answers.js';
import { dayNumberFor, dateKeyFor } from './day.js';
import { promptsForDay } from './engine.js';
import { renderRequest } from '../../api/daily-answers.js';

const DATA = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
const H = 3600000;

// every real UTC offset, -12h .. +14h in 15-minute steps
const OFFSETS = [];
for (let q = -12 * 4; q <= 14 * 4; q++) OFFSETS.push(q * 15 * 60000);
const localDay = (nowMs, off) => dayNumberFor(new Date(nowMs + off).toISOString().slice(0, 10));

test('the published day is never a day any time zone is still on', () => {
  const start = Date.UTC(2026, 9, 20);
  for (let t = start; t < start + 4 * 24 * H; t += 15 * 60000) {
    const latest = latestPublishedDay(t);
    for (const off of OFFSETS) assert.ok(latest < localDay(t, off), `t=${new Date(t).toISOString()} off=${off / H}h`);
    assert.equal(isPublished(latest + 1, t), false);
  }
});

test('the published day is the one that JUST ended everywhere (not two behind)', () => {
  // 2026-10-24 12:00 UTC: Oct 23 has just ended at UTC-12 -> #296 (2026-10-23) goes up
  const t = Date.UTC(2026, 9, 24, 12, 0);
  assert.equal(dateKeyFor(latestPublishedDay(t)), '2026-10-23');
  assert.equal(dateKeyFor(latestPublishedDay(t - 1)), '2026-10-22');
});

test('isPublished: launch floor, integers only, and the CTA day is the newest live one', () => {
  const t = Date.UTC(2026, 11, 1, 0, 0);
  assert.equal(isPublished(LAUNCH_DAY - 1, t), false);
  assert.equal(isPublished(LAUNCH_DAY, t), true);
  assert.equal(isPublished(300.5, t), false);
  for (const off of OFFSETS) assert.ok(newestLiveDay(t) >= localDay(t, off));
});

test('buildAnswers: real tallies at >= 10 plays, the prior (estimated) below', () => {
  const n = 296;
  const names = promptsForDay(n);
  const first = DATA.cats[names[0]].a;
  const quiet = buildAnswers(n, DATA, { plays: 4, prompts: names.map(() => ({ mine: null, top: [[first[0][0], 3]] })) });
  assert.equal(quiet.plays, 0);
  assert.equal(quiet.prompts.length, 6);
  for (const p of quiet.prompts) {
    assert.equal(p.estimated, true);
    assert.ok(p.said.length >= 1 && p.said.every((r) => r.pct > 0 && r.pct < 1));
    assert.ok(p.rare.length >= 1);
    assert.ok(p.rare.every((r) => !p.said.some((s) => s.display === r.display)), 'rare never repeats a most-said answer');
  }
  const busy = buildAnswers(n, DATA, { plays: 40, prompts: names.map(() => ({ mine: null, top: [[first[0][0], 10]] })) });
  assert.equal(busy.prompts[0].estimated, false);
  assert.equal(busy.prompts[0].said[0].pct, 0.25);
});

test('renderRequest: /daily/answers is real HTML for the latest finished day; today is a 404', async () => {
  const t = Date.UTC(2026, 9, 24, 15, 0); // latest = 2026-10-23 = #296
  const r = await renderRequest({ path: '/daily/answers', nowMs: t, tallies: async () => null, dataJson: DATA });
  assert.equal(r.status, 200);
  assert.match(r.headers['Cache-Control'], /s-maxage=3600/);
  assert.match(r.body, /<title>Daily Blitz #296 answers — Oct 23 \| TYPE A WORD<\/title>/);
  assert.match(r.body, /<link rel="canonical" href="https:\/\/typeaword.com\/daily\/answers" \/>/);
  assert.match(r.body, /property="og:title" content="Daily Blitz #296 answers — Oct 23"/);
  assert.match(r.body, /application\/ld\+json/);
  assert.match(r.body, /PLAY TODAY'S #298/);
  for (const name of promptsForDay(296)) assert.ok(r.body.includes(name.replace(/&/g, '&amp;')), name);
  assert.match(r.body, /\(estimated\)/);
  const past = await renderRequest({ path: '/daily/295', nowMs: t, tallies: async () => null, dataJson: DATA });
  assert.equal(past.status, 200);
  assert.match(past.body, /canonical" href="https:\/\/typeaword.com\/daily\/295"/);
  for (const path of ['/daily/297', '/daily/298', '/daily/294', '/daily/abc']) {
    const no = await renderRequest({ path, nowMs: t, tallies: async () => null, dataJson: DATA });
    assert.equal(no.status, 404, path);
    assert.doesNotMatch(no.body, /MOST SAID/);
  }
});

test('renderRequest escapes list names (no raw HTML from data)', async () => {
  const t = Date.UTC(2026, 11, 1, 15, 0);
  for (let n = LAUNCH_DAY; n <= latestPublishedDay(t); n++) {
    const r = await renderRequest({ path: `/daily/${n}`, nowMs: t, tallies: async () => null, dataJson: DATA });
    assert.equal(r.status, 200);
    assert.doesNotMatch(r.body, /<h2>[^<]*&(?!amp;|lt;|gt;|quot;)/);
  }
});
