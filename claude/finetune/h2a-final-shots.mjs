// h2a-final-shots.mjs — H2a final (SPLIT board + golden trophy) at Andy's sizes, through the REAL path:
// lastRank is seeded BEFORE the menu loads (you were #12), the menu's own rank check moves it to #9 and
// shows its moment, THEN the trophy is tapped — so the board's ▲3 is the one a player would see.
// node claude/finetune/h2a-final-shots.mjs [url] [sizes, e.g. 2560x1440,390x844]
// Build first with VITE_SUPABASE_URL='https://lb.e2e.invalid/rest/v1/' VITE_SUPABASE_ANON_KEY='e2e-anon-key'.
import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import { mockBoard } from '../../e2e/support/boardMock.js';

const URL = process.argv[2] || 'http://localhost:4190';
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const OUT = process.env.H2A_OUT || 'claude/finetune/h2a/final';
const SIZES = [[2560, 1440], [1920, 1080], [1366, 625], [1280, 551], [390, 844]].filter(([w, h]) => !ONLY || ONLY.includes(`${w}x${h}`));
const EXTRA = new Set(['2560x1440', '390x844']); // THIS WEEK + reduced-motion + mid-flight at these
const ROWS = [
  ['snapplemelon', 195, 4, 606], ['Xavi', 168, 8, 849], ['elol', 156, 7, 321], ['NoBuffCookies', 147, 6, 0],
  ['Daan', 144, 9, 1196], ['Tangie', 126, 10, 1013], ['maSON_im_cRYAN', 119, 8, 512], ['creator', 118, 6, 193],
  ['wordgoblin', 40, 1, 120], ['qwertyuiop', 31, 0, 90], ['zz_top', 22, 0, 60],
].map(([username, level, rebirths, lifetime_words], i) => ({ id: `r${i}`, username, level, rebirths, lifetime_words, wins_per_word: 1000 * (i + 1), week_words: 420 - i * 37, created_at: `2026-09-0${(i % 9) + 1}T00:00:00Z` }));

async function open(b, w, h, { reduced = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  await installBackendMock(p);
  const me = { id: 'me', username: 'YOU_TEST', level: 60, rebirths: 2, lifetime_words: 300, wins_per_word: 50, week_words: 200, created_at: '2026-09-20T00:00:00Z' };
  const shared = { rows: [...ROWS.map((r) => ({ ...r })), me], secrets: new Map([['s'.repeat(48), 'me']]), saves: new Map() };
  await mockBoard(p, [], { caps: true, shared, weekly: true });
  await p.addInitScript(() => {
    if (sessionStorage.getItem('h2a.seeded')) return;
    sessionStorage.setItem('h2a.seeded', '1');
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
    localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('taw.tut.init', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 60, into: 0 })); localStorage.setItem('taw.rebirths', '2');
    localStorage.setItem('taw.lb.secret', 's'.repeat(48)); localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'YOU_TEST' }));
    localStorage.setItem('taw.lb.lastRank', '12'); // you were #12 last time you looked
    for (const id of ['marks', 'weekly', 'rebirth', 'chain', 'fuse', 'frenzy', 'boost', 'wall', 'board']) localStorage.setItem('taw.tut.' + id, '1');
  });
  await p.goto(`${URL}/?portal=1`, { waitUntil: 'networkidle' });
  // let the menu's one-shot moments (RANK UP #12 → #9, the level frame) play out
  await p.waitForTimeout(6500);
  return { ctx, p };
}

const board = async (p) => {
  await p.locator('.homepage-nav-btn.is-board:visible, .hp-m-navbtn.is-board:visible').first().click();
  await p.waitForSelector('.lb-row.is-me', { timeout: 8000 });
};
const settle = (p) => p.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));

const b = await chromium.launch();
for (const [w, h] of SIZES) {
  const tag = `${w}x${h}`;
  let { ctx, p } = await open(b, w, h);
  const icon = await p.evaluate(() => {
    const e = [...document.querySelectorAll('.is-board')].find((x) => x.offsetParent);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const hit = (sel) => [...document.querySelectorAll(sel)].filter((x) => x.offsetParent && x !== e && !e.contains(x)).some((x) => {
      const q = x.getBoundingClientRect();
      return q.width && !(q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom);
    });
    return { w: Math.round(r.width), x: Math.round(r.left), y: Math.round(r.top), bg: getComputedStyle(e).backgroundColor, overlaps: ['.homepage-logo', '.menu-xp', '.game-card', '.hp-m-title', '.hp-m-row', '.homepage-corner-nav'].filter(hit) };
  });
  await p.screenshot({ path: `${OUT}/menu-${tag}.png` });
  await p.screenshot({ path: `${OUT}/menu-corner-${tag}.png`, clip: { x: 0, y: 0, width: Math.min(w, 460), height: Math.min(h, 340) } });
  await board(p);
  const news = await p.locator('.lb-row.is-me .lb-move').textContent().catch(() => null);
  if (EXTRA.has(tag)) {
    // mid-flight: the row ~12% into its rise, the ▲ chip half-way through its pop; the panel entrance landed
    await p.waitForTimeout(40);
    await p.evaluate(() => {
      const mine = document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.lb-row.is-me, .lb-hero'));
      mine.forEach((a) => {
        a.pause();
        const t = a.effect.getComputedTiming();
        const chip = a.effect.target.matches('.lb-move, .lb-hero-move');
        a.currentTime = (Number(t.delay) || 0) + (Number(t.duration) || 0) * (chip ? 0.5 : 0.12);
      });
      document.getAnimations().filter((a) => !mine.includes(a)).forEach((a) => { try { a.finish(); } catch { /* infinite */ } });
    });
    await p.waitForTimeout(60);
    await p.screenshot({ path: `${OUT}/rankup-mid-${tag}.png` });
  }
  await settle(p);
  await p.waitForTimeout(400);
  const panel = await p.evaluate(() => {
    const r = document.querySelector('.lb-panel').getBoundingClientRect();
    const body = document.querySelector('.lb-body');
    return { w: Math.round(r.width), h: Math.round(r.height), scrolls: body.scrollHeight > body.clientHeight + 1, pin: !!document.querySelector('.lb-pin-btn') };
  });
  await p.screenshot({ path: `${OUT}/board-${tag}.png` });
  if (panel.scrolls) {
    await p.locator('.lb-body').evaluate((x) => { x.scrollTop = 0; });
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/board-top-pinned-${tag}.png` });
  }
  if (EXTRA.has(tag)) {
    await p.locator('.lb-tab', { hasText: 'THIS WEEK' }).click();
    await p.waitForTimeout(900);
    await settle(p);
    await p.screenshot({ path: `${OUT}/board-week-${tag}.png` });
  }
  console.log(tag, 'icon', JSON.stringify(icon), 'panel', JSON.stringify(panel), 'news', news);
  await ctx.close();
  if (EXTRA.has(tag)) {
    ({ ctx, p } = await open(b, w, h, { reduced: true }));
    await board(p);
    await p.waitForTimeout(700);
    const anims = await p.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.lb-row.is-me, .lb-hero')).length);
    await p.screenshot({ path: `${OUT}/board-reduced-motion-${tag}.png` });
    console.log(tag, 'reduced-motion anims on your row/hero:', anims);
    await ctx.close();
  }
}
await b.close();
