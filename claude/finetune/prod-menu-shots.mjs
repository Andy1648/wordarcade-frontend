// prod-menu-shots.mjs — fine-tune loop (visual): the LIVE typeaword.com menu at Andy's five sizes, fresh profile
// and an LV175 profile, real fonts. Read-only (no claims, no submits). Output claude/finetune/prod-oct3/.
import { chromium } from '@playwright/test';
const OUT = 'claude/finetune/prod-oct3';
const SIZES = [[1280, 551], [1366, 625], [390, 844], [1920, 1080], [2560, 1440]];
const PROFILES = {
  fresh: {},
  lv175: { 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.init': '1', 'taw.xp': JSON.stringify({ lv: 175, f: 0.437, rc: 4, v: 10 }), 'taw.xpv10': JSON.stringify({ lv: 175, f: 0.437, rc: 4, v: 10 }), 'taw.econ': '10', 'taw.rebirths': '4', 'taw.wins': '1343513423', 'taw.keytier': '9' },
};
const b = await chromium.launch();
const errs = [];
try {
  for (const [name, seed] of Object.entries(PROFILES)) {
    for (const [w, h] of SIZES) {
      const ctx = await b.newContext({ viewport: { width: w, height: h } });
      const p = await ctx.newPage();
      p.on('pageerror', (e) => errs.push(`${name} ${w}x${h}: ${e}`));
      await p.addInitScript((s) => { if (sessionStorage.getItem('ps')) return; sessionStorage.setItem('ps', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed);
      await p.goto('https://typeaword.com/?portal=1', { waitUntil: 'networkidle' });
      await p.waitForTimeout(4500);
      await p.screenshot({ path: `${OUT}/${name}-${w}x${h}.png` });
      await ctx.close();
    }
  }
} finally { await b.close(); }
console.log('errors:', errs.length, errs.slice(0, 5));
