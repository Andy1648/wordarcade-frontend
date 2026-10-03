// h2a-versions-shots.mjs — H2a: the leaderboard icon + the THREE board versions (?lbv=a|b|c) at Andy's sizes,
// prod-shaped rows, a claimed "you" at #9 who was #12 last time (so the rank-change animation plays).
// node claude/finetune/h2a-versions-shots.mjs [versions=abc] [url] [sizes=all, e.g. 2560x1440,390x844]
// Build first with VITE_SUPABASE_URL='https://lb.e2e.invalid/rest/v1/' VITE_SUPABASE_ANON_KEY='e2e-anon-key'.
import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import { mockBoard } from '../../e2e/support/boardMock.js';

const VERSIONS = (process.argv[2] || 'abc').split('');
const URL = process.argv[3] || 'http://localhost:4190';
const ONLY = process.argv[4] ? process.argv[4].split(',') : null;
const OUT = process.env.H2A_OUT || 'claude/finetune/h2a/versions';
const SIZES = [[2560, 1440], [1920, 1080], [1280, 551], [1366, 625], [390, 844]].filter(([w, h]) => !ONLY || ONLY.includes(`${w}x${h}`));
const ROWS = [
  ['snapplemelon', 195, 4, 606], ['Xavi', 168, 8, 849], ['elol', 156, 7, 321], ['NoBuffCookies', 147, 6, 0],
  ['Daan', 144, 9, 1196], ['Tangie', 126, 10, 1013], ['maSON_im_cRYAN', 119, 8, 512], ['creator', 118, 6, 193],
  ['wordgoblin', 40, 1, 120], ['qwertyuiop', 31, 0, 90], ['zz_top', 22, 0, 60],
].map(([username, level, rebirths, lifetime_words], i) => ({ id: `r${i}`, username, level, rebirths, lifetime_words, wins_per_word: 1000 * (i + 1), created_at: `2026-09-0${(i % 9) + 1}T00:00:00Z` }));

const b = await chromium.launch();
for (const v of VERSIONS) {
  for (const [w, h] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    await installBackendMock(p);
    const me = { id: 'me', username: 'YOU_TEST', level: 60, rebirths: 2, lifetime_words: 300, wins_per_word: 50, created_at: '2026-09-20T00:00:00Z' };
    const shared = { rows: [...ROWS.map((r) => ({ ...r })), me], secrets: new Map([['s'.repeat(48), 'me']]), saves: new Map() };
    await mockBoard(p, [], { caps: true, shared, weekly: true });
    await p.addInitScript(() => {
      window.__TAW_NO_ACHIEVEMENT_GRANT = true;
      localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('taw.tut.init', '1');
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 60, into: 0 })); localStorage.setItem('taw.rebirths', '2');
      localStorage.setItem('taw.lb.secret', 's'.repeat(48)); localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'YOU_TEST' }));
      // #9 on the menu (no RANK UP moment over the shot); the board is then told you were #12 last time.
      if (!sessionStorage.getItem('h2a.seeded')) { localStorage.setItem('taw.lb.lastRank', '9'); sessionStorage.setItem('h2a.seeded', '1'); }
      for (const id of ['marks', 'weekly', 'rebirth', 'chain', 'fuse', 'frenzy', 'boost', 'wall', 'board']) localStorage.setItem('taw.tut.' + id, '1');
    });
    await p.goto(`${URL}/?portal=1&lbv=${v}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(5000); // past the menu's one-shot level/frame moment
    const icon = await p.evaluate(() => {
      const e = [...document.querySelectorAll('.is-board')].find((x) => x.offsetParent);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      const hit = (sel) => [...document.querySelectorAll(sel)].filter((x) => x.offsetParent && x !== e && !e.contains(x)).some((x) => {
        const q = x.getBoundingClientRect();
        return q.width && !(q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom);
      });
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top), overlaps: ['.homepage-logo', '.menu-xp', '.game-card', '.hp-m-title', '.hp-m-row', '.homepage-corner-nav'].filter(hit) };
    });
    await p.screenshot({ path: `${OUT}/${v}-menu-${w}x${h}.png` });
    await p.evaluate(() => localStorage.setItem('taw.lb.lastRank', '12'));
    await p.locator('.homepage-nav-btn.is-board:visible, .hp-m-navbtn.is-board:visible').first().click();
    await p.waitForSelector('.lb-row.is-me', { timeout: 8000 });
    // mid-flight frame of the rank-change animation: freeze the mover's animations at ~45% of their run
    const caught = await p.evaluate(() => new Promise((res) => setTimeout(() => {
      const as = document.getAnimations().filter((a) => {
        const t = a.effect && a.effect.target;
        return t && t.closest && t.closest('.lb-row.is-me, .lb-you');
      });
      // the row ~25% into its slide (still between rows); the ▲N chips half-way through their pop
      as.forEach((a) => {
        a.pause();
        const t = a.effect.getComputedTiming();
        const chip = a.effect.target.matches('.lb-move, .lb-hero-move');
        a.currentTime = chip ? (Number(t.delay) || 0) + (Number(t.duration) || 0) * 0.5 : (Number(t.delay) || 0) + (Number(t.duration) || 0) * 0.1;
      });
      // the panel's own entrance is not the subject — land it so the frame is not half-faded
      document.getAnimations().filter((a) => !as.includes(a)).forEach((a) => { try { a.finish(); } catch { /* infinite */ } });
      res(as.length);
    }, 60)));
    await p.waitForTimeout(80);
    if (caught && (w === 2560 || w === 390)) await p.screenshot({ path: `${OUT}/${v}-rankup-mid-${w}x${h}.png` });
    await p.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));
    await p.waitForTimeout(400);
    const panel = await p.evaluate(() => {
      const e = document.querySelector('.lb-panel');
      const r = e.getBoundingClientRect();
      const body = document.querySelector('.lb-body');
      return { w: Math.round(r.width), h: Math.round(r.height), hScroll: document.documentElement.scrollWidth > innerWidth + 1, bodyScrolls: body.scrollHeight > body.clientHeight + 1 };
    });
    await p.screenshot({ path: `${OUT}/${v}-board-${w}x${h}.png` });
    console.log(v, `${w}x${h}`, 'icon', JSON.stringify(icon), 'panel', JSON.stringify(panel), 'anims', caught);
    await ctx.close();
  }
}
await b.close();
