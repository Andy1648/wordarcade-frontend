// menu-tti.spec.js — JOB D measurement harness (NOT a gate assertion; a reproducible ruler).
// Measures TIME-TO-INTERACTIVE of the MENU on a cold load, under 4x CPU throttle + Slow-3G
// network (Chrome DevTools "Slow 3G": 400 kb/s down, 400 ms RTT). We seed wa_last_seen so the
// intro chain is skipped (SEEN_INTRO) — the same path a returning visitor takes — so we time the
// menu boot, not the once-per-session cosmetic intro. TTI here = the moment the primary menu
// control (.homepage-corner-nav, i.e. SHOP/STATS/REBIRTH) is present AND hit-testable.
//
// Reports median of 3 fresh loads. Run: npx playwright test menu-tti --workers=1 --reporter=line
import { test, expect } from '@playwright/test';

const RUNS = 3;
const CPU_RATE = 4; // 4x slowdown
// Chrome "Slow 3G" preset.
const SLOW_3G = {
  offline: false,
  downloadThroughput: (400 * 1024) / 8, // bytes/s
  uploadThroughput: (400 * 1024) / 8,
  latency: 400, // ms RTT
};

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

test('MENU TTI @ 4x CPU + Slow-3G (median of 3)', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const samples = [];
  for (let i = 0; i < RUNS; i++) {
    const context = await browser.newContext();
    // Seed the returning-visitor flag BEFORE any page script runs, so the intro is skipped.
    await context.addInitScript(() => {
      try {
        localStorage.setItem('wa_last_seen', String(Date.now()));
      } catch {
        /* ignore */
      }
      // A real Slow-3G device's browser reports effectiveType '3g' via the Network Information
      // API — CDP bandwidth throttling alone does NOT set this, so stub it to match reality. This
      // is what the app's slow-connection warm guard reads.
      try {
        Object.defineProperty(navigator, 'connection', {
          configurable: true,
          value: { effectiveType: '3g', saveData: false, addEventListener() {}, removeEventListener() {} },
        });
      } catch {
        /* ignore */
      }
    });
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });
    await client.send('Network.emulateNetworkConditions', SLOW_3G);

    const t0 = Date.now();
    await page.goto('/', { waitUntil: 'commit' });
    await page.locator('.homepage-corner-nav').first().waitFor({ state: 'visible', timeout: 120_000 });
    // Confirm it is genuinely hit-testable (interactive), not just painted.
    await expect(page.locator('.homepage-nav-btn').first()).toBeEnabled();
    const tti = Date.now() - t0;
    samples.push(tti);
    // eslint-disable-next-line no-console
    console.log(`TTI-RUN ${i + 1}: ${tti}ms`);
    await context.close();
  }
  const med = median(samples);
  // eslint-disable-next-line no-console
  console.log(`TTI | samples=[${samples.join(', ')}]ms | MEDIAN=${med}ms`);
  await testInfo.attach('tti', { body: JSON.stringify({ samples, median: med }), contentType: 'application/json' });
  // Not a hard gate — but flag if we blow way past the 5s target so it can't silently regress.
  expect(med, `menu TTI median ${med}ms`).toBeLessThan(15_000);
});
