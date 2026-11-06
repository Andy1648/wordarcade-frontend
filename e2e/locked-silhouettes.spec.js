// e2e/locked-silhouettes.spec.js — design research move 20 (nov2): what you DON'T own yet reads as a tease, never a blank
// box — in the hero collection (CUSTOMIZE → HERO) every locked hero is a dark SILHOUETTE of its REAL art wearing a lock chip.
// Locked GEARS keep showing their design (Andy oct11 "show the design for all the cards", marks.spec). LOCK_SHOTS=<dir> saves screenshots.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

const SHOTS = process.env.LOCK_SHOTS || '';
const OWNED_MARKS = ['mk-detonator', 'mk-scholar', 'mk-tinder', 'mk-brainstorm', 'mk-thunderclap'];

async function boot(page, vp) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  const marks = Object.fromEntries(OWNED_MARKS.map((id, i) => [id, { n: 1, first: 1 + i }]));
  await page.addInitScript(({ patch, marks }) => {
    if (sessionStorage.getItem('ls.seeded')) return;
    sessionStorage.setItem('ls.seeded', '1');
    for (const [k, v] of Object.entries({
      'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seen.patch': patch, 'taw.main': 'riot', 'taw.s2.heroes.gf': '1',
      'taw.tut.markRolls': '1', 'taw.marksRevealed': '1',
      'taw.markRolls': JSON.stringify({ v: 3, rolls: 40, sinceEpic: 0, sinceLegendary: 0, everEpic: true, starter: true, marks, milestones: [] }),
      'taw.mark': 'mk-detonator',
    })) localStorage.setItem(k, v);
  }, { patch: PATCH_ID, marks });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
}

/** Every locked item under `root`: is its real art drawn as a dark silhouette, and does it wear a lock chip? */
function lockedReport(page, itemSel, artSel, chipSel) {
  return page.evaluate(({ itemSel, artSel, chipSel }) => [...document.querySelectorAll(itemSel)].map((el) => {
    const art = el.querySelector(artSel);
    const f = art ? getComputedStyle(art).filter : 'none';
    const chip = el.querySelector(chipSel);
    const cb = chip ? chip.getBoundingClientRect() : null;
    return {
      id: el.dataset.hero || el.dataset.mark || el.getAttribute('aria-label') || '?',
      art: !!art && (art.tagName === 'IMG' ? !!art.getAttribute('src') : true),
      dark: (() => { const m = /brightness\(([\d.]+)\)/.exec(f); return !!m && Number(m[1]) <= 0.4; })(),
      chip: !!(cb && cb.width >= 16 && cb.height >= 16),
    };
  }), { itemSel, artSel, chipSel });
}

for (const [vn, vp] of [['1366', { width: 1366, height: 768 }], ['1920', { width: 1920, height: 1080 }], ['390', { width: 390, height: 844 }]]) {
  test(`@${vn} the hero collection: every hero you don't own is its silhouette + a lock chip`, async ({ page }) => {
    await boot(page, vp);
    await page.locator('[data-nav="profile"]:visible').first().click();
    await page.getByTestId('profile-kit').click(); // CUSTOMIZE opens on its HERO tab
    await expect(page.locator('.hc').first()).toBeVisible();
    await page.waitForTimeout(800);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/heroes-${vn}.png` });
    const rows = await lockedReport(page, '.hc.is-dim, .hc.is-locked', '.hc-hero', '.hc-lock');
    expect(rows.length, 'a fresh save has heroes it does not own').toBeGreaterThan(3);
    expect(rows.filter((r) => !(r.art && r.dark && r.chip))).toEqual([]);
  });

}
