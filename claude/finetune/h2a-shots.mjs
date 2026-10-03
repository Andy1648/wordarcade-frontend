// h2a-shots.mjs — the leaderboard icon + board screen at Andy's sizes (2560x1440 first), with prod-shaped rows
// and a claimed "you" at #9. node claude/finetune/h2a-shots.mjs <tag> [url]
import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import { mockBoard } from '../../e2e/support/boardMock.js';
const tag = process.argv[2] || 'before';
const URL = process.argv[3] || 'http://localhost:4173';
const ROWS = [
  ['snapplemelon', 195, 4, 606], ['Xavi', 168, 8, 849], ['elol', 156, 7, 321], ['NoBuffCookies', 147, 6, 0],
  ['Daan', 144, 9, 1196], ['Tangie', 126, 10, 1013], ['maSON_im_cRYAN', 119, 8, 512], ['creator', 118, 6, 193],
].map(([username, level, rebirths, lifetime_words], i) => ({ id: `r${i}`, username, level, rebirths, lifetime_words, wins_per_word: 1000 * (i + 1), created_at: `2026-09-0${i + 1}T00:00:00Z` }));
const b = await chromium.launch();
for (const [w, h] of [[2560, 1440], [1920, 1080], [1280, 551], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await installBackendMock(p);
  const shared = { rows: [...ROWS, { id: 'me', username: 'YOU_TEST', level: 60, rebirths: 2, lifetime_words: 300, wins_per_word: 50, created_at: '2026-09-20T00:00:00Z' }], secrets: new Map([['s'.repeat(48), 'me']]), saves: new Map() };
  await mockBoard(p, [], { caps: true, shared, weekly: true });
  await p.addInitScript(() => {
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
    localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('taw.tut.init', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 60, into: 0 })); localStorage.setItem('taw.rebirths', '2');
    localStorage.setItem('taw.lb.secret', 's'.repeat(48)); localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'YOU_TEST' })); localStorage.setItem('taw.lb.lastRank', '9');
    for (const id of ['marks', 'weekly', 'rebirth', 'chain']) localStorage.setItem('taw.tut.' + id, '1');
  });
  await p.goto(`${URL}/?portal=1`, { waitUntil: 'networkidle' }); await p.waitForTimeout(2200);
  const icon = await p.evaluate(() => { const e = document.querySelector('.is-board'); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.width / innerWidth * 1000) / 10 + '%vw']; });
  await p.screenshot({ path: `claude/finetune/h2a/${tag}-menu-${w}x${h}.png` });
  await p.locator('.homepage-nav-btn.is-board:visible, .hp-m-navbtn.is-board:visible').first().click();
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `claude/finetune/h2a/${tag}-board-${w}x${h}.png` });
  console.log(w, h, 'icon', JSON.stringify(icon));
  await ctx.close();
}
await b.close();
