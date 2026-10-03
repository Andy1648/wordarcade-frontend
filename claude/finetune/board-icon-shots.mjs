// board-icon-shots.mjs — Andy oct3 11:42: the leaderboard TROPHY → PODIUM fine-tune, round 2 (the verdict: ONE
// hybrid SVG podium — b's single shadow layer + c's cream die-cut inside the SVG, no plate, no ?biv switch).
// Shoots it through the REAL menu path and prints the icon's px against the STATS / SHOP chips as JSON.
//
//   menu-<size>-<state>.png / corner-<size>-<state>.png
//       sizes 2560x1440, 1920x1080, 1366x625, 1280x551, 390x844, 360x740
//       states rank9 (lastRank already 9: no rank-up), unranked (the star)
//   rank-<size>-<label>.png    #9, #42, #800, 1.2K (rank 1200) at 390x844, 360x740, 1280x551 (corner crops)
//   board-header-<size>.png    the LeaderboardScreen header (podium wearing #9) at 1920x1080, 390x844, 360x740
//   bounce-peak-<size>.png     the rank-up jump frozen AT ITS PEAK (the icon's data-bump-peak-ms), #12 → #9,
//                              at 1280x551 (the tight corner), 1920x1080 and 390x844 — with the RANK UP card
//                              (its podium wears the star, not a second "#9")
// Measurements → claude/finetune/board-icon/measure.json (and stdout): button / podium / number px (the
// component's own data-num-px = the rendered font px), area vs STATS and SHOP, overlaps, infinite animations.
//
// BUILD FIRST with the e2e Supabase env (the board API is mocked at lb.e2e.invalid, like h2a-final-shots.mjs):
//   VITE_SUPABASE_URL='https://lb.e2e.invalid/rest/v1/' VITE_SUPABASE_ANON_KEY='e2e-anon-key' npx vite build
//   npx vite preview --port 4190 --strictPort      (check nothing stale already listens on 4190)
// then:
//   node claude/finetune/board-icon-shots.mjs [url] [sizes, e.g. 2560x1440,390x844]
//
// FONTS: installBackendMock aborts every non-localhost request — including Google Fonts — unless SHOT_FONTS is
// set (e2e/support/backendMock.js). Round 1 shot every frame in the FALLBACK font because of it. Set here, before
// any mock is installed, so Bungee + Space Mono load.
process.env.SHOT_FONTS = '1';

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import { mockBoard } from '../../e2e/support/boardMock.js';

const URL = process.argv[2] || 'http://localhost:4190';
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const OUT = process.env.BIV_OUT || 'claude/finetune/board-icon';
const want = ([w, h]) => !ONLY || ONLY.includes(`${w}x${h}`);
const SIZES = [[2560, 1440], [1920, 1080], [1366, 625], [1280, 551], [390, 844], [360, 740]].filter(want);
const RANK_SIZES = [[390, 844], [360, 740], [1280, 551]].filter(want);
const RANKS = [[9, '9'], [42, '42'], [800, '800'], [1200, '1.2K']];
mkdirSync(OUT, { recursive: true });

// the h2a board: named players above you; more filler above when a deeper rank is wanted
const NAMED = [
  ['snapplemelon', 195, 4, 606], ['Xavi', 168, 8, 849], ['elol', 156, 7, 321], ['NoBuffCookies', 147, 6, 0],
  ['Daan', 144, 9, 1196], ['Tangie', 126, 10, 1013], ['maSON_im_cRYAN', 119, 8, 512], ['creator', 118, 6, 193],
];
const BELOW = [['wordgoblin', 40, 1, 120], ['qwertyuiop', 31, 0, 90], ['zz_top', 22, 0, 60]];
const row = ([username, level, rebirths, lifetime_words], i) => ({ id: `r${i}`, username, level, rebirths, lifetime_words, wins_per_word: 1000 * (i + 1), week_words: 420 - (i % 10) * 37, created_at: `2026-09-0${(i % 9) + 1}T00:00:00Z` });
function boardFor(rank) {
  const above = NAMED.slice(0, Math.min(NAMED.length, rank - 1));
  // filler sits between the named players and you: LV 61..117, more words breaking ties
  for (let i = above.length; i < rank - 1; i += 1) above.push([`filler_${i}`, 61 + (i % 57), 0, 10 + i]);
  return [...above, ...BELOW].map(row);
}

// state: 'rank' (claimed, already saw this rank), 'rankup' (claimed, last saw #12 → the menu moves you to #9), 'unranked'
async function open(b, w, h, { state = 'rank', rank = 9, wait = 6500 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await installBackendMock(p);
  const me = { id: 'me', username: 'YOU_TEST', level: 60, rebirths: 2, lifetime_words: 300, wins_per_word: 50, week_words: 200, created_at: '2026-09-20T00:00:00Z' };
  const rows = [...boardFor(state === 'rankup' ? 9 : rank), ...(state === 'unranked' ? [] : [me])];
  await mockBoard(p, [], { caps: true, shared: { rows, secrets: new Map([['s'.repeat(48), 'me']]), saves: new Map() }, weekly: true });
  await p.addInitScript(([st, rk]) => {
    if (sessionStorage.getItem('biv.seeded')) return;
    sessionStorage.setItem('biv.seeded', '1');
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
    localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('taw.tut.init', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 60, into: 0 })); localStorage.setItem('taw.rebirths', '2');
    for (const id of ['marks', 'weekly', 'rebirth', 'chain', 'fuse', 'frenzy', 'boost', 'wall', 'board']) localStorage.setItem('taw.tut.' + id, '1');
    if (st !== 'unranked') {
      localStorage.setItem('taw.lb.secret', 's'.repeat(48));
      localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'YOU_TEST' }));
      localStorage.setItem('taw.lb.lastRank', st === 'rankup' ? '12' : String(rk));
    }
  }, [state, rank]);
  await p.goto(`${URL}/?portal=1`, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts && document.fonts.ready);
  if (wait) await p.waitForTimeout(wait);
  return { ctx, p };
}

const settle = (p) => p.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));
const BTN = '.homepage-nav-btn.is-board:visible, .hp-m-navbtn.is-board:visible';

// the golden button + its podium + the number, against the STATS / SHOP chips (desktop or phone, whichever is mounted)
const measure = (p) => p.evaluate(() => {
  const vis = (sel) => [...document.querySelectorAll(sel)].find((x) => x.offsetParent || x.getBoundingClientRect().width);
  const box = (e) => {
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top), area: Math.round(r.width * r.height) };
  };
  const btn = vis('.homepage-nav-btn.is-board, .hp-m-navbtn.is-board');
  const pi = btn && btn.querySelector('.pi');
  const num = pi && pi.querySelector('.pi-num');
  const stats = box(vis('.homepage-nav-btn.is-stats, .hp-m-navbtn.is-stats'));
  const shop = box(vis('.homepage-nav-btn.is-shop, .hp-m-navbtn.is-shop'));
  const b = box(btn);
  const r = btn && btn.getBoundingClientRect();
  const hit = (sel) => [...document.querySelectorAll(sel)].filter((x) => x.offsetParent && btn && x !== btn && !btn.contains(x)).some((x) => {
    const q = x.getBoundingClientRect();
    return q.width && !(q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom);
  });
  const fsPanel = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs-panel')) || null;
  return {
    button: b,
    podium: box(pi),
    numberBox: box(num),
    numberFontPx: pi && pi.dataset.numPx ? Number(pi.dataset.numPx) : null, // null = star
    fsPanel,
    label: btn && btn.getAttribute('aria-label'),
    stats,
    shop,
    vsStats: b && stats ? +(b.area / stats.area).toFixed(2) : null,
    vsShop: b && shop ? +(b.area / shop.area).toFixed(2) : null,
    overlaps: ['.homepage-logo', '.menu-xp', '.game-card', '.hp-m-title', '.hp-m-row', '.homepage-corner-nav'].filter(hit),
    infinite: document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity).length,
  };
});

const corner = async (p, path) => {
  const r = await p.locator(BTN).first().boundingBox();
  if (!r) return;
  const pad = Math.max(24, r.width * 0.5);
  const x = Math.max(0, r.x - pad);
  const y = Math.max(0, r.y - pad);
  await p.screenshot({ path, clip: { x, y, width: r.width + pad * 3.2, height: r.height + pad * 2.4 } });
};

const results = {};
const b = await chromium.launch();

for (const [w, h] of SIZES) {
  const tag = `${w}x${h}`;
  for (const state of ['rank', 'unranked']) {
    const name = state === 'rank' ? 'rank9' : 'unranked';
    const { ctx, p } = await open(b, w, h, { state });
    await settle(p);
    await p.screenshot({ path: `${OUT}/menu-${tag}-${name}.png` });
    await corner(p, `${OUT}/corner-${tag}-${name}.png`);
    results[`${tag}-${name}`] = await measure(p);
    await ctx.close();
  }
}

// the rank labels, short and long, where the button is smallest
for (const [w, h] of RANK_SIZES) {
  for (const [rank, label] of RANKS) {
    if (rank === 9) continue; // shot above
    const { ctx, p } = await open(b, w, h, { rank });
    await settle(p);
    await corner(p, `${OUT}/rank-${w}x${h}-${label}.png`);
    results[`${w}x${h}-rank${label}`] = await measure(p);
    await ctx.close();
  }
}

// the LeaderboardScreen header (podium wearing #9)
for (const [w, h] of [[1920, 1080], [390, 844], [360, 740]].filter(want)) {
  const { ctx, p } = await open(b, w, h);
  await p.locator(BTN).first().click();
  await p.waitForSelector('.lb-row.is-me', { timeout: 8000 });
  await settle(p);
  await p.waitForTimeout(300);
  const hr = await p.locator('.lb-header').boundingBox();
  if (hr) await p.screenshot({ path: `${OUT}/board-header-${w}x${h}.png`, clip: { x: hr.x, y: hr.y, width: hr.width, height: hr.height + 8 } });
  results[`${w}x${h}-lbheader`] = await p.evaluate(() => {
    const pi = document.querySelector('.lb-head-podium');
    const t = document.querySelector('.lb-title');
    const head = document.querySelector('.lb-header');
    const r = pi && pi.getBoundingClientRect();
    return { podium: r && Math.round(r.width), numberFontPx: pi && pi.dataset.numPx ? Number(pi.dataset.numPx) : null, headerScrolls: head.scrollWidth > head.clientWidth + 1, titleW: t && Math.round(t.getBoundingClientRect().width) };
  });
  await ctx.close();
}

// the rank-up: the card's "#to" pops → the podium jumps + ticks #12 → #9. Freeze the jump AT ITS PEAK.
for (const [w, h] of [[1280, 551], [1920, 1080], [390, 844]].filter(want)) {
  const { ctx, p } = await open(b, w, h, { state: 'rankup', wait: 0 });
  const got = await p.waitForFunction(() => document.getAnimations().some((a) => a.effect && a.effect.target && a.effect.target.classList
    && a.effect.target.classList.contains('pi') && a.effect.target.closest('.is-board')), null, { timeout: 15000 }).then(() => true).catch(() => false);
  if (got) {
    await p.evaluate(() => {
      const pi = document.querySelector('.is-board .pi');
      const peak = Number(pi && pi.dataset.bumpPeakMs) || 204;
      document.getAnimations().forEach((a) => {
        const t = a.effect && a.effect.target;
        if (t && t.closest && t.closest('.is-board')) {
          a.pause();
          a.currentTime = t.classList.contains('pi') ? peak : (Number(a.effect.getComputedTiming().duration) || 0) * 0.5;
        }
      });
    });
    await p.screenshot({ path: `${OUT}/bounce-peak-${w}x${h}.png` });
    await corner(p, `${OUT}/bounce-peak-corner-${w}x${h}.png`);
    results[`${w}x${h}-bouncePeak`] = await p.evaluate(() => {
      const pi = document.querySelector('.is-board .pi');
      const r = pi.getBoundingClientRect();
      // the peak's clearance: from the viewport top/left, and whether it crosses the frame's ornaments / rebirth stars
      const near = [...document.querySelectorAll('.menu-frame *, [class*="rebirth-star"], [class*="frame-orn"]')]
        .filter((x) => { const q = x.getBoundingClientRect(); return q.width && !(q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom); })
        .map((x) => x.className && x.className.baseVal !== undefined ? x.className.baseVal : x.className).slice(0, 8);
      return { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), crosses: near };
    });
  } else {
    console.log(w, h, 'no rank-up bounce seen within 15 s');
  }
  await ctx.close();
}

await b.close();
writeFileSync(`${OUT}/measure.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
