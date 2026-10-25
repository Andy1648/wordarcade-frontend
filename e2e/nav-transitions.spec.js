// e2e/nav-transitions.spec.js — the pooled nav wipe on every MAJOR door (Andy oct24 "transition screens for all
// buttons (or at least major ones)"). Pins the CLAUDE.md law: the screen is CORRECT IMMEDIATELY while the wipe is
// still mid-play (the wipe never gates/delays the view), there is exactly ONE overlay node and it is the same
// node across every navigation (pooled, never re-created), it carries will-change only while playing, and REDUCE
// MOTION never plays it. LOOK = the ORIGINAL pre-#514 wipe (one full-screen panel, 240ms) — the cover peak must
// cover every edge of the viewport at every size. Frame shots: SHOTS=1 writes claude/shots-transitions-orig/.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

const SHOTS = !!process.env.SHOTS;
const OUT = 'claude/shots-transitions-orig';
if (SHOTS) fs.mkdirSync(OUT, { recursive: true });

async function openMenu(page, { reduce = false } = {}) {
  await installBackendMock(page, { seedReduceMotion: false });
  if (SHOTS) await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.continue());
  // a save past LV10 so every door (GEARS included) is open
  await page.addInitScript(() => {
    if (sessionStorage.getItem('nt.seeded')) return;
    sessionStorage.setItem('nt.seeded', '1');
    for (const [k, v] of Object.entries({
      'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1',
      'taw.xp': JSON.stringify({ lv: 20, into: 0 }),
    })) localStorage.setItem(k, v);
  });
  if (reduce) await page.addInitScript(() => localStorage.setItem('taw.reduceMotion', '1'));
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.waitForTimeout(900); // arrival wipe + first-paint pops settle; the coalesce window clears
  // tag the pooled node so a re-created one would be caught
  await page.evaluate(() => { document.querySelector('.transition-overlay').dataset.e2ePool = 'original'; });
}

const overlayState = (page) => page.evaluate(() => {
  const all = document.querySelectorAll('.transition-overlay');
  const o = all[0];
  return {
    count: all.length,
    pooled: o?.dataset.e2ePool === 'original',
    state: o?.dataset.state,
    word: o?.querySelector('.transition-word')?.textContent,
    willChange: o?.querySelector('.transition-panel')?.style.willChange || '',
  };
});

// Arm an observer that snapshots the page AT THE INSTANT the wipe starts playing.
const armWipeProbe = (page, freeze) => page.evaluate((freeze) => {
  const o = document.querySelector('.transition-overlay');
  window.__wipeAtStart = null;
  const mo = new MutationObserver(() => {
    if (o.dataset.state === 'play' && !window.__wipeAtStart) {
      window.__wipeAtStart = { menuStillUp: !!document.querySelector('.homepage-logo, .hp-m-title'), word: o.querySelector('.transition-word').textContent };
      if (freeze) o.getAnimations({ subtree: true }).forEach((a) => a.pause()); // frame shots step it by hand
      mo.disconnect();
    }
  });
  mo.observe(o, { attributes: true, attributeFilter: ['data-state'] });
}, freeze);

async function door(page, which, screenSel, label, { sheet = false } = {}) {
  await page.waitForTimeout(950); // outside the coalesce window
  // a menu MOMENT (e.g. the phone's TAPED / NEW FRAME sticker) holds the menu's taps while it plays: re-tap until
  // the door opens (each try re-arms the probe)
  for (let i = 0; i < 8; i += 1) {
    await armWipeProbe(page, SHOTS && !!label);
    await navControl(page, which).locator('visible=true').first().click();
    const opened = await page.waitForFunction(() => window.__wipeAtStart, null, { timeout: 900 }).then(() => true, () => false);
    if (opened) break;
  }
  await expect.poll(() => page.evaluate(() => window.__wipeAtStart), { timeout: 2000 }).not.toBeNull();
  const at = await page.evaluate(() => window.__wipeAtStart);
  // a VIEW door: the menu is already gone when the wipe starts — the wipe never gates/delays the swap
  if (!sheet) expect(at.menuStillUp).toBe(false);
  if (SHOTS && label) {
    // FRAME SHOTS: freeze the wipe and step it through its timeline
    for (const t of [30, 70, 108, 150, 200]) { // 108 = the cover peak (0.45 × 240)
      await page.evaluate((ms) => document.querySelector('.transition-overlay').getAnimations({ subtree: true }).forEach((a) => { a.currentTime = ms; }), t);
      await page.screenshot({ path: `${OUT}/${label}-${String(t).padStart(3, '0')}ms.png` });
    }
    await page.evaluate(() => document.querySelector('.transition-overlay').getAnimations({ subtree: true }).forEach((a) => a.play()));
  }
  const mid = await overlayState(page);
  expect(mid.count).toBe(1);
  expect(mid.pooled).toBe(true);
  await expect(page.locator(screenSel).first()).toBeVisible({ timeout: 4000 });
  if (SHOTS && label) { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${label}-after.png` }); }
  await page.waitForTimeout(450);
  const after = await overlayState(page);
  expect(after.state).toBe('idle');
  expect(after.willChange).toBe('');
  return at;
}

test('every major door wipes over an already-correct screen, through ONE pooled node', async ({ page }, info) => {
  await openMenu(page);
  const rest = await overlayState(page);
  expect(rest.count).toBe(1);
  expect(rest.state).toBe('idle');
  expect(rest.willChange).toBe(''); // never on an idle node

  const tag = info.project.name.replace(/\W+/g, '-');
  const shop = await door(page, 'shop', '.shop-panel', `${tag}-shop`);
  expect(shop.word).toBe(await page.locator('.shop-title').innerText()); // the word names the screen it lands on (UPGRADES)
  await page.keyboard.press('Escape');
  await menuReady(page);

  const board = await door(page, 'leaderboard', '.lb-panel', `${tag}-board`);
  expect(board.word).toBe(await page.locator('.lb-title').innerText()); // LEADERBOARD
  await page.keyboard.press('Escape');
  await menuReady(page);

  // a menu SHEET (not a view): GEARS opens the ROLL screen under the same node
  const gears = navControl(page, 'gears').first();
  if (await gears.isVisible()) {
    const g = await door(page, 'gears', '.marks-overlay', `${tag}-gears`, { sheet: true });
    expect(g.word).toBe('ROLL'); // the ROLL screen's own title (.rs-title)
  }
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('the wipe covers a tall screen', async ({ page }) => {
    await openMenu(page);
    const s = await door(page, 'shop', '.shop-panel', 'phone-shop');
    expect(s.word).toBe(await page.locator('.shop-title').innerText());
  });
});

test('REDUCE MOTION: the wipe never plays, the screen still swaps', async ({ page }) => {
  await openMenu(page, { reduce: true });
  await page.waitForTimeout(950);
  await navControl(page, 'shop').first().click();
  await page.waitForTimeout(60);
  const s = await overlayState(page);
  expect(s.state).not.toBe('play');
  expect(await page.locator('.transition-overlay').evaluate((el) => getComputedStyle(el).display)).toBe('none');
});

// EDGE-TO-EDGE: freeze the wipe at its cover peak and measure the panel against the viewport — no gap on any edge.
for (const [w, h] of [[360, 640], [390, 844], [1366, 768], [1920, 1080], [2560, 1440]]) {
  test(`the cover peak covers every edge at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openMenu(page);
    await page.waitForTimeout(950);
    await armWipeProbe(page, true);
    for (let i = 0; i < 8; i += 1) {
      await navControl(page, 'shop').locator('visible=true').first().click();
      if (await page.waitForFunction(() => window.__wipeAtStart, null, { timeout: 900 }).then(() => true, () => false)) break;
      await page.waitForTimeout(950);
      await armWipeProbe(page, true);
    }
    const r = await page.evaluate(() => {
      const o = document.querySelector('.transition-overlay');
      o.getAnimations({ subtree: true }).forEach((a) => { a.currentTime = 0.45 * a.effect.getTiming().duration; });
      const b = o.querySelector('.transition-panel').getBoundingClientRect();
      const out = { left: b.left, top: b.top, right: b.right, bottom: b.bottom, vw: innerWidth, vh: innerHeight, vis: getComputedStyle(o).visibility };
      o.getAnimations({ subtree: true }).forEach((a) => a.play());
      return out;
    });
    expect(r.vis).toBe('visible');
    expect(r.left).toBeLessThanOrEqual(0);
    expect(r.top).toBeLessThanOrEqual(0);
    expect(r.right).toBeGreaterThanOrEqual(r.vw);
    expect(r.bottom).toBeGreaterThanOrEqual(r.vh);
  });
}
