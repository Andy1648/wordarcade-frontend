// dailyBlitz/answers.js — the DAILY BLITZ ANSWERS pages (typeaword.com/daily/answers and /daily/<n>), rendered
// on the SERVER (api/daily-answers.js) so crawlers get real HTML for "daily blitz answers today" searches.
// PURE: no DOM, no fetch, no clock (the handler passes `now`) — everything here runs under `node --test`.
//
// NEVER TODAY: the daily is keyed on each player's LOCAL date, so a day is still being played somewhere from
// its 00:00 at UTC+14 until its 24:00 at UTC-12 — i.e. until (day+1) 12:00 UTC. A day is only published
// once that moment has passed everywhere, so no time zone can ever read the answers to its live puzzle.
import { promptsForDay, PROMPTS, CROWD_MIN, formatPct, priorPct } from './engine.js';
import { dateKeyFor } from './day.js';
import { formatNum } from '../format.js';

const DAY_MS = 86400000;
const EPOCH = Date.UTC(2026, 0, 1); // #1 (day.js)
const LAST_ZONE_MS = 12 * 3600000; // UTC-12 is the last place a calendar date ends
export const LAUNCH_DAY = 295; // 2026-10-22, the day DAILY BLITZ shipped (PR #490) — no pages before it
const SITE = 'https://typeaword.com';

/** The newest day whose puzzle is over in EVERY time zone (its answers may be shown). */
export function latestPublishedDay(nowMs = Date.now()) {
  // day D ends everywhere at EPOCH + D*DAY_MS + 12h  (start of D+1 UTC, plus UTC-12's lag)
  return Math.floor((nowMs - LAST_ZONE_MS - EPOCH) / DAY_MS);
}

/** Is day `n` an answers page we serve right now? (launched, finished everywhere, an integer) */
export function isPublished(n, nowMs = Date.now()) {
  return Number.isInteger(n) && n >= LAUNCH_DAY && n <= latestPublishedDay(nowMs);
}

/** The newest day a player ANYWHERE could be on (UTC+14) — the "PLAY TODAY'S #N" number for the CTA. */
export function newestLiveDay(nowMs = Date.now()) {
  return Math.floor((nowMs + 14 * 3600000 - EPOCH) / DAY_MS) + 1;
}

/** "October 23, 2026" for a day number (UTC — a date key has no zone). */
export function longDate(n) {
  const [y, m, d] = dateKeyFor(n).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
}
function shortDate(n) {
  const [y, m, d] = dateKeyFor(n).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
}

/**
 * The page model for day `n`: per prompt, the most-said answers (the real tallies when the day had >= CROWD_MIN
 * plays, else the list's most familiar answers with the prior's ESTIMATED share, labelled "~") and a few rare
 * valid answers. `tallies` = client.js parseTallies() shape or null.
 */
export function buildAnswers(n, data, tallies = null) {
  const plays = tallies && tallies.plays >= CROWD_MIN ? tallies.plays : 0;
  const prompts = promptsForDay(n).slice(0, PROMPTS).map((name, i) => {
    const cat = data && data.cats ? data.cats[name] : null;
    const list = cat ? cat.a : [];
    const byKey = new Map(list.map(([k, d, p]) => [k, { key: k, display: d, prior: p }]));
    const keys = list.map((r) => r[0]);
    // short forms / nicknames of a longer entry ("Cali" for California, "Was" for Washington) are valid answers,
    // but neither a fair "most said" estimate nor what anyone would call a rare answer
    const nickname = (r) => r.display.length <= 3 || keys.some((k) => k !== r.key && k.startsWith(r.key));
    let said = [];
    let estimated = false;
    const t = plays && tallies.prompts ? tallies.prompts[i] : null;
    if (t && t.top && t.top.length) {
      said = t.top.map(([k, c]) => byKey.get(k) && { ...byKey.get(k), pct: c / plays }).filter(Boolean).slice(0, 5);
    }
    if (!said.length) {
      estimated = true;
      // one entry per display name (aliases share a display), most familiar first
      const seen = new Set();
      said = [...byKey.values()].sort((a, b) => a.prior - b.prior || a.display.localeCompare(b.display))
        .filter((r) => !nickname(r) && (seen.has(r.display) ? false : seen.add(r.display))).slice(0, 3)
        .map((r) => ({ ...r, pct: priorPct(r.prior) }));
    }
    const shown = new Set(said.map((r) => r.display));
    const seenRare = new Set();
    // rare picks: the highest prior, ties broken by a per-day hash (a list's priors plateau — 45 US states share
    // one — so alphabetical would print Alabama every time)
    const rare = [...byKey.values()].filter((r) => !shown.has(r.display) && !nickname(r))
      .sort((a, b) => b.prior - a.prior || tieHash(`${n}|${name}|${a.key}`) - tieHash(`${n}|${name}|${b.key}`))
      .filter((r) => (seenRare.has(r.display) ? false : seenRare.add(r.display))).slice(0, 4);
    const total = new Set(list.map((r) => r[1])).size;
    return { name, said, estimated, rare, total };
  });
  return { n, dateKey: dateKeyFor(n), plays, prompts };
}

function tieHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The whole HTML document for a model (see buildAnswers). `opts.canonicalPath` = '/daily/answers' or '/daily/<n>'. */
export function renderAnswersPage(model, { nowMs = Date.now(), canonicalPath } = {}) {
  const { n, prompts, plays } = model;
  const live = newestLiveDay(nowMs);
  const latest = latestPublishedDay(nowMs);
  const path = canonicalPath || `/daily/${n}`;
  const title = `Daily Blitz #${n} answers — ${shortDate(n)} | TYPE A WORD`;
  const first = prompts.map((p) => p.name).join(', ');
  const desc = `Daily Blitz #${n} (${longDate(n)}) answers: the most-said and the rarest answers for ${first}. Play today's #${live} free.`;
  const crowdLine = plays
    ? `${formatNum(plays)} players · % = share of players who gave that answer`
    : 'A quiet day — % are estimates (~) from how familiar each answer is';
  const items = prompts.map((p, i) => `
    <section class="p">
      <h2><span class="k">${i + 1}</span>${esc(p.name)}</h2>
      <h3>MOST SAID${p.estimated ? ' <small>(estimated)</small>' : ''}</h3>
      <ol class="said">${p.said.map((r) => `<li><b>${esc(r.display)}</b><i>${p.estimated ? '~' : ''}${esc(formatPct(r.pct))}</i></li>`).join('')}</ol>
      <h3>RARE ANSWERS (THEY SCORE MOST)</h3>
      <ul class="rare">${p.rare.map((r) => `<li>${esc(r.display)}</li>`).join('')}</ul>
      <p class="tot">${p.total} valid answers on this list</p>
    </section>`).join('');
  const prev = n - 1 >= LAUNCH_DAY ? `<a class="nav" href="/daily/${n - 1}">← #${n - 1}</a>` : '<span></span>';
  const next = n + 1 <= latest ? `<a class="nav" href="/daily/${n + 1}">#${n + 1} →</a>` : '<span></span>';
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Daily Blitz #${n} answers — ${longDate(n)}`,
    datePublished: dateKeyFor(n + 1),
    url: `${SITE}${path}`,
    image: `${SITE}/og-daily.png`,
    publisher: { '@type': 'Organization', name: 'TYPE A WORD', url: `${SITE}/` },
    about: { '@type': 'VideoGame', name: 'Daily Blitz', url: `${SITE}/daily` },
  };
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${SITE}${path}" />
<meta property="og:site_name" content="Type a Word" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${esc(`Daily Blitz #${n} answers — ${shortDate(n)}`)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${SITE}${path}" />
<meta property="og:image" content="${SITE}/og-daily.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(`Daily Blitz #${n} answers — ${shortDate(n)}`)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${SITE}/og-daily.png" />
<link rel="icon" href="/favicon.ico" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Bungee&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>
:root{--blue:#3DA8FF;--blue-dk:#1f6fc4;--panel:#1a0b2e;--edge:#3d2566}
*{box-sizing:border-box}
body{margin:0;background:#0d0618;color:#fff;font:400 18px/1.45 'Space Mono',monospace}
main{max-width:860px;margin:0 auto;padding:20px 16px 48px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.home{color:#2EFFE0;font:400 18px/1 'Bungee',cursive;text-decoration:none;-webkit-text-stroke:3px #000;paint-order:stroke fill}
.hero{display:flex;align-items:center;gap:16px;margin:18px 0 8px}
.hero img{width:96px;height:auto;flex:none}
h1{margin:0;font:400 clamp(32px,7vw,56px)/1 'Bungee',cursive;color:var(--blue);-webkit-text-stroke:7px #000;paint-order:stroke fill}
.date{margin:6px 0 0;color:#9fc8ff;font-weight:700}
.crowd{margin:14px 0 18px;color:#c9b8e8}
.cta{display:flex;align-items:center;justify-content:center;min-height:56px;padding:0 24px;margin:0 0 24px;background:var(--blue);border:4px solid var(--blue-dk);border-radius:8px;box-shadow:6px 6px 0 #000;color:#000;font:400 clamp(20px,4vw,28px)/1 'Bungee',cursive;text-decoration:none;transition:transform 80ms}
.cta:active{transform:translate(6px,6px);box-shadow:none}
.p{margin:0 0 18px;padding:16px 18px;background:var(--panel);border:4px solid var(--edge);border-radius:8px;box-shadow:6px 6px 0 #000}
h2{display:flex;align-items:center;gap:12px;margin:0 0 10px;font:400 clamp(22px,4.5vw,32px)/1.1 'Bungee',cursive;-webkit-text-stroke:5px #000;paint-order:stroke fill}
.k{flex:none;display:inline-grid;place-items:center;width:40px;height:40px;background:#FFE94A;border:3px solid #000;border-radius:8px;color:#000;font-size:22px;-webkit-text-stroke:0}
h3{margin:12px 0 6px;font:700 16px/1.2 'Space Mono',monospace;color:#9fc8ff;letter-spacing:1px}
h3 small{color:#8a7aa8;font-size:16px}
ol,ul{margin:0;padding:0;list-style:none}
.said li{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:2px dashed #3d2566}
.said b{font:400 20px/1.2 'Bungee',cursive}
.said i{font-style:normal;font-weight:700;color:#2EFFE0}
.rare{display:flex;flex-wrap:wrap;gap:8px}
.rare li{padding:4px 10px;background:#FFD54A;border:3px solid #b8961a;border-radius:8px;color:#000;font-weight:700}
.tot{margin:10px 0 0;color:#8a7aa8;font-size:16px}
.navs{display:flex;justify-content:space-between;margin:8px 0 22px}
.nav{color:#FFE94A;font-weight:700;text-decoration:none;padding:10px 0;min-height:44px}
.foot{color:#8a7aa8;font-size:16px}
.foot a{color:#9fc8ff}
@media (prefers-reduced-motion:reduce){.cta{transition:none}}
</style>
</head><body><main>
<div class="top"><a class="home" href="/">TYPE A WORD</a><a class="nav" href="/daily/answers">LATEST ANSWERS</a></div>
<div class="hero"><img src="/cards/cb-hero.webp" alt="" width="96" height="144" />
<div><h1>DAILY BLITZ #${n} ANSWERS</h1><p class="date">${esc(longDate(n))}</p></div></div>
<p class="crowd">${esc(crowdLine)}</p>
<a class="cta" href="/daily">PLAY TODAY'S #${live} →</a>
${items}
<nav class="navs" aria-label="Other days">${prev}${next}</nav>
<a class="cta" href="/daily">PLAY TODAY'S #${live} →</a>
<p class="foot">Daily Blitz: 6 prompts, one answer each, 20 seconds a prompt — the rarer your answer, the more it scores. Answers go up once a day is over in every time zone. <a href="/category-blitz/">Category Blitz</a> · <a href="/">All games</a></p>
</main></body></html>`;
}
