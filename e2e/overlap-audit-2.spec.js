// e2e/overlap-audit-2.spec.js — three defects from OVERLAP AUDIT #2 (2026-11-02, live prod, season 2), each pinned at
// the sizes it failed at:
//   #5  the first-roll tip ("TAP ROLL — YOUR FIRST GEAR IS FREE.") lay over the FOUND chips at 1366 / 1920 and over the
//       EPIC+ pity read-out on a phone. It now sits in the band between the reel and ROLL, sized to fit it, and the
//       stage's showcase (FOUND / THE CHASE) steps out while the tip is up: nothing it lands on is readable text.
//   #6  the MINER dialog on a phone: the lower block was squeezed and its title rode up over the SOLO/MULTI chip.
//   #7  the SAT RUSH briefing at 360x640: the corner settings cog sat on START THE RUN. The page now stops above the
//       cog's corner on a narrow screen, so no tap meant for the page can open settings.
// Every check is plain geometry (rects), so it holds with the gate's fallback fonts AND the real Bungee / Space Mono
// (SHOT_FONTS=1); the gate runs the fallback, where the old layouts already failed every one of them.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, revealMode, satSetupGo } from './support/menu.js';

const SHOTS = process.env.AUDIT_SHOTS || '';

// the audit's LV60 R6 season-2 regular, with every menu tutorial already seen
const REGULAR = {
  'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1',
  'taw.tut.markRolls': '1', 'taw.rollsOn': '1', 'taw.marksRevealed': '1',
  'taw.tut.gems': '1', 'taw.tut.power': '1', 'taw.tut.gears': '1', 'taw.tut.rebirth': '1', 'taw.tut.board': '1', 'taw.tut.keyTier': '1', 'taw.tut.init': '1',
  'taw.s2.welcome': JSON.stringify({ st: 'done' }), 'taw.seen.patch': '2026-10-22',
  'taw.s2.xp': JSON.stringify({ lv: 60, f: 0.35, rc: 6, v: 10 }), 'taw.s2.rebirths': '6', 'taw.s2.wins': '184250',
  'taw.s2.gems': JSON.stringify({ v: 1, bal: 1840, peak: 60, streak: 3, mig: 1 }),
};

// a FRESH save (no gear found: every FOUND chip 0/N) whose menu spotlights / welcome / patch notes are already behind it,
// so nothing on the menu takes the tap that opens the ROLL screen — the ROLL screen's own first-roll tip is still due
const FRESH = {
  'taw.tut.gems': '1', 'taw.tut.power': '1', 'taw.tut.gears': '1', 'taw.tut.rebirth': '1', 'taw.tut.board': '1', 'taw.tut.keyTier': '1', 'taw.tut.init': '1',
  'taw.s2.welcome': JSON.stringify({ st: 'done' }), 'taw.seen.patch': '2026-10-22',
};

/** Season 2 (what visitors get) with `seed` written once; `{}` is a fresh save. */
async function boot(page, seed) {
  await installBackendMock(page);
  await page.addInitScript((s) => {
    localStorage.removeItem('taw.season2.off');
    if (sessionStorage.getItem('oa2.seeded')) return;
    sessionStorage.setItem('oa2.seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, seed);
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
}
const box = (page, sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
const hit = (a, b, tol = 0) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > tol && Math.min(a.b, b.b) - Math.max(a.t, b.t) > tol;

// ---- #5 the first-roll tip -------------------------------------------------------------------------------------------
for (const [w, h] of [[1366, 768], [1920, 1080], [390, 844]]) {
  test(`#5 @${w}x${h} fresh save: the first-roll tip covers no text on the ROLL screen`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page, FRESH);
    await page.locator('.hp-nav.is-gears:visible').first().click();
    await page.locator('.rs-overlay').waitFor();
    const line = page.locator('.ut-overlay[data-tut="markRolls"] .ut-line');
    await expect(line).toBeVisible();
    await page.waitForTimeout(500); // the 240 ms fade + the one-time fit
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/roll-tip-${w}x${h}.png` });
    // every readable thing on the ROLL screen (text runs + controls) that the tip's plate lands on
    const covered = await page.evaluate(() => {
      const L = document.querySelector('.ut-line').getBoundingClientRect();
      const out = [];
      const seen = (el) => { for (let a = el; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) < 0.05) return false; } return true; };
      const w = document.createTreeWalker(document.querySelector('.rs-overlay'), NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.nodeValue.trim() || !seen(n.parentElement)) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const r of rg.getClientRects()) {
          const x = Math.min(r.right, L.right) - Math.max(r.left, L.left), y = Math.min(r.bottom, L.bottom) - Math.max(r.top, L.top);
          if (r.width > 1 && x > 1 && y > 1) { out.push(`${n.parentElement.className} "${n.nodeValue.trim().slice(0, 20)}"`); break; }
        }
      }
      return [...new Set(out)];
    });
    expect(covered, 'text under the tip').toEqual([]);
    const L = await box(page, '.ut-line');
    expect(L.t, 'tip inside the screen (top)').toBeGreaterThanOrEqual(0);
    expect(L.b, 'tip inside the screen (bottom)').toBeLessThanOrEqual(h);
    expect(hit(L, await box(page, '.ut-ring')), 'the tip never sits on the lit ROLL ring').toBe(false);
    expect(await line.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)), 'tip text ≥ 16px').toBeGreaterThanOrEqual(16);
    // a tap anywhere still finishes it, and the showcase comes back
    await page.locator('.ut-overlay').click({ position: { x: 8, y: 8 } });
    await expect(page.locator('.ut-overlay')).toHaveCount(0);
    if (w >= 900 && h >= 760) await expect(page.locator('.rsx-coll')).toBeVisible();
  });
}

// ---- #6 MINER dialog chip vs title ----------------------------------------------------------------------------------
test.describe('phone (touch)', () => {
  test.use({ isMobile: true, hasTouch: true });
  for (const [w, h] of [[390, 844], [360, 640]]) {
    test(`#6 @${w}x${h} MINER dialog: the SOLO/MULTI chip and the MINER title never overlap`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await boot(page, REGULAR);
      await (await revealMode(page, 'miner')).click({ force: true });
      await page.locator('.mode-dialog-shell .mode-ex').waitFor();
      await page.waitForTimeout(500);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/miner-dialog-${w}x${h}.png` });
      const chip = await box(page, '.mode-dialog-chip');
      // the title BLOCK (its line box; the inline word's content area reaches a few px above the caps — no ink there)
      for (const sel of ['.mode-dialog-title', '.mode-dialog-liner']) {
        const t = await box(page, sel);
        expect(t.t, `${sel} starts below the chip (chip bottom ${chip.b}, ${sel} top ${t.t})`).toBeGreaterThanOrEqual(chip.b);
      }
      // ...and the chip is what is drawn at its own centre and along its lower edge (the title used to sit on top)
      const onChip = await page.evaluate(() => {
        const c = document.querySelector('.mode-dialog-chip'); const r = c.getBoundingClientRect();
        return [[0.5, 0.5], [0.2, 0.8], [0.5, 0.8], [0.8, 0.8]].every(([fx, fy]) => { const t = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); return !!t && (t === c || c.contains(t)); });
      });
      expect(onChip, 'nothing is drawn over the SOLO/MULTI chip').toBe(true);
      // the chip is a 16px label and the CTA row stays reachable (44px)
      expect(await page.locator('.mode-dialog-chip').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
      for (const b of await page.locator('.mode-dialog-actions button').all()) {
        await b.scrollIntoViewIfNeeded();
        const r = await b.boundingBox();
        expect(Math.min(r.width, r.height)).toBeGreaterThanOrEqual(44);
      }
    });

    // ---- #7 SAT briefing vs the corner cog --------------------------------------------------------------------------
    test(`#7 @${w}x${h} SAT RUSH briefing: the settings cog is clear of the page and START THE RUN`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await boot(page, REGULAR);
      await (await revealMode(page, 'sat-rush')).click();
      await page.getByRole('button', { name: /BRIEFING/ }).click();
      await satSetupGo(page);
      await expect(page.locator('.sr-brief-page')).toBeVisible();
      await page.waitForTimeout(400);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/sat-briefing-${w}x${h}.png` });
      const cog = await box(page, '.audio-btn');
      const start = page.locator('.sr-brief-actions .sr-btn');
      expect(hit(cog, await box(page, '.sr-brief-actions .sr-btn')), 'cog over START THE RUN').toBe(false);
      expect(hit(cog, await box(page, '.sr-brief-page')), 'cog over the briefing page').toBe(false);
      // a tap on START's right edge lands on START (it used to open settings)
      const s = await start.boundingBox();
      const onStart = await page.evaluate(([x, y]) => { const t = document.elementFromPoint(x, y); return !!t && !!t.closest('.sr-brief-actions .sr-btn'); }, [s.x + s.width - 3, s.y + s.height - 3]);
      expect(onStart, 'START THE RUN owns its bottom-right corner').toBe(true);
      expect(Math.min(s.width, s.height)).toBeGreaterThanOrEqual(44);
      // the cog is still a 44px target on screen, and the page still shows its head + a card + START
      expect(Math.min(cog.r - cog.l, cog.b - cog.t)).toBeGreaterThanOrEqual(44);
      expect(cog.b).toBeLessThanOrEqual(h);
      await expect(page.locator('.sr-brief-title')).toBeInViewport();
      await expect(start).toBeInViewport();
      const list = await box(page, '.sr-brief-list');
      expect(list.b - list.t, 'the word list keeps a usable height').toBeGreaterThanOrEqual(220);
    });
  }
});
