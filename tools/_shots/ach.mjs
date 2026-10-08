// ACHIEVEMENTS (AchievementsV3) screenshots through the e2e board mock, seeded like e2e/v2-achievements.spec.js:
// two tiers READY, one MAXED-ish, the rest in progress.   SIZES='1366x657 390x844' TAG=ach node tools/_shots/ach.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import { mockBoard } from '../../e2e/support/boardMock.js';
import { isPhoneMenu, navControl } from '../../e2e/support/menu.js';
const out = process.env.OUT || 'claude/night-oct8-r3/_raw'; fs.mkdirSync(out, { recursive: true });
const tag = process.env.TAG || 'ach';
const sizes = (process.env.SIZES || '1366x657 390x844').split(' ').map((s) => s.split('x').map(Number));
const SECRET = 'a1'.repeat(24);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: process.env.MOTION ? 'no-preference' : 'reduce' });
  const page = await ctx.newPage();
  await installBackendMock(page, { seedReduceMotion: !process.env.MOTION });
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-ach', username: 'Claimer', level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  await mockBoard(page, [], { caps: true, shared: { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() }, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.addInitScript(({ secret, id }) => {
    if (sessionStorage.getItem('ach.seeded')) return; sessionStorage.setItem('ach.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Claimer' })); localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.count', JSON.stringify({ words: 150, bots: 6, epic: 3, mp: 1, chain: 2, reb: 1, power: 1, marks: ['a'] }));
    localStorage.setItem('taw.s2.ach', JSON.stringify({ bots: 1 })); localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 100 }));
  }, { secret: SECRET, id: row.id });
  await page.goto('http://localhost:4173/?portal=1&season2=1', { waitUntil: 'networkidle' });
  await navControl(page, 'stats').waitFor({ state: 'visible' });
  await page.locator(isPhoneMenu(page) ? '.hp-m-navbtn.is-ach' : '.homepage-nav-btn.is-ach').click();
  await page.locator('.av3-overlay').waitFor({ state: 'visible' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${tag}-${w}x${h}.png` });
  const audit = await page.evaluate(() => {
    const scope = document.querySelector('.av3-overlay');
    const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
    const small = [...scope.querySelectorAll('*')].filter((el) => vis(el) && [...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim())).filter((el) => parseFloat(getComputedStyle(el).fontSize) < 14).map((el) => `${[...el.classList].slice(0, 2).join('.')}:${el.textContent.trim().slice(0, 14)}:${getComputedStyle(el).fontSize}`);
    const sz = (s) => { const e = scope.querySelector(s); return e ? `${s}=${getComputedStyle(e).fontSize}` : null; };
    const clip = []; for (const el of scope.querySelectorAll('*')) { if (!vis(el)) continue; const cs = getComputedStyle(el); if (cs.overflow !== 'visible' && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)) clip.push(`${[...el.classList].slice(0, 2).join('.')}:${el.scrollWidth}x${el.scrollHeight}>${el.clientWidth}x${el.clientHeight}`); }
    return { small: [...new Set(small)].slice(0, 12), clip: clip.slice(0, 6), sizes: ['.av3-have', '.av3-need', '.av3-hero-reward', '.av3-strip', '.av3-strip-reward', '.av3-tile-name', '.av3-pct', '.av3-hero-name', '.av3-ready-n', '.av3-tiers', '.av3-hero-pct', '.av3-step b', '.av3-step span'].map(sz).filter(Boolean).join(' ') };
  });
  console.log(`${w}x${h}`, JSON.stringify(audit));
  // claim the hero → the stamped/claimed state
  const btn = page.locator('.av3-claim--big'); if (await btn.count()) { await btn.click(); await page.waitForTimeout(700); await page.screenshot({ path: `${out}/${tag}-claimed-${w}x${h}.png` }); }
  await ctx.close();
}
await browser.close();
