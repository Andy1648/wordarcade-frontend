// perf-measure.mjs — Part 2 perf harness (report-only, untracked).
// Uses Playwright chromium + CDP for CPU throttle and network emulation.
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'http://127.0.0.1:4173';
const MEASURE_MS = 6000; // per-sample window
const results = {};

const INIT = () => {
  try {
    localStorage.setItem('wa_last_seen', String(Date.now()));
    localStorage.setItem('wa_has_played', '1');
    localStorage.setItem('taw.seenWinsHint', '1');
  } catch {}
};

// In-page rAF frame-time sampler → median / p95 / long-frame count.
async function frames(page, ms = MEASURE_MS) {
  return await page.evaluate(
    (dur) =>
      new Promise((res) => {
        const d = [];
        let last = performance.now();
        const start = last;
        function tick(now) {
          d.push(now - last);
          last = now;
          if (now - start < dur) requestAnimationFrame(tick);
          else {
            d.shift(); // drop first (warm-up)
            const s = d.slice().sort((a, b) => a - b);
            const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
            res({
              median: +q(0.5).toFixed(2),
              p95: +q(0.95).toFixed(2),
              max: +Math.max(...s).toFixed(2),
              frames: d.length,
              long50: d.filter((x) => x > 50).length,
            });
          }
        }
        requestAnimationFrame(tick);
      }),
    ms
  );
}

async function infiniteCount(page) {
  return await page.evaluate(() =>
    document.getAnimations().filter((a) => {
      try {
        return a.effect && a.effect.getTiming().iterations === Infinity && a.playState === 'running';
      } catch {
        return false;
      }
    }).length
  );
}

async function newThrottled(browser, rate) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const client = await ctx.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate });
  return { ctx, page, client };
}

async function gotoMenu(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  // Wait for the menu (SHOP button + a game card) past the dictionary loader.
  await page.waitForFunction(
    () => /SHOP/i.test(document.body.innerText) && !/Loading the dictionary/i.test(document.body.innerText),
    { timeout: 30000 }
  );
  await page.waitForTimeout(800);
}

async function measureMenu(page, tag) {
  await gotoMenu(page);
  const inf = await infiniteCount(page);
  const idle = await frames(page);
  // beat-simulated (music proxy): pulse html[data-beat] ~120bpm during the window.
  const beat = await page.evaluate(
    (dur) =>
      new Promise((res) => {
        const root = document.documentElement;
        const iv = setInterval(() => {
          root.setAttribute('data-beat', '1');
          setTimeout(() => root.removeAttribute('data-beat'), 90);
        }, 250);
        const d = [];
        let last = performance.now();
        const start = last;
        function tick(now) {
          d.push(now - last);
          last = now;
          if (now - start < dur) requestAnimationFrame(tick);
          else {
            clearInterval(iv);
            d.shift();
            const s = d.slice().sort((a, b) => a - b);
            res({ median: +s[Math.floor(s.length * 0.5)].toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), long50: d.filter((x) => x > 50).length });
          }
        }
        requestAnimationFrame(tick);
      }),
    MEASURE_MS
  );
  // 30 keys/sec burst.
  const burst = await page.evaluate(
    (dur) =>
      new Promise((res) => {
        const keys = 'abcdefghijklmnopqrstuvwxyz'.split('');
        let i = 0;
        const ki = setInterval(() => {
          const k = keys[i++ % keys.length];
          document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
        }, 33);
        const d = [];
        let last = performance.now();
        const start = last;
        function tick(now) {
          d.push(now - last);
          last = now;
          if (now - start < dur) requestAnimationFrame(tick);
          else {
            clearInterval(ki);
            d.shift();
            const s = d.slice().sort((a, b) => a - b);
            res({ median: +s[Math.floor(s.length * 0.5)].toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), long50: d.filter((x) => x > 50).length });
          }
        }
        requestAnimationFrame(tick);
      }),
    MEASURE_MS
  );
  return { infiniteAtRest: inf, idle, beatSim: beat, keyBurst: burst };
}

async function measureSolo(page, path, tag, pressureMs = 0) {
  await page.goto(`${BASE}/${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !/Loading the dictionary/i.test(document.body.innerText), { timeout: 30000 });
  await page.waitForTimeout(1500);
  const inf = await infiniteCount(page);
  const calm = await frames(page);
  let pressure = null;
  if (pressureMs) {
    await page.waitForTimeout(pressureMs); // let the run advance toward its endgame/fast phase
    pressure = await frames(page);
  }
  return { infiniteAtRest: inf, calm, pressure };
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--disable-features=CalculateNativeWinOcclusion'],
  });

  for (const rate of [1, 4]) {
    const key = `cpu${rate}x`;
    results[key] = {};
    console.error(`\n===== CPU ${rate}x =====`);

    // MENU
    try {
      const { ctx, page } = await newThrottled(browser, rate);
      results[key].menu = await measureMenu(page, key);
      console.error(`menu ${rate}x:`, JSON.stringify(results[key].menu));
      await ctx.close();
    } catch (e) {
      results[key].menu = { error: String(e).slice(0, 200) };
      console.error(`menu ${rate}x ERROR`, e.message);
    }

    // SOLO modes
    for (const [path, tag, pm] of [
      ['sat-rush?satrush=1', 'sat', 20000],
      ['chain?chain=1', 'chain', 12000],
      ['fuse?fuse=1', 'fuse', 12000],
    ]) {
      try {
        const { ctx, page } = await newThrottled(browser, rate);
        results[key][tag] = await measureSolo(page, path, tag, pm);
        console.error(`${tag} ${rate}x:`, JSON.stringify(results[key][tag]));
        await ctx.close();
      } catch (e) {
        results[key][tag] = { error: String(e).slice(0, 200) };
        console.error(`${tag} ${rate}x ERROR`, e.message);
      }
    }
  }

  // TTI on slow 3G, cold cache (1x CPU) — measured once.
  try {
    const ctx = await browser.newContext();
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    const client = await ctx.newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (400 * 1024) / 8, // ~400 kbps
      uploadThroughput: (400 * 1024) / 8,
      latency: 400,
    });
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    const t0 = Date.now();
    await page.goto(BASE, { waitUntil: 'commit' });
    // menu interactive marker
    await page.waitForFunction(() => /SHOP/i.test(document.body.innerText), { timeout: 120000 });
    const tMenu = Date.now() - t0;
    // dictionary-ready marker (play-ready)
    let tDict = null;
    try {
      await page.waitForFunction(() => !/Loading the dictionary/i.test(document.body.innerText), { timeout: 120000 });
      tDict = Date.now() - t0;
    } catch {}
    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0] || {};
      return { domContentLoaded: Math.round(n.domContentLoadedEventEnd || 0), loadEvent: Math.round(n.loadEventEnd || 0), domInteractive: Math.round(n.domInteractive || 0) };
    });
    const transfer = await page.evaluate(() =>
      performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0)
    );
    results.tti3g = { menuInteractiveMs: tMenu, dictReadyMs: tDict, nav, totalTransferBytes: transfer };
    console.error('TTI 3G:', JSON.stringify(results.tti3g));
    await ctx.close();
  } catch (e) {
    results.tti3g = { error: String(e).slice(0, 300) };
    console.error('TTI 3G ERROR', e.message);
  }

  await browser.close();
  writeFileSync('perf-results.json', JSON.stringify(results, null, 2));
  console.error('\nWROTE perf-results.json');
})();
