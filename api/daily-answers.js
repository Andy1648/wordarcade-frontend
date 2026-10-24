// api/daily-answers.js — server-rendered DAILY BLITZ ANSWERS pages (vercel.json rewrites):
//   /daily/answers -> the newest day that is over in every time zone ("yesterday")
//   /daily/<n>     -> a past day (#LAUNCH_DAY .. latest); anything newer or older is a 404, never a spoiler
// Real HTML for crawlers ("daily blitz answers today"). The tallies (migration 062) are read with the public
// anon key — the same read-only RPC the results screen calls — and the page is CDN-cached for an hour.
import { readFileSync } from 'node:fs';
import { buildAnswers, renderAnswersPage, latestPublishedDay, isPublished } from '../src/dailyBlitz/answers.js';
import { parseTallies } from '../src/dailyBlitz/tallies.js';
import { dateKeyFor } from '../src/dailyBlitz/day.js';

let DATA = null;
function data() {
  if (!DATA) DATA = JSON.parse(readFileSync(new URL('../src/dailyBlitz/data.json', import.meta.url), 'utf8'));
  return DATA;
}

/** The day's tallies from Supabase, or null (no env, timeout, the RPC refusing) — the page then uses the prior. */
export async function fetchDayTallies(n, env = process.env, fetchImpl = globalThis.fetch) {
  const raw = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  const base = raw.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  if (!base || !key || !fetchImpl) return null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3000);
    const r = await fetchImpl(`${base}/rest/v1/rpc/daily_blitz_tallies`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_day: dateKeyFor(n), p_answers: null }),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    return parseTallies(await r.json());
  } catch {
    return null;
  }
}

/** Pure-ish core (tests call it): -> { status, headers, body }. */
export async function renderRequest({ path, nowMs = Date.now(), tallies = fetchDayTallies, dataJson = data() }) {
  const m = /^\/daily\/(?:answers\/?|(\d{1,5})\/?)$/.exec(path || '');
  const latest = latestPublishedDay(nowMs);
  const n = m && m[1] ? Number(m[1]) : latest;
  if (!m || !isPublished(n, nowMs)) {
    return {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=600' },
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Not out yet | Daily Blitz answers</title></head><body style="margin:0;background:#0d0618;color:#fff;font:18px/1.5 monospace;padding:24px"><h1>No answers here (yet)</h1><p>Answers go up once a day is over in every time zone — no spoilers for a puzzle someone is still playing.</p><p><a style="color:#3DA8FF" href="/daily/answers">Latest answers</a> · <a style="color:#3DA8FF" href="/daily">Play today's Daily Blitz</a></p></body></html>`,
    };
  }
  const t = await tallies(n);
  const html = renderAnswersPage(buildAnswers(n, dataJson, t), { nowMs, canonicalPath: m[1] ? `/daily/${n}` : '/daily/answers' });
  return {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // /daily/answers rolls over daily and its tallies settle within the hour; a past day changes less often
      'Cache-Control': m[1] ? 'public, max-age=300, s-maxage=21600, stale-while-revalidate=86400' : 'public, max-age=300, s-maxage=3600, stale-while-revalidate=3600',
    },
    body: html,
  };
}

export default async function handler(req, res) {
  // the rewrite hands us the ORIGINAL path in ?path= (vercel.json); fall back to the URL itself
  const url = new URL(req.url || '/', 'https://typeaword.com');
  const path = url.searchParams.get('path') || url.pathname;
  const out = await renderRequest({ path });
  res.statusCode = out.status;
  for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
  res.end(out.body);
}
