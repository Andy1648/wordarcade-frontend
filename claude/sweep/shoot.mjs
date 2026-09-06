// shoot.mjs — full-app visual sweep (JOB 22). Captures the reachable screens/overlays at 2 viewports.
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4173';
const VPS = [[1366, 768], [390, 844]];

// mid-progression player so shop/dialogs/stats show populated states + everything unlocked.
const seed = () => {
  try {
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 34, into: 300 }));
    localStorage.setItem('taw.wins', '18000');
    localStorage.setItem('taw.winsLifetime', '250000');
    localStorage.setItem('taw.rebirths', '1');
    localStorage.setItem('taw.keytier', '4');
    localStorage.setItem('taw.wordsense', '3');
    localStorage.setItem('taw.momentum', '12');
    localStorage.setItem('taw.streak', JSON.stringify({ count: 6, lastDay: new Date().toISOString().slice(0,10), freezes: 0 }));
    localStorage.setItem('wa_last_seen', String(Date.now())); // no return card
    localStorage.setItem('taw.returnClaim', new Date().toISOString().slice(0,10));
  } catch (e) {}
};

async function clickText(page, re) {
  const el = page.getByText(re, { exact: false }).first();
  if (await el.count()) { await el.click({ timeout: 3000 }).catch(() => {}); return true; }
  return false;
}

const b = await chromium.launch();
for (const [w, h] of VPS) {
  const tag = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1 });
  const page = await ctx.newPage();
  await page.addInitScript(seed);
  const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: path.join(OUT, `${name}-${tag}.png`) }); console.log('  ', `${name}-${tag}`); };

  // MENU
  await page.goto(`${BASE}/?portal=1`); await page.waitForTimeout(2200);
  await shot('menu');
  // MODE DIALOGS (Word Bomb, Category Blitz)
  await page.locator('.game-card').first().click().catch(()=>{}); await shot('dialog-wordbomb');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await page.locator('.game-card').nth(1).click().catch(()=>{}); await shot('dialog-blitz');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  // SHOP
  if (await clickText(page, /^shop$/i)) { await shot('shop'); await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
  // STATS (+ try tabs)
  if (await clickText(page, /^stats$/i)) {
    await shot('stats');
    for (const t of ['COLLECTION', 'ACHIEVEMENTS']) { if (await clickText(page, new RegExp(t, 'i'))) await shot(`stats-${t.toLowerCase()}`); }
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  }
  // REBIRTH
  if (await clickText(page, /^rebirth$/i)) { await shot('rebirth'); await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
  // CREDITS
  if (await clickText(page, /^credits$/i)) { await shot('credits'); await page.goBack().catch(()=>{}); await page.waitForTimeout(600); }
  // SAT briefing / mode-select
  await page.goto(`${BASE}/sat-rush?portal=1`); await page.waitForTimeout(2200); await shot('sat');
  // CHAIN / FUSE in-game (solo, reachable)
  await page.goto(`${BASE}/chain?portal=1`); await page.waitForTimeout(2200); await shot('chain-ingame');
  await page.goto(`${BASE}/fuse?portal=1`); await page.waitForTimeout(2200); await shot('fuse-ingame');
  // BROWSER (join room)
  await page.goto(`${BASE}/?portal=1`); await page.waitForTimeout(1800);
  if (await clickText(page, /join room/i)) { await shot('browser'); }
  await ctx.close();
}
await b.close();
