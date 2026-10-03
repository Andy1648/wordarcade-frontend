// board-icon-shots.mjs — Andy oct3 11:42: the leaderboard TROPHY → PODIUM fine-tune. Shoots all three versions
// (?biv=a pure-CSS bars | b SVG + shadow layer | c sticker) through the REAL menu path, and prints the icon's
// px against the STATS / SHOP chips as JSON.
//
// Per version, per size (2560x1440, 1920x1080, 1366x625, 1280x551, 390x844):
//   menu-<v>-<size>-rank9.png        the full menu, you are #9 (lastRank already 9: no rank-up, glint finished)
//   corner-<v>-<size>-rank9.png      a crop of the golden button (desktop top-left / phone title row)
//   menu-<v>-<size>-unranked.png     no claimed name → the star on the top step
//   corner-<v>-<size>-unranked.png
// Per version, once:
//   phone-<v>-360x740.png            the smallest phone menu we support (title row + nav strip)
//   board-header-<v>-1920x1080.png   the LeaderboardScreen header (podium wearing #9)  + the 390 one
//   bounce-mid-<v>-<size>.png        the rank-up bounce frozen ~30% in (you were #12, now #9) at 1920 + 390,
//                                    plus the RANK UP card with its podium at its pop
// Measurements → claude/finetune/board-icon/measure.json (and stdout).
//
// BUILD FIRST with the e2e Supabase env (the board API is mocked at lb.e2e.invalid, like h2a-final-shots.mjs):
//   VITE_SUPABASE_URL='https://lb.e2e.invalid/rest/v1/' VITE_SUPABASE_ANON_KEY='e2e-anon-key' npx vite build
//   npx vite preview --port 4190 --strictPort      (check nothing stale already listens on 4190)
// then:
//   node claude/finetune/board-icon-shots.mjs [url] [versions, e.g. a,c] [sizes, e.g. 2560x1440,390x844]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import { mockBoard } from '../../e2e/support/boardMock.js';

const URL = process.argv[2] || 'http://localhost:4190';
const VERSIONS = process.argv[3] ? process.argv[3].split(',') : ['a', 'b', 'c'];
const ONLY = process.argv[4] ? process.argv[4].split(',') : null;
const OUT = process.env.BIV_OUT || 'claude/finetune/board-icon';
const SIZES = [[2560, 1440], [1920, 1080], [1366, 625], [1280, 551], [390, 844]].filter(([w, h]) => !ONLY || ONLY.includes(`${w}x${h}`));
mkdirSync(OUT, { recursive: true });

// the h2a board: eight players above you, you (LV60) land at #9
const ROWS = [
  ['snapplemelon', 195, 4, 606], ['Xavi', 168, 8, 849], ['elol', 156, 7, 321], ['NoBuffCookies', 147, 6, 0],
  ['Daan', 144, 9, 1196], ['Tangie', 126, 10, 1013], ['maSON_im_cRYAN', 119, 8, 512], ['creator', 118, 6, 193],
  ['wordgoblin', 40, 1, 120], ['qwertyuiop', 31, 0, 90], ['zz_top', 22, 0, 60],
].map(([username, level, rebirths, lifetime_words], i) => ({ id: `r${i}`, username, level, rebirths, lifetime_words, wins_per_word: 1000 * (i + 1), week_words: 420 - i * 37, created_at: `2026-09-0${(i % 9) + 1}T00:00:00Z` }));

// state: 'rank9' (claimed, already saw #9), 'rankup' (claimed, last saw #12 → the menu moves you to #9), 'unranked'
async function open(b, w, h, v, state, { wait = 6500 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await installBackendMock(p);
  const me = { id: 'me', username: 'YOU_TEST', level: 60, rebirths: 2, lifetime_words: 300, wins_per_word: 50, week_words: 200, created_at: '2026-09-20T00:00:00Z' };
  const rows = [...ROWS.map((r) => ({ ...r })), ...(state === 'unranked' ? [] : [me])];
  await mockBoard(p, [], { caps: true, shared: { rows, secrets: new Map([['s'.repeat(48), 'me']]), saves: new Map() }, weekly: true });
  await p.addInitScript((st) => {
    if (sessionStorage.getItem('biv.seeded')) return;
    sessionStorage.setItem('biv.seeded', '1');
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
    localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('taw.tut.init', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 60, into: 0 })); localStorage.setItem('taw.rebirths', '2');
    for (const id of ['marks', 'weekly', 'rebirth', 'chain', 'fuse', 'frenzy', 'boost', 'wall', 'board']) localStorage.setItem('taw.tut.' + id, '1');
    if (st !== 'unranked') {
      localStorage.setItem('taw.lb.secret', 's'.repeat(48));
      localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'YOU_TEST' }));
      localStorage.setItem('taw.lb.lastRank', st === 'rankup' ? '12' : '9');
    }
  }, state);
  await p.goto(`${URL}/?portal=1&biv=${v}`, { waitUntil: 'networkidle' });
  if (wait) await p.waitForTimeout(wait);
  return { ctx, p };
}

const settle = (p) => p.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));

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
  const num = pi && (pi.querySelector('.pi-num-face') || pi.querySelector('.pi-svg-num') || pi.querySelector('.pi-star'));
  const stats = box(vis('.homepage-nav-btn.is-stats, .hp-m-navbtn.is-stats'));
  const shop = box(vis('.homepage-nav-btn.is-shop, .hp-m-navbtn.is-shop'));
  const b = box(btn);
  const hit = (sel) => [...document.querySelectorAll(sel)].filter((x) => x.offsetParent && btn && x !== btn && !btn.contains(x)).some((x) => {
    const q = x.getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    return q.width && !(q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom);
  });
  return {
    button: b,
    podium: box(pi),
    number: box(num),
    numberFontPx: num && num.classList.contains('pi-num-face') ? parseFloat(getComputedStyle(num).fontSize) : null,
    label: btn && btn.getAttribute('aria-label'),
    stats,
    shop,
    vsStats: b && stats ? +(b.area / stats.area).toFixed(2) : null,
    vsShop: b && shop ? +(b.area / shop.area).toFixed(2) : null,
    heightVsChip: b && stats ? +(b.h / stats.h).toFixed(2) : null,
    overlaps: ['.homepage-logo', '.menu-xp', '.game-card', '.hp-m-title', '.hp-m-row', '.homepage-corner-nav'].filter(hit),
    infinite: document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity).length,
  };
});

const corner = async (p, path) => {
  const r = await p.locator('.homepage-nav-btn.is-board:visible, .hp-m-navbtn.is-board:visible').first().boundingBox();
  if (!r) return;
  const pad = Math.max(24, r.width * 0.5);
  await p.screenshot({ path, clip: { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.width + pad * 3.2, height: r.height + pad * 2.4 } });
};

const results = {};
const b = await chromium.launch();
for (const v of VERSIONS) {
  results[v] = {};
  for (const [w, h] of SIZES) {
    const tag = `${w}x${h}`;
    for (const state of ['rank9', 'unranked']) {
      const { ctx, p } = await open(b, w, h, v, state);
      await settle(p);
      await p.screenshot({ path: `${OUT}/menu-${v}-${tag}-${state}.png` });
      await corner(p, `${OUT}/corner-${v}-${tag}-${state}.png`);
      results[v][`${tag}-${state}`] = await measure(p);
      await ctx.close();
    }
  }

  // the smallest phone
  {
    const { ctx, p } = await open(b, 360, 740, v, 'rank9');
    await settle(p);
    await p.screenshot({ path: `${OUT}/phone-${v}-360x740.png` });
    results[v]['360x740-rank9'] = await measure(p);
    await ctx.close();
  }

  // the LeaderboardScreen header (podium wearing #9)
  for (const [w, h] of [[1920, 1080], [390, 844]]) {
    const { ctx, p } = await open(b, w, h, v, 'rank9');
    await p.locator('.homepage-nav-btn.is-board:visible, .hp-m-navbtn.is-board:visible').first().click();
    await p.waitForSelector('.lb-row.is-me', { timeout: 8000 });
    await settle(p);
    await p.waitForTimeout(300);
    const hr = await p.locator('.lb-header').boundingBox();
    if (hr) await p.screenshot({ path: `${OUT}/board-header-${v}-${w}x${h}.png`, clip: { x: hr.x, y: hr.y, width: hr.width, height: hr.height + 8 } });
    await p.screenshot({ path: `${OUT}/board-${v}-${w}x${h}.png` });
    await ctx.close();
  }

  // the rank-up: the card's "#to" pops → the podium bounces + ticks #12 → #9. Freeze the bounce ~30% in.
  for (const [w, h] of [[1920, 1080], [390, 844]]) {
    const { ctx, p } = await open(b, w, h, v, 'rankup', { wait: 0 });
    const got = await p.waitForFunction(() => document.getAnimations().some((a) => a.effect && a.effect.target && a.effect.target.classList
      && a.effect.target.classList.contains('pi') && a.effect.target.closest('.is-board')), null, { timeout: 15000 }).then(() => true).catch(() => false);
    if (got) {
      await p.evaluate(() => {
        document.getAnimations().forEach((a) => {
          const t = a.effect && a.effect.target;
          if (t && t.closest && t.closest('.is-board')) {
            a.pause();
            const d = Number(a.effect.getComputedTiming().duration) || 0;
            a.currentTime = d * (t.classList.contains('pi') ? 0.3 : 0.5);
          }
        });
      });
      await p.screenshot({ path: `${OUT}/bounce-mid-${v}-${w}x${h}.png` });
      await corner(p, `${OUT}/bounce-mid-corner-${v}-${w}x${h}.png`);
      results[v][`${w}x${h}-bounce`] = await measure(p);
    } else {
      console.log(v, w, h, 'no rank-up bounce seen within 15 s');
    }
    await ctx.close();
  }
}
await b.close();
writeFileSync(`${OUT}/measure.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
