// cap-sat-sweep.mjs — SAT Rush surfaces the generic sweep can't reach. Usage: node cap-sat-sweep.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs'; import path from 'path';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });

async function run(w, h, tag) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); await installBackendMock(p);
  const log = [];
  const snap = async (name) => { await p.waitForTimeout(300); try { await p.screenshot({ path: path.join(OUT, `sat-${name}-${tag}.png`) }); log.push(name + ' OK'); } catch (e) { log.push(name + ' FAIL'); } };
  try {
    await p.goto('/?satRush=1&portal=1'); await waitImg(p); await p.waitForTimeout(300);
    await p.locator('[data-game="sat-rush"] .game-card').click({ force: true }); await p.waitForTimeout(500);
    await snap('modeselect');
    await p.getByRole('button', { name: 'Play' }).click(); await p.waitForTimeout(500);
    await snap('lineup-or-brief-choice');
    await p.getByRole('button', { name: /BRIEFING/ }).click(); await p.waitForTimeout(700);
    await p.locator('.sr-brief-page').waitFor({ timeout: 5000 });
    await snap('briefing');
    await p.getByRole('button', { name: 'Start the run' }).click();
    await p.locator('.sr-slots').waitFor({ timeout: 6000 }); await p.waitForTimeout(1200);
    await snap('play');
  } catch (e) { log.push('ABORT: ' + String(e).split('\n')[0].slice(0, 90)); }
  console.log(`[sat ${tag} ${w}x${h}] ` + log.join(' | '));
  await b.close();
}
await run(1440, 900, 'desktop');
await run(390, 844, 'mobile');
console.log('shots ->', OUT);
