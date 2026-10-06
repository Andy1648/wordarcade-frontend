// claude/xpbar-gif.mjs — THROWAWAY: record the menu XP bar while typing fast across a level wrap (CDP screencast =
// real-time frames with timestamps), crop to the bar, hand the frames to claude/xpbar-gif.py (PIL) for the GIF.
// usage: node claude/xpbar-gif.mjs <tag> [baseURL]   → claude/mockups/v2/shots/xpbar-600-<tag>.gif
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { installBackendMock } from '../e2e/support/backendMock.js';
const tag = process.argv[2] || 'typing';
const base = process.argv[3] || 'http://localhost:4317';
const dir = `claude/.xpbar-frames-${tag}`;
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 657 }, reducedMotion: 'no-preference' });
const page = await ctx.newPage();
await page.addInitScript(() => {
  try {
    const save = JSON.stringify({ lv: 3, f: 0.62, rc: 0, v: 10 });
    localStorage.setItem('taw.xp', save);
    localStorage.setItem('taw.xpv10', save);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
  } catch { /* blocked */ }
});
await installBackendMock(page);
await page.goto(`${base}/?portal=1`);
await page.locator('.menu-xp-bar').waitFor();
await page.waitForTimeout(1500);
const box = await page.locator('.menu-xp-cluster').boundingBox();
const cdp = await ctx.newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async (f) => {
  frames.push({ t: f.metadata.timestamp, data: f.data });
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* closed */ }
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, everyNthFrame: 1 });
await page.waitForTimeout(400);
// ~14 keys a second for 3 s — fast typing; crosses at least one level wrap
await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const keys = 'qzxjkvwy';
  for (let i = 0; i < 42; i += 1) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: keys[i % keys.length], bubbles: true }));
    await sleep(70);
  }
});
await page.waitForTimeout(1200);
await cdp.send('Page.stopScreencast');
frames.forEach((f, i) => writeFileSync(`${dir}/${String(i).padStart(4, '0')}.jpg`, Buffer.from(f.data, 'base64')));
writeFileSync(`${dir}/times.json`, JSON.stringify(frames.map((f) => f.t)));
await browser.close();
const crop = [Math.floor(box.x) - 10, Math.floor(box.y) - 40, Math.ceil(box.x + box.width) + 10, Math.ceil(box.y + box.height) + 6];
execFileSync('python', ['claude/xpbar-gif.py', dir, `claude/mockups/v2/shots/xpbar-600-${tag}.gif`, crop.join(',')], { stdio: 'inherit' });
rmSync(dir, { recursive: true, force: true });
