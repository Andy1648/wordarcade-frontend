// prod-checkup-wb.mjs — the 2-hourly CHECKUP's play step: a FRESH LV1 profile on typeaword.com taps the Word
// Bomb card → PLAY SOLO and plays the round to the game-over card, typing a dictionary word that contains each
// fragment on its turn. Reports turns played, the result, and every console error / failed request.
//   node claude/finetune/prod-checkup-wb.mjs [url]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const URL = process.argv[2] || 'https://typeaword.com';
const words = fs.readFileSync('src/solo/words.common.txt', 'utf8').split(/\s+/).filter((w) => /^[a-z]{4,9}$/.test(w));
const used = new Set();
const pick = (frag) => words.find((w) => w.includes(frag) && !used.has(w));

const browser = await chromium.launch();
const errs = [];
let turns = 0;
let result = 'NO GAME-OVER';
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 160)));
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('typeaword.com')) errs.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('taw.seenGameSpotlight', '1'); } catch { /* blocked */ }
  });
  await page.goto(`${URL}/?portal=1`, { waitUntil: 'networkidle' });
  await page.locator('.game-card-magnet[data-game="word-bomb"] .game-card').click();
  await page.getByRole('button', { name: 'PLAY SOLO' }).click();
  await page.locator('.game-input').waitFor({ timeout: 30000 });
  const input = page.locator('.game-input');
  const t0 = Date.now();
  let lastFrag = '';
  while (Date.now() - t0 < 240000) {
    if (await page.locator('.game-over-overlay').isVisible().catch(() => false)) {
      result = (await page.locator('.game-over-card').getAttribute('class').catch(() => '')).includes('go-card-win') ? 'WON' : 'LOST';
      break;
    }
    const enabled = await input.isEnabled().catch(() => false);
    const frag = ((await page.locator('.game-combo').first().textContent().catch(() => '')) || '').trim().toLowerCase();
    if (enabled && frag && (frag !== lastFrag || !(await input.inputValue().catch(() => '')))) {
      const w = pick(frag);
      if (w) {
        used.add(w);
        await input.fill('');
        await input.pressSequentially(w, { delay: 40 });
        await input.press('Enter');
        turns += 1;
        lastFrag = frag;
        await page.waitForTimeout(700);
        continue;
      }
    }
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: 'claude/finetune/prod-checkup-wb.png' });
  await ctx.close();
} finally {
  await browser.close();
}
console.log(`CHECKUP WB: ${result} · ${turns} turns · ${errs.length} console errors`);
for (const e of errs) console.log('  ERR', e);
