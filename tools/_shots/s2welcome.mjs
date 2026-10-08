// s2welcome.mjs — screenshot the EDITOR'S NOTE (Season2Welcome) through the e2e backend mock, as a NO-NAME player whose
// welcome is pending (the local-gift path: round5(300 + 40 × old R) gems, no RPC). Env: OUT, TAG, SIZES, OLDR (default 7),
// JPG=1, STAGE = rest | hover | pressed | flying | play (what to capture), MOTION=1 (keep motion; default reduced).
// Usage: OUT=/tmp/x TAG=w STAGE=flying node tools/_shots/s2welcome.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import { mockBoard } from '../../e2e/support/boardMock.js';

const out = process.env.OUT || 'shots';
fs.mkdirSync(out, { recursive: true });
const sizes = (process.env.SIZES || '1366x657 390x844').split(' ').map((s) => s.split('x').map(Number));
const stage = process.env.STAGE || 'rest';
const oldR = Number(process.env.OLDR || 7);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({
    baseURL: process.env.BASE || 'http://localhost:4173', viewport: { width: w, height: h }, deviceScaleFactor: 1,
    reducedMotion: process.env.MOTION ? 'no-preference' : 'reduce',
  });
  const page = await ctx.newPage();
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  // the server AFTER the reset, holding the gift for old R{oldR} (same shape as e2e/season2-reset.spec.js)
  const SECRET = 'e'.repeat(48);
  const row = { id: 'me-s2r', username: 'OldTimer', level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 13 };
  const gems = Math.round((300 + 40 * oldR) / 5) * 5;
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map(), grants: new Map([[row.id, { gems, rebirths: oldR, claimed_at: null, claim_request: null }]]) };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true, season2Reset: true });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue());
  await page.addInitScript(({ secret, id }) => {
    if (sessionStorage.getItem('s2r.seeded')) return;
    sessionStorage.setItem('s2r.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'OldTimer' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.rebirths', '7');
    localStorage.setItem('taw.gems', JSON.stringify({ bal: 40, mig: 1 }));
  }, { secret: SECRET, id: row.id });
  await page.goto('/?portal=1&season2=1');
  const root = page.getByTestId('season2-welcome');
  await root.waitFor({ timeout: 15000 }).catch((e) => console.log('no welcome', e.message));
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const btn = page.getByTestId('season2-collect');
  if (stage === 'hover') { await btn.hover(); await page.waitForTimeout(400); }
  if (stage === 'pressed') {
    const b = await btn.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(160);
  }
  if (stage === 'flying' || stage === 'play') {
    await btn.click();
    await page.waitForTimeout(stage === 'flying' ? Number(process.env.WAIT || 700) : 4000);
  }
  const jpg = !!process.env.JPG;
  const name = `${process.env.TAG || 'welcome'}-${stage}-${w}x${h}.${jpg ? 'jpg' : 'png'}`;
  await page.screenshot({ path: `${out}/${name}`, ...(jpg ? { type: 'jpeg', quality: 80 } : {}) });
  // overflow audit: anything inside the welcome that leaves the viewport or its own box
  const leaks = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="season2-welcome"]');
    if (!r) return ['no root'];
    const out = [];
    for (const el of r.querySelectorAll('*')) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (b.left < -1 || b.right > innerWidth + 1) out.push(`${el.className || el.tagName} x ${Math.round(b.left)}..${Math.round(b.right)}`);
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible') out.push(`${el.className} clipped ${el.scrollWidth}>${el.clientWidth}`);
    }
    const small = [...r.querySelectorAll('*')].filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((el) => [el.className || el.tagName, parseFloat(getComputedStyle(el).fontSize)]).filter(([, fs]) => fs < 14);
    return out.concat(small.map(([c, fs]) => `SMALL ${c} ${fs}px`));
  });
  console.log('wrote', name, 'leaks:', leaks.length ? leaks : 'none');
  if (stage === 'pressed') await page.mouse.up();
  await ctx.close();
}
await browser.close();
