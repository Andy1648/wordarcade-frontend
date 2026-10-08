// NIGHT OCT8 R4 — step 7: play the ROLL loop on PRODUCTION (typeaword.com) with a throwaway profile, N holds,
// frames every ~90 ms through the first (pity-forced LEGENDARY) roll → a GIF + 4 key frames; the tier + timing
// of every roll logged. A fresh, unclaimed profile never posts to the live ticker (announceTick needs a claim).
//   SHOT_FONTS=1 N=10 node tools/_shots/prodroll.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const base = process.env.BASE || 'https://typeaword.com';
const out = process.env.OUT || 'claude/night-oct8-r4/_raw/prod';
const N = Number(process.env.N || 10);
const [w, h] = (process.env.SIZE || '1366x657').split('x').map(Number);
fs.mkdirSync(out, { recursive: true });

const gemsOf = (bal) => JSON.stringify({ v: 1, bal, peak: 12, streak: 0, mig: 1 });
const SEED = {
  'taw.rollsOn': '1', 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1', 'taw.tut.gems': '1',
  'taw.tut.keyTier': '1', 'taw.tut.pv10': '1', 'taw.xp': JSON.stringify({ lv: 12, into: 0 }), 'taw.marksRevealed': '1',
  'taw.marksOwned': '[]', 'taw.marksSeen': '[]', 'taw.wins': '50000', 'taw.gems': gemsOf(2000), 'taw.s2.gems': JSON.stringify({ v: 1, bal: 2000 }),
  'taw.markRolls': JSON.stringify({ v: 2, rolls: 30, sinceEpic: 5, sinceLegendary: 124, everEpic: true, starter: true, marks: { 'mk-eclipse': { n: 1, first: 1 } }, milestones: [], skipBelow: 'epic', done: [] }),
  // SEASON 2 is live: a stamped save with the Editor's Note already collected, and the season-2 wallet (75 a roll)
  'taw.econ': '13', 'taw.s2.welcome': JSON.stringify({ st: 'done', r: 0 }), 'taw.s2.gems': gemsOf(2000), 'taw.s2.rebirths': '0',
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) { try { localStorage.setItem(k, v); } catch { /* */ } } }, SEED);
await page.goto(`${base}/?portal=1`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
// the Editor's Note (one-shot) if the boot still shows it: COLLECT → PLAY
for (const label of ['COLLECT', 'PLAY']) {
  const b = page.getByRole('button', { name: new RegExp(`^${label}`) });
  if (await b.count()) { await b.first().click({ force: true }); await page.waitForTimeout(4000); }
}
await page.locator('.hp-nav.is-gears:visible').first().click({ force: true });
await page.locator('.rs-overlay').waitFor();
await page.waitForTimeout(1200);
const log = [];
for (let i = 0; i < N; i += 1) {
  const box = await page.locator('.rs-roll').boundingBox();
  const t0 = Date.now();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const frames = i === 0;
  let f = 0;
  const snap = async (name) => { if (frames) await page.screenshot({ path: `${out}/f${String(f++).padStart(3, '0')}-${name}.png` }); };
  for (let k = 0; k < 6; k += 1) { await page.waitForTimeout(90); await snap('hold'); }
  await page.mouse.up();
  const tRelease = Date.now();
  // the spin: frames until the result line or the reveal is up
  let landedAt = 0;
  for (let k = 0; k < 60; k += 1) {
    await page.waitForTimeout(90);
    await snap('spin');
    const cut = await page.locator('[data-testid="roll-cutscene"].is-on').count();
    const line = await page.locator('[data-testid="mark-roll-result"]').count();
    if ((cut || line) && !landedAt) { landedAt = Date.now(); if (!frames) break; }
    if (landedAt && Date.now() - landedAt > 2600) break;
  }
  const cut = page.locator('[data-testid="roll-cutscene"]');
  const cutOn = await cut.evaluate((el) => el.classList.contains('is-on')).catch(() => false);
  const tier = cutOn ? await cut.getAttribute('data-tier') : await page.locator('[data-testid="mark-roll-result"]').getAttribute('data-tier').catch(() => '?');
  if (cutOn) { await snap('reveal'); await cut.click({ force: true }); await page.waitForTimeout(900); await snap('kept'); }
  else await snap('kept');
  log.push({ roll: i + 1, tier, holdMs: tRelease - t0, toLandMs: landedAt ? landedAt - tRelease : -1 });
  console.log(JSON.stringify(log[log.length - 1]));
  await page.waitForTimeout(500);
}
await page.screenshot({ path: `${out}/final.png` });
fs.writeFileSync(`${out}/log.json`, JSON.stringify({ log, errs }, null, 1));
await ctx.close();
await browser.close();
// the GIF of roll 1 (frames every ~90 ms, 10 fps, 683px wide)
try {
  execSync(`ffmpeg -y -loglevel error -framerate 10 -pattern_type glob -i '${out}/f*.png' -vf "scale=683:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" ${out}/../../s7-roll-loop.gif`);
  console.log('gif written');
} catch (e) { console.log('gif failed', String(e).slice(0, 200)); }
if (errs.length) console.log('PAGEERRORS', errs.join(' | '));
