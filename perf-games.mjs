// perf-games.mjs — real in-game frame timing (Playwright keeps rAF alive; CDP throttles CPU).
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const BASE = 'http://127.0.0.1:4173';
const out = {};

const INIT = () => {
  try {
    localStorage.setItem('wa_last_seen', String(Date.now()));
    localStorage.setItem('wa_has_played', '1');
    localStorage.setItem('taw.seenWinsHint', '1');
  } catch {}
};

async function frames(page, ms, typeBurst) {
  return await page.evaluate(
    ([dur, burst]) =>
      new Promise((res) => {
        let ki = null;
        if (burst) {
          const keys = 'abcdefghijklmnopqrstuvwxyz'.split('');
          let i = 0;
          ki = setInterval(() => {
            const k = keys[i++ % keys.length];
            const el = document.activeElement || document.body;
            el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
          }, 100);
        }
        const d = [];
        let last = performance.now();
        const start = last;
        function tick(now) {
          d.push(now - last);
          last = now;
          if (now - start < dur) requestAnimationFrame(tick);
          else {
            if (ki) clearInterval(ki);
            d.shift();
            const s = d.slice().sort((a, b) => a - b);
            res({
              median: +s[Math.floor(s.length * 0.5)].toFixed(2),
              p95: +s[Math.floor(s.length * 0.95)].toFixed(2),
              long50: d.filter((x) => x > 50).length,
              frames: d.length,
            });
          }
        }
        requestAnimationFrame(tick);
      }),
    [ms, !!typeBurst]
  );
}
async function inf(page) {
  return await page.evaluate(
    () =>
      document.getAnimations().filter((a) => {
        try {
          return a.effect && a.effect.getTiming().iterations === Infinity && a.playState === 'running';
        } catch {
          return false;
        }
      }).length
  );
}
async function clickText(page, re, timeout = 8000) {
  const btn = page.locator('button', { hasText: re }).first();
  await btn.waitFor({ timeout });
  await btn.click();
}

async function ctxPage(browser, rate) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const client = await ctx.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate });
  return { ctx, page };
}

async function sat(browser, rate) {
  const { ctx, page } = await ctxPage(browser, rate);
  try {
    await page.goto(`${BASE}/?satrush=1`, { waitUntil: 'domcontentloaded' });
    await clickText(page, /^Play$/i, 20000);
    await clickText(page, /LINEUP/i, 8000);
    await page.waitForFunction(() => /WANTED|LIVES/i.test(document.body.innerText), { timeout: 10000 });
    await page.waitForTimeout(800);
    const r = { infiniteRunning: await inf(page), calm: await frames(page, 5000), pressure_typing: await frames(page, 5000, true) };
    return r;
  } catch (e) {
    return { error: String(e.message).slice(0, 150) };
  } finally {
    await ctx.close();
  }
}
async function soloCF(browser, rate, path, marker) {
  const { ctx, page } = await ctxPage(browser, rate);
  try {
    await page.goto(`${BASE}/?${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !/Loading the dictionary/i.test(document.body.innerText), { timeout: 20000 });
    // click a start/play if present
    for (const re of [/^PLAY$/i, /^START$/i, /^BEGIN$/i, /^GO$/i]) {
      const b = page.locator('button', { hasText: re }).first();
      if (await b.count().catch(() => 0)) {
        try {
          await b.click({ timeout: 2000 });
          break;
        } catch {}
      }
    }
    await page.waitForTimeout(1500);
    return { infiniteRunning: await inf(page), calm: await frames(page, 5000), pressure_typing: await frames(page, 5000, true) };
  } catch (e) {
    return { error: String(e.message).slice(0, 150) };
  } finally {
    await ctx.close();
  }
}
async function multiplayer(browser, rate, cardRe, tag) {
  const { ctx, page } = await ctxPage(browser, rate);
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /SHOP/i.test(document.body.innerText) && !/Loading the dictionary/i.test(document.body.innerText), { timeout: 30000 });
    // open the mode dialog by clicking the game card (find by heading text within a card)
    const card = page.locator('[class*="game-card"], [class*="card"]', { hasText: cardRe }).first();
    await card.click({ timeout: 8000 });
    await page.waitForTimeout(500);
    // CREATE ROOM in the dialog
    await clickText(page, /CREATE|SOLO|PLAY/i, 8000);
    // Lobby: enter name if needed, then Continue (button label varies)
    await page.waitForTimeout(1500);
    const nameInput = page.locator('input[type="text"], input:not([type])').first();
    if (await nameInput.count().catch(() => 0)) {
      try {
        await nameInput.fill('PerfBot', { timeout: 2000 });
      } catch {}
    }
    // Continue button (any primary button that isn't BACK)
    const cont = page.locator('button', { hasText: /CONTINUE|CREATE|PLAY|START|LOCK|GO/i }).first();
    if (await cont.count().catch(() => 0)) await cont.click({ timeout: 5000 }).catch(() => {});
    // RoomScreen -> PLAY SOLO (seats a bot + starts)
    await page.waitForTimeout(2500);
    const solo = page.locator('button', { hasText: /PLAY SOLO|ADD BOT|START/i }).first();
    if (await solo.count().catch(() => 0)) await solo.click({ timeout: 6000 }).catch(() => {});
    // wait for the actual game screen (a live timer / input / word grid)
    await page.waitForFunction(
      () => /TYPE A WORD|SECONDS|LIVES|SUBMIT|YOUR TURN|LETTERS|CATEGORY|ROUND/i.test(document.body.innerText),
      { timeout: 25000 }
    );
    await page.waitForTimeout(1500);
    const calm = await frames(page, 5000);
    await page.waitForTimeout(2500); // drift toward later timer / active round
    const pressure = await frames(page, 5000, true);
    return { infiniteRunning: await inf(page), calm, pressure };
  } catch (e) {
    return { error: String(e.message).slice(0, 180), reachedText: await page.evaluate(() => document.body.innerText.slice(0, 120)).catch(() => '') };
  } finally {
    await ctx.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const rate of [1, 4]) {
    const key = `cpu${rate}x`;
    out[key] = {};
    console.error(`\n===== CPU ${rate}x =====`);
    out[key].satPlay = await sat(browser, rate);
    console.error('satPlay', JSON.stringify(out[key].satPlay));
    out[key].chainPlay = await soloCF(browser, rate, 'chain=1', 'CHAIN');
    console.error('chainPlay', JSON.stringify(out[key].chainPlay));
    out[key].fusePlay = await soloCF(browser, rate, 'fuse=1', 'FUSE');
    console.error('fusePlay', JSON.stringify(out[key].fusePlay));
  }
  // Multiplayer (live backend) — 1x only, best-effort.
  out.cpu1x = out.cpu1x || {};
  out.cpu1x.wordBomb = await multiplayer(browser, 1, /WORD\s*BOMB/i, 'wb');
  console.error('wordBomb', JSON.stringify(out.cpu1x.wordBomb));
  out.cpu1x.blitz = await multiplayer(browser, 1, /CATEGORY\s*BLITZ/i, 'blitz');
  console.error('blitz', JSON.stringify(out.cpu1x.blitz));
  await browser.close();
  writeFileSync('perf-games.json', JSON.stringify(out, null, 2));
  console.error('\nWROTE perf-games.json');
})();
