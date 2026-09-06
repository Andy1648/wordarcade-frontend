// shoot.mjs — screenshot returning-player scenarios (JOB 19). Seeds localStorage for 3 combined
// absence+progress scenarios and captures the home menu (with the WELCOME BACK card) at 2 viewports.
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4173';
const DAY = 86400000;
const dayStr = (ms) => new Date(ms).toISOString().slice(0, 10);

const SCENARIOS = [
  { id: 'A-1day-lv12-streak4', awayDays: 1, xp: { lv: 12, into: 200 }, rebirths: 0,
    streak: (now) => ({ count: 4, lastDay: dayStr(now - DAY), freezes: 0 }) },
  { id: 'B-3day-lv30-r1-broken', awayDays: 3, xp: { lv: 30, into: 500 }, rebirths: 1,
    streak: (now) => ({ count: 0, lastDay: dayStr(now - 3 * DAY), freezes: 0 }) },
  { id: 'C-14day-lv8-lost', awayDays: 14, xp: { lv: 8, into: 80 }, rebirths: 0,
    streak: (now) => ({ count: 0, lastDay: dayStr(now - 14 * DAY), freezes: 0 }) },
];
const VIEWPORTS = [[1366, 768], [390, 844]];

const b = await chromium.launch();
for (const s of SCENARIOS) {
  for (const [w, h] of VIEWPORTS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1.5 });
    const page = await ctx.newPage();
    await page.addInitScript((sc) => {
      const now = Date.now();
      const DAY = 86400000;
      try {
        localStorage.setItem('wa_last_seen', String(now - sc.awayDays * DAY));
        localStorage.setItem('taw.xp', JSON.stringify(sc.xp));
        localStorage.setItem('taw.rebirths', String(sc.rebirths));
        localStorage.setItem('taw.streak', JSON.stringify(sc.streak));
        localStorage.setItem('taw.winsLifetime', '25000');
        localStorage.setItem('taw.wins', '4200');
        // leave taw.returnClaim UNSET so the bonus is claimable
      } catch (e) { /* ignore */ }
    }, { awayDays: s.awayDays, xp: s.xp, rebirths: s.rebirths, streak: s.streak(Date.now()) });
    await page.goto(`${BASE}/?portal=1`);
    await page.waitForTimeout(2500); // dictionary load + return-card claim on mount
    const f = path.join(OUT, `${s.id}-${w}x${h}.png`);
    await page.screenshot({ path: f });
    console.log('saved', path.basename(f));
    await ctx.close();
  }
}
await b.close();
