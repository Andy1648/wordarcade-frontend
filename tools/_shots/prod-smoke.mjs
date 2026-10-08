// Production smoke after the SEASON 2 flip: fresh visitor → what shows; then a solo Word Bomb round. Console errors logged.
import { chromium } from '@playwright/test';
const out = '/tmp/claude-0/-home-claude/dfeccb96-1985-5130-a2b7-72cc0d64d8d4/scratchpad/shots';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1366, height: 657 } });
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
p.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 200)));
await p.goto('https://typeaword.com/?portal=1', { waitUntil: 'networkidle' });
await p.waitForTimeout(4000);
await p.screenshot({ path: `${out}/prod-fresh.png` });
const text = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400));
console.log('FRESH:', text);
// the EDITOR'S NOTE (s2-welcome-root): collect, then wait for it to leave
const wroot = p.locator('#s2-welcome-root');
if (await wroot.count()) {
  const btn = wroot.locator('button').first();
  console.log('WELCOME button:', (await btn.textContent().catch(() => '?')).trim());
  await btn.click({ force: true }).catch(() => {});
  await p.waitForTimeout(4000);
  const play = wroot.locator('button:has-text("PLAY")').first();
  if (await play.count()) { await play.click({ force: true }); await p.waitForTimeout(2500); }
  await p.locator('#s2-welcome-root').waitFor({ state: 'detached', timeout: 15000 }).catch(() => console.log('welcome still mounted'));
}
await p.screenshot({ path: `${out}/prod-menu.png` });
const menu = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300));
console.log('MENU:', menu);
console.log('rate line present:', /\+\d+ XP \/ KEY/.test(menu));
// solo Word Bomb
const wb = p.locator('.game-card-magnet[data-game="word-bomb"] .game-card').first();
await wb.click(); await p.waitForTimeout(1500);
const solo = p.locator('button:has-text("SOLO"), button:has-text("PLAY SOLO"), button:has-text("VS BOT")').first();
if (await solo.count()) { await solo.click(); } else { console.log('no solo button; dialog text:', await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300))); }
await p.waitForTimeout(12000);
await p.screenshot({ path: `${out}/prod-wb.png` });
const game = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300));
console.log('GAME:', game);
const input = p.locator('input').first();
if (await input.count()) { await input.fill('station'); await p.keyboard.press('Enter'); await p.waitForTimeout(3000); await p.screenshot({ path: `${out}/prod-wb2.png` }); }
console.log('ERRORS:', errs.length, errs.slice(0, 5));
await b.close();
