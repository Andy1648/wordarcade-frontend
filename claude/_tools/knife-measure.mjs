// knife-measure.mjs — measure the KnifeSplit slash chain under CPU throttle.
// REPORT-ONLY tooling (perf/knife-measure). Drives /knife-measure.html, which mounts
// the REAL KnifeSplit in isolation. For each CPU rate it records:
//   - PRESENTED frames (CDP Page screencast, one event per composited frame swap),
//     epoch-aligned to the phase marks so we can slice the 160ms draw + 400ms open.
//   - a trace DrawFrame TOTAL over the replay, as a fidelity cross-check that the
//     screencast wasn't starved by ack backpressure under heavy throttle.
//   - in-page rAF cadence (MAIN-THREAD frames) + document.getAnimations() running
//     count sampled per rAF (peak concurrency).
// Then a reduced-motion pass confirms KnifeSplit never mounts.
import { chromium } from '@playwright/test';

const BASE = process.argv[2] || 'http://localhost:5199/knife-measure.html';
const RATES = [1, 4, 6];
const DRAW_MS = 160;
const OPEN_MS = 400;

// The recorder anchors each phase window on the REAL CSS-animation startTime
// (Web Animations API). animation.startTime is in document-timeline ms, which shares
// its origin with performance.now(), so it aligns directly with the presented-frame
// stream and is immune to rAF-sampling lag under CPU throttle. rAF is used ONLY for
// frame cadence + concurrency sampling.
const RECORDER = `
window.__startRec = () => {
  // Clear any leftover done flag from the warm-up replay, else this loop would read
  // a stale true and self-terminate before the measured replay runs.
  window.__knife = { done: false };
  const rec = { frames: [], anims: [], phases: {}, animMeta: {}, epochOffset: Date.now() - performance.now(), stopAt: 0, done: false };
  window.__rec = rec;
  const seen = {};
  const NAMES = ['ks-blade-draw','ks-head-run','ks-slash-fade','ks-open-top','ks-open-bottom'];
  const loop = () => {
    const now = performance.now();
    rec.frames.push(now);
    let list = [];
    try { list = document.getAnimations(); } catch {}
    rec.anims.push(list.filter(a => a.playState === 'running').length);
    for (const a of list) {
      const nm = a.animationName;
      if (nm && NAMES.includes(nm) && !rec.animMeta[nm] && a.startTime != null) {
        let dur = null;
        try { dur = a.effect.getTiming().duration; } catch {}
        rec.animMeta[nm] = { start: a.startTime, duration: dur };
      }
    }
    const ks = document.querySelector('.knife-split');
    if (ks) {
      if (!seen.mount) { rec.phases.mount = now; seen.mount = true; }
    } else if (seen.mount && !seen.gone) { rec.phases.gone = now; seen.gone = true; }
    if (window.__knife && window.__knife.done && !rec.stopAt) rec.stopAt = now;
    if (rec.stopAt && now - rec.stopAt > 250) { rec.done = true; return; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};`;

const stats = (arr) => {
  if (!arr.length) return { n: 0 };
  const s = [...arr].sort((a, b) => a - b);
  const med = s[Math.floor(s.length / 2)];
  return { n: arr.length, median: +med.toFixed(1), worst: +Math.max(...arr).toFixed(1), min: +Math.min(...arr).toFixed(1) };
};

async function runRate(browser, rate) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.addInitScript(RECORDER);
  const client = await context.newCDPSession(page);

  // Presented frames via screencast (async ack: never await, so a throttled main
  // thread doesn't gate the ack round-trip more than it must).
  const shots = []; // { t: epochMs }
  client.on('Page.screencastFrame', (e) => {
    shots.push({ t: e.metadata.timestamp * 1000 });
    client.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
  });

  // Trace DrawFrame total (fidelity cross-check).
  let drawFrames = 0;
  client.on('Tracing.dataCollected', (ev) => {
    for (const it of ev.value || []) if (it.name === 'DrawFrame') drawFrames++;
  });

  await page.goto(BASE, { waitUntil: 'load' });
  await client.send('Emulation.setCPUThrottlingRate', { rate });

  // WARM-UP: one DISCARDED replay so first-paint / JIT / layer-creation costs land
  // here, not in the measured run (the cold first replay under-renders the draw).
  await page.evaluate(() => window.__replayKnife());
  await page.waitForFunction(() => window.__knife && window.__knife.done, null, { timeout: 30000 });
  await page.waitForTimeout(150);

  // MEASURED run.
  await page.evaluate(() => window.__startRec());
  await client.send('Tracing.start', {
    categories: 'disabled-by-default-devtools.timeline.frame,disabled-by-default-devtools.timeline',
    transferMode: 'ReportEvents',
    bufferUsageReportingInterval: 200,
  });
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 60, everyNthFrame: 1 });

  await page.evaluate(() => window.__replayKnife());
  await page.waitForFunction(() => window.__rec && window.__rec.done, null, { timeout: 30000 });

  await client.send('Page.stopScreencast').catch(() => {});
  await client.send('Tracing.end').catch(() => {});
  await new Promise((r) => setTimeout(r, 400)); // let trace flush

  const rec = await page.evaluate(() => window.__rec);
  await context.close();

  // Align screencast epoch -> in-page perf clock (same origin as animation.startTime).
  const off = rec.epochOffset;
  const shotsPerf = shots.map((s) => s.t - off).sort((a, b) => a - b);
  const inWin = (arr, a, b) => arr.filter((t) => t >= a && t < b);
  const gaps = (arr) => arr.slice(1).map((t, i) => t - arr[i]);
  const m = rec.animMeta;

  // Window anchored on the REAL animation start/duration (Web Animations API).
  const windowFor = (name) => {
    const a = m[name];
    if (!a || a.start == null || a.duration == null) return null;
    const shotsIn = inWin(shotsPerf, a.start, a.start + a.duration);
    const g = gaps(shotsIn);
    return {
      startFromMount: rec.phases.mount != null ? +(a.start - rec.phases.mount).toFixed(0) : null,
      durationMs: a.duration,
      presentedFrames: shotsIn.length,
      frameTime: stats(g),
      over50ms: g.filter((x) => x > 50).length,
    };
  };

  const chainA = rec.phases.mount ?? shotsPerf[0];
  const chainB = rec.phases.gone ?? shotsPerf[shotsPerf.length - 1];
  const chainShots = inWin(shotsPerf, chainA, chainB + 1);
  const rafGaps = gaps(rec.frames.filter((t) => t >= chainA && t <= chainB + 1));
  const peakConc = rec.anims.length ? Math.max(...rec.anims) : 0;

  return {
    rate,
    // The two windows the brief asks about, anchored on real animation start.
    draw: windowFor('ks-blade-draw'), // the 160ms slash streak (blade, filter+mask)
    open: windowFor('ks-open-top'), // the 400ms cover part (translateY, no filter) — control
    fade: windowFor('ks-slash-fade'),
    chain: {
      presentedTotal: chainShots.length,
      traceDrawFrameTotal: drawFrames || null, // fidelity cross-check vs presentedTotal
      presentedFrameTime: stats(gaps(chainShots)),
      presentedOver50ms: gaps(chainShots).filter((g) => g > 50).length,
      mainThreadRafFrameTime: stats(rafGaps),
    },
    concurrency: { peakRunningAnims: peakConc },
  };
}

async function reducedMotionCheck(browser) {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => window.__replayKnife());
  await page.waitForTimeout(500);
  const mounted = await page.evaluate(() => document.querySelectorAll('.knife-split').length);
  const anims = await page.evaluate(() => document.getAnimations().length);
  await context.close();
  return { knifeSplitElements: mounted, runningAnimations: anims };
}

(async () => {
  // HEADLESS by default: headed Chrome throttles frame production for occluded/
  // unfocused windows, so on a background job most runs capture ~no frames. Headless
  // renders regardless of focus and its DrawFrame trace matched the screencast 1:1.
  // Its scheduler runs a touch under 60fps (~46fps), so treat absolute counts as a
  // FLOOR; the cross-rate COMPARISON is what matters. HEADED=1 to force headed.
  const browser = await chromium.launch({
    headless: process.env.HEADED !== '1',
    args: [
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  });
  const REPEATS = 3;
  const out = { base: BASE, repeatsPerRate: REPEATS, results: [] };
  for (const rate of RATES) {
    const runs = [];
    for (let i = 0; i < REPEATS; i++) {
      process.stderr.write(`measuring rate ${rate}x  run ${i + 1}/${REPEATS}...\n`);
      runs.push(await runRate(browser, rate));
    }
    // Compact summary across runs for the numbers the brief asks for.
    const pick = (path) => runs.map((r) => path.split('.').reduce((o, k) => (o == null ? null : o[k]), r));
    out.results.push({
      rate,
      drawPresentedFrames: pick('draw.presentedFrames'),
      drawFrameTimeMedian: pick('draw.frameTime.median'),
      drawFrameTimeWorst: pick('draw.frameTime.worst'),
      drawOver50ms: pick('draw.over50ms'),
      openPresentedFrames: pick('open.presentedFrames'),
      openFrameTimeMedian: pick('open.frameTime.median'),
      openFrameTimeWorst: pick('open.frameTime.worst'),
      openOver50ms: pick('open.over50ms'),
      drawStartFromMountMs: pick('draw.startFromMount'),
      chainPresentedTotal: pick('chain.presentedTotal'),
      chainWorstFrameTime: pick('chain.presentedFrameTime.worst'),
      peakConcurrentAnims: pick('concurrency.peakRunningAnims'),
      runs,
    });
  }
  process.stderr.write('reduced-motion check...\n');
  out.reducedMotion = await reducedMotionCheck(browser);
  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})();
