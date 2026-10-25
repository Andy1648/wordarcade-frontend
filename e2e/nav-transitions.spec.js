// e2e/nav-transitions.spec.js — the pooled nav wipe on every MAJOR door (Andy oct24 "transition screens for all
// buttons (or at least major ones)"). Pins the CLAUDE.md law: the screen is CORRECT IMMEDIATELY while the wipe is
// still mid-play (the wipe never gates/delays the view), there is exactly ONE overlay node and it is the same
// node across every navigation (pooled, never re-created), it carries will-change only while playing, and REDUCE
// MOTION never plays it. Frame shots: SHOTS=1 writes claude/shots-transitions/.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

const SHOTS = !!process.env.SHOTS;
const OUT = 'claude/shots-transitions';
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
    word: o?.querySelector('.tw-word')?.textContent,
    willChange: o?.querySelector('.tw-band')?.style.willChange || '',
  };
});

// Arm an observer that snapshots the page AT THE INSTANT the wipe starts playing.
const armWipeProbe = (page, freeze) => page.evaluate((freeze) => {
  const o = document.querySelector('.transition-overlay');
  window.__wipeAtStart = null;
  const mo = new MutationObserver(() => {
    if (o.dataset.state === 'play' && !window.__wipeAtStart) {
      window.__wipeAtStart = { menuStillUp: !!document.querySelector('.homepage-logo, .hp-m-title'), word: o.querySelector('.tw-word').textContent };
      if (freeze) o.getAnimations({ subtree: true }).forEach((a) => a.pause()); // frame shots step it by hand
      mo.disconnect();
    }
  });
  mo.observe(o, { attributes: true, attributeFilter: ['data-state'] });
}, freeze);

async function door(page, which, screenSel, label, { sheet = false } = {}) {
  await page.waitForTimeout(950); // outside the coalesce window
  await armWipeProbe(page, SHOTS && !!label);
  await navControl(page, which).first().click();
  await expect.poll(() => page.evaluate(() => window.__wipeAtStart), { timeout: 2000 }).not.toBeNull();
  const at = await page.evaluate(() => window.__wipeAtStart);
  // a VIEW door: the menu is already gone when the wipe starts — the wipe never gates/delays the swap
  if (!sheet) expect(at.menuStillUp).toBe(false);
  if (SHOTS && label) {
    // FRAME SHOTS: freeze the wipe and step it through its timeline
    for (const t of [30, 60, 150, 210, 270]) {
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

test('REDUCE MOTION: the wipe never plays, the screen still swaps', async ({ page }) => {
  await openMenu(page, { reduce: true });
  await page.waitForTimeout(950);
  await navControl(page, 'shop').first().click();
  await page.waitForTimeout(60);
  const s = await overlayState(page);
  expect(s.state).not.toBe('play');
  expect(await page.locator('.transition-overlay').evaluate((el) => getComputedStyle(el).display)).toBe('none');
});
