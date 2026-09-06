import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const BASE = 'http://127.0.0.1:4173';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('wa_last_seen', String(Date.now()));
      localStorage.setItem('wa_has_played', '1');
    } catch {}
  });
  const page = await ctx.newPage();
  const client = await ctx.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
    latency: 400,
  });
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body && /SHOP/i.test(document.body.innerText || ''), { timeout: 180000 });
  const menuInteractiveMs = Date.now() - t0;
  let dictReadyMs = null;
  try {
    await page.waitForFunction(() => document.body && !/Loading the dictionary/i.test(document.body.innerText || ''), { timeout: 180000 });
    dictReadyMs = Date.now() - t0;
  } catch {}
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] || {};
    return {
      domInteractive: Math.round(n.domInteractive || 0),
      domContentLoaded: Math.round(n.domContentLoadedEventEnd || 0),
      loadEvent: Math.round(n.loadEventEnd || 0),
    };
  });
  const res = await page.evaluate(() => {
    const rs = performance.getEntriesByType('resource');
    const total = rs.reduce((s, r) => s + (r.transferSize || 0), 0);
    const js = rs.filter((r) => /\.js(\?|$)/.test(r.name)).reduce((s, r) => s + (r.transferSize || 0), 0);
    return { totalKB: Math.round(total / 1024), jsKB: Math.round(js / 1024), reqCount: rs.length };
  });
  const out = { menuInteractiveMs, dictReadyMs, nav, transfer: res };
  console.error('TTI 3G:', JSON.stringify(out, null, 2));
  writeFileSync('perf-tti.json', JSON.stringify(out, null, 2));
  await browser.close();
})();
