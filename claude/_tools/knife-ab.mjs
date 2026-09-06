// knife-ab.mjs — drift-cancelling A/B of the ONE variable the fix changes: whether
// the ANIMATED .knife-blade carries CSS filter:drop-shadow + mask-image.
//   variant 'css'   = re-add those two props to .knife-blade (the OLD, pre-fix state)
//   variant 'baked' = leave them off (the fix; glow+feather are in the SVG)
// Everything else identical (same baked SVG underneath — irrelevant to the compositing
// question, which is purely about props on the animated layer). Measured INTERLEAVED
// (baked, css, baked, css, ...) so ambient machine-load drift hits both equally. The
// absolute frame rate is load-bound on this box; the A/B DELTA is the trustworthy signal.
import { chromium } from '@playwright/test';

const BASE = process.argv[2] || 'http://localhost:5199/knife-measure.html';
const RATES = [1, 6];
const ROUNDS = Number(process.argv[3]) || 10;

const CSS_VARIANT = `
.knife-blade {
  filter: drop-shadow(0 0 9px rgba(255,255,255,0.75)) !important;
  -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 5%, #000 95%, transparent 100%) !important;
  mask-image: linear-gradient(to right, transparent 0%, #000 5%, #000 95%, transparent 100%) !important;
}`;

const RECORDER = `
window.__startRec = () => {
  window.__knife = { done: false };
  const rec = { frames: [], animMeta: {}, epochOffset: Date.now() - performance.now(), mount: null, stopAt: 0, done: false };
  window.__rec = rec;
  const loop = () => {
    const now = performance.now();
    rec.frames.push(now);
    let list = []; try { list = document.getAnimations(); } catch {}
    for (const a of list) {
      if (a.animationName === 'ks-blade-draw' && !rec.animMeta.draw && a.startTime != null) {
        let dur = null; try { dur = a.effect.getTiming().duration; } catch {}
        rec.animMeta.draw = { start: a.startTime, duration: dur };
      }
    }
    const ks = document.querySelector('.knife-split');
    if (ks && rec.mount == null) rec.mount = now;
    if (window.__knife && window.__knife.done && !rec.stopAt) rec.stopAt = now;
    if (rec.stopAt && now - rec.stopAt > 250) { rec.done = true; return; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};`;

async function measure(browser, rate, variant) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.addInitScript(RECORDER);
  const client = await context.newCDPSession(page);
  const shots = [];
  client.on('Page.screencastFrame', (e) => {
    shots.push(e.metadata.timestamp * 1000);
    client.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });

  await page.goto(BASE, { waitUntil: 'load' });
  if (variant === 'css') await page.addStyleTag({ content: CSS_VARIANT });
  await client.send('Emulation.setCPUThrottlingRate', { rate });

  // warm-up (discarded)
  await page.evaluate(() => window.__replayKnife());
  await page.waitForFunction(() => window.__knife && window.__knife.done, null, { timeout: 30000 });
  await page.waitForTimeout(120);

  await page.evaluate(() => window.__startRec());
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 50, everyNthFrame: 1 });
  await page.evaluate(() => window.__replayKnife());
  await page.waitForFunction(() => window.__rec && window.__rec.done, null, { timeout: 30000 });
  await client.send('Page.stopScreencast').catch(() => {});

  const rec = await page.evaluate(() => window.__rec);
  await context.close();

  const off = rec.epochOffset;
  const sp = shots.map((t) => t - off).sort((a, b) => a - b);
  const d = rec.animMeta.draw;
  if (!d || d.start == null || d.duration == null) return null;
  return sp.filter((t) => t >= d.start && t < d.start + d.duration).length;
}

const summary = (arr) => {
  const a = arr.filter((x) => x != null).sort((x, y) => x - y);
  if (!a.length) return { n: 0 };
  return {
    n: a.length,
    mean: +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2),
    median: a[Math.floor(a.length / 2)],
    min: a[0],
    max: a[a.length - 1],
  };
};

(async () => {
  const browser = await chromium.launch({
    args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
  });
  const out = { base: BASE, rounds: ROUNDS, byRate: {} };
  for (const rate of RATES) {
    const baked = [], css = [];
    for (let r = 0; r < ROUNDS; r++) {
      process.stderr.write(`rate ${rate}x round ${r + 1}/${ROUNDS}\n`);
      // interleave within the round to share drift
      baked.push(await measure(browser, rate, 'baked'));
      css.push(await measure(browser, rate, 'css'));
    }
    out.byRate[rate] = {
      bakedDrawFrames: baked,
      cssDrawFrames: css,
      bakedSummary: summary(baked),
      cssSummary: summary(css),
      meanDelta: +(summary(baked).mean - summary(css).mean).toFixed(2),
    };
  }
  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})();
