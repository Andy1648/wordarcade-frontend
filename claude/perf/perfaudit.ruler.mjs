// _perfaudit.spec.js — JOB 6 runtime perf audit. For each surface, records over ~2.5s: median &
// p95 frame time, peak concurrent animations, and the INFINITE-animation count (the budget's real
// build-failing metric). Runs under 4x CPU throttle @390px (mobile, the surface that matters). Vs the
// ANIMATION BUDGET (CLAUDE.md): ZERO new infinite anims / transform+opacity only / composited work
// scales. REPORT ONLY. Prints PERFAUDIT rows.
import { test } from '@playwright/test';
const card = (page, id) => page.locator(`.game-card-magnet[data-game="${id}"] .game-card`);
test.use({ viewport: { width: 390, height: 844 } });

async function startRec(page) {
  await page.evaluate(() => {
    window.__f = []; window.__peak = 0; window.__inf = 0; let last = performance.now();
    const loop = () => {
      const now = performance.now(); window.__f.push(now - last); last = now;
      const a = document.getAnimations(); if (a.length > window.__peak) window.__peak = a.length;
      let inf = 0; for (const an of a) { try { const d = an.effect.getComputedTiming().duration; if (an.playState === 'running' && (d === Infinity || an.effect.getTiming().iterations === Infinity)) inf++; } catch {} }
      if (inf > window.__inf) window.__inf = inf;
      window.__raf = requestAnimationFrame(loop);
    };
    window.__raf = requestAnimationFrame(loop);
  });
}
async function stopRec(page) {
  return page.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    const f = window.__f.slice(5).sort((a, b) => a - b);
    const med = f.length ? f[Math.floor(f.length / 2)] : 0;
    const p95 = f.length ? f[Math.floor(f.length * 0.95)] : 0;
    return { med: +med.toFixed(1), p95: +p95.toFixed(1), peak: window.__peak, inf: window.__inf, frames: f.length };
  });
}

test('runtime perf audit across surfaces', async ({ page }) => {
  test.setTimeout(180000);
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => { try { localStorage.setItem('wa_last_seen', String(Date.now())); localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); localStorage.setItem('taw.wins', '9999999'); } catch {} });
  const rows = [];
  const measure = async (label, setup, action) => {
    try {
      await setup();
      await page.waitForTimeout(600);
      await startRec(page);
      if (action) await action(); else await page.waitForTimeout(2500);
      const r = await stopRec(page);
      rows.push({ label, ...r }); console.log(`PERFAUDIT ${label} med=${r.med}ms p95=${r.p95}ms peakAnims=${r.peak} infinite=${r.inf} frames=${r.frames}`);
    } catch (e) { console.log(`PERFAUDIT ${label} ERROR ${e.message.slice(0,80)}`); }
  };
  const toMenu = async () => { await page.goto('/?portal=1'); await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible', timeout: 20000 }); };

  // 1. Menu — IDLE (no input): the budget's headline (should be ~1 infinite anim at rest).
  await measure('menu-idle', toMenu, null);
  // 2. Menu — 30 keys/sec BURST (pop/particle pooling stress).
  await measure('menu-burst', toMenu, async () => {
    await page.locator('body').click();
    const t0 = Date.now(); while (Date.now() - t0 < 2500) { await page.keyboard.type('a'); await page.waitForTimeout(33); }
  });
  // 3. FUSE — calm (just entered) then critical (rapid input).
  await measure('fuse-calm', async () => { await toMenu(); await card(page, 'fuse').click(); await page.locator('.mode-dialog-btn-create').click(); await page.waitForTimeout(1200); }, null);
  await measure('fuse-critical', async () => {}, async () => { const t0 = Date.now(); while (Date.now() - t0 < 2500) { await page.keyboard.type('e'); await page.waitForTimeout(30); await page.keyboard.press('Backspace'); } });
  // 4. CHAIN — calm.
  await measure('chain-calm', async () => { await toMenu(); await card(page, 'chain').click(); await page.locator('.mode-dialog-btn-create').click(); await page.waitForTimeout(1200); }, null);
  // 5. SAT RUSH — calm (endgame speed-lines are the stress, but calm is the baseline).
  await measure('satrush-calm', async () => { await toMenu(); await card(page, 'sat-rush').click(); await page.waitForTimeout(1800); }, null);

  console.log('PERFAUDIT-JSON ' + JSON.stringify(rows));
});
