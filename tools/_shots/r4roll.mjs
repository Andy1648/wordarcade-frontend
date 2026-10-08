// NIGHT OCT8 R4 — the ROLL screen's moments: charged (HOLD TO ROLL at full charge), the TELL (an EPIC+ spin's last
// cells), the reveal, the rest. Seeds a LEGENDARY pity roll so the tell + full reveal always play.
//   SHOT_FONTS=1 TAG=after TIER=legendary node tools/_shots/r4roll.mjs
// Uses the e2e backend mock so no socket ever reaches production. Real motion (no reduced-motion emulation).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from '../../e2e/support/backendMock.js';

const base = process.env.BASE || 'http://localhost:4173';
const out = process.env.OUT || 'claude/night-oct8-r4/_raw';
const tag = process.env.TAG || 'roll';
const sizes = (process.env.SIZES || '1366x657 390x844').split(' ').map((s) => s.split('x').map(Number));
const tier = process.env.TIER || 'legendary'; // legendary (pity) | epic (pity) | any
const moments = (process.env.MOMENTS || 'rest,charged,tell,reveal,kept').split(',');
fs.mkdirSync(out, { recursive: true });

const gemsOf = (bal) => JSON.stringify({ v: 1, bal, peak: 12, streak: 0, mig: 1 });
const SEED = {
  'taw.rollsOn': '1', 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1',
  'taw.xp': JSON.stringify({ lv: 12, into: 0 }), 'taw.marksRevealed': '1', 'taw.marksOwned': '[]', 'taw.marksSeen': '[]',
  'taw.wins': '50000000', 'taw.gems': gemsOf(1000),
};
const state = { v: 2, rolls: 30, sinceEpic: 5, sinceLegendary: 30, everEpic: true, starter: true, marks: { 'mk-eclipse': { n: 1, first: 1 } }, milestones: [], skipBelow: 'epic', done: [] };
if (tier === 'legendary') state.sinceLegendary = 499;
if (tier === 'epic') state.sinceEpic = 49;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await installBackendMock(page, { seedReduceMotion: false });
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch { /* */ } } }, { ...SEED, 'taw.markRolls': JSON.stringify(state) });
  await page.goto(`${base}/?portal=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('.hp-nav.is-gears:visible').first().click({ force: true });
  await page.locator('.rs-overlay').waitFor();
  await page.waitForTimeout(900);
  const shot = async (m) => { if (moments.includes(m)) await page.screenshot({ path: `${out}/${tag}-${m}-${w}x${h}.png` }); };
  await shot('rest');
  const box = await page.locator('.rs-roll').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(560);
  await shot('charged');
  await page.mouse.up();
  await page.waitForTimeout(Number(process.env.TELL_AT || 2080));
  await shot('tell');
  await page.waitForTimeout(1900);
  await shot('reveal');
  const cut = page.locator('[data-testid="roll-cutscene"]');
  if (await cut.evaluate((el) => el.classList.contains('is-on')).catch(() => false)) { await cut.click({ force: true }); await page.waitForTimeout(1000); }
  await shot('kept');
  console.log(`wrote ${out}/${tag}-*-${w}x${h}.png`);
  if (errs.length) console.log('  PAGEERRORS:', errs.join(' | '));
  await ctx.close();
}
await browser.close();
