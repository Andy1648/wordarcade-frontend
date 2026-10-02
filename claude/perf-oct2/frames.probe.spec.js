// STEP 59 probe (not a gate): rAF frame intervals at 4x CPU throttle while typing, per screen.
import { test } from '@playwright/test';
import fs from 'node:fs';
import { SCREENS, bootMenu } from './support/screens.js';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, modeEntry } from './support/menu.js';
const OUT = 'claude/perf-oct2/frames.txt';
const VP = (process.env.PERF_VP || '1280x720').split('x').map(Number);
const pick = (n) => SCREENS.find((s) => s.name === n).nav;
const sat = async (page) => {
  await installBackendMock(page);
  await page.addInitScript(() => { localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); });
  await page.goto('/?satRush=1&tune=1&scene=normal&portal=1');
  await menuReady(page);
  await modeEntry(page, 'sat-rush').click();
  const play = page.getByRole('button', { name: 'Play' });
  if (await play.count()) await play.first().click();
  await page.locator('.sr-root, .sr-page, .sr-board, [class*="sr-"]').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
};
const CASES = [
  ['menu', async (p) => { await p.addInitScript(() => localStorage.setItem('taw.seenMenuSpotlight', '1')); await bootMenu(p, 60); }],
  ['ingame-word-bomb', pick('ingame-word-bomb')],
  ['ingame-category-blitz', pick('ingame-category-blitz')],
  ['ingame-chain', pick('ingame-chain')],
  ['ingame-fuse', pick('ingame-fuse')],
  ['sat-play', sat],
  ['gameover-word-bomb', pick('gameover-word-bomb')],
];
for (const [name, nav] of CASES) test(`frames ${name}`, async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: VP[0], height: VP[1] });
  await nav(page);
  await page.waitForTimeout(Number(process.env.SETTLE || 6000)); // past the 3-2-1-GO / load state
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForTimeout(500);
  const sample = page.evaluate(() => new Promise((res) => {
    const d = []; let last = performance.now(); const end = last + 4000;
    const f = (t) => { d.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else res(d); };
    requestAnimationFrame(f);
  }));
  const letters = 'streamingtonestrandabstract';
  for (let i = 0; i < 26; i++) { await page.keyboard.type(letters[i]); await page.waitForTimeout(130); if (i % 6 === 5) await page.keyboard.press('Enter'); }
  const d = (await sample).sort((a, b) => a - b);
  const q = (x) => d[Math.min(d.length - 1, Math.floor(d.length * x))].toFixed(1);
  const long = d.filter((x) => x > 34).length;
  const line = `${name.padEnd(22)} ${VP.join('x')} settle=${process.env.SETTLE || 6000}  n=${String(d.length).padStart(3)}  p50=${q(0.5)}  p95=${q(0.95)}  max=${d[d.length - 1].toFixed(0)}  long(>34ms)=${((long / d.length) * 100).toFixed(1)}%`;
  console.log('PERF', line);
  fs.appendFileSync(OUT, line + '\n');
});
