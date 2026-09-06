// run-cardshot.mjs — capture THE RUN card beside its five siblings on the menu.
// Usage: node claude/_tools/run-cardshot.mjs <outDir> <width>
import { chromium } from '@playwright/test';

const outDir = process.argv[2] || 'claude/run-shots';
const width = parseInt(process.argv[3] || '390', 10);
const BASE = 'http://localhost:4173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
await page.addInitScript(() => {
  try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 31, into: 0 })); } catch {}
});
await page.goto(`${BASE}/?portal=1`, { waitUntil: 'networkidle' });
await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
// let the portal intro overlay clear
const runCard = page.locator('.game-card-magnet[data-game="run"] .game-card');
await runCard.waitFor({ state: 'visible' });
try { await runCard.click({ trial: true, timeout: 9000 }); } catch {}
await page.waitForTimeout(600);
const grid = page.locator('.homepage-cards-grid');
await grid.screenshot({ path: `${outDir}/grid-${width}.png` });
await runCard.screenshot({ path: `${outDir}/runcard-${width}.png` });
console.log(`wrote ${outDir}/grid-${width}.png and runcard-${width}.png`);
await browser.close();
