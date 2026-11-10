// ONLY LISTS SCROLL (Andy nov9: "the screen requires scrolling - only scroll inside (such as for the game modes)").
// On a phone the page itself never scrolls: the menu holds still and its mode rows scroll in their own box; the shop and the
// rebirth screen keep their header (back + title + wallet) pinned while the rest scrolls under it.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

const SAVE = {
  'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1', 'taw.rollsOn': '1', 'taw.marksRevealed': '1', 'taw.reveal': 'all',
  'taw.tut.gems': '1', 'taw.tut.power': '1', 'taw.tut.gears': '1', 'taw.tut.rebirth': '1', 'taw.tut.board': '1', 'taw.tut.keyTier': '1', 'taw.tut.init': '1',
  'taw.s2.welcome': JSON.stringify({ st: 'done' }), 'taw.seen.patch': '2026-10-22', 'taw.s2.xp': JSON.stringify({ lv: 60, f: 0.35, rc: 6, v: 10 }), 'taw.s2.rebirths': '6', 'taw.s2.wins': '184250',
  'taw.s2.gems': JSON.stringify({ v: 1, bal: 1840, peak: 60, streak: 3, mig: 1 }),
};

async function open(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await installBackendMock(page);
  await page.addInitScript((s) => { localStorage.removeItem('taw.season2.off'); if (sessionStorage.getItem('pt')) return; sessionStorage.setItem('pt', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SAVE);
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  return { ctx, page };
}

// every box that can scroll right now, and whether the document itself can
const scrollers = (page) => page.evaluate(() => {
  const d = document.documentElement;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (!/(auto|scroll)/.test(cs.overflowY) || el.scrollHeight <= el.clientHeight + 2) continue;
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.getClientRects().length === 0) continue;
    out.push(String(el.className).split(' ')[0]);
  }
  return { doc: d.scrollHeight - innerHeight, list: out };
});

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`menu ${w}x${h}: only the mode rows scroll`, async ({ browser }) => {
    const { ctx, page } = await open(browser, w, h);
    const s = await scrollers(page);
    expect(s.doc).toBeLessThanOrEqual(1);
    expect(s.list.filter((c) => c !== 'hp-m-modes')).toEqual([]);
    // the rail + wallet at the bottom stay on screen
    const rail = await page.locator('.hp-m').evaluate((m) => { const r = m.getBoundingClientRect(); return { bottom: r.bottom, sh: m.scrollHeight, ch: m.clientHeight }; });
    expect(rail.bottom).toBeLessThanOrEqual(h + 1);
    expect(rail.sh).toBeLessThanOrEqual(rail.ch + 1);
    // the mode rows keep a full tap target
    const rowH = await page.locator('.hp-m-modes .hp-m-row').first().evaluate((e) => e.getBoundingClientRect().height);
    expect(rowH).toBeGreaterThanOrEqual(44);
    await ctx.close();
  });

  for (const [name, root, head] of [['shop', '.sp2', '.sp2-head'], ['rebirth', '.rb2', '.rb2-head']]) {
    test(`${name} ${w}x${h}: the header holds still while the page scrolls under it`, async ({ browser }) => {
      const { ctx, page } = await open(browser, w, h);
      await navControl(page, name).first().click();
      await page.locator(root).first().waitFor();
      await page.waitForTimeout(500);
      const s = await scrollers(page);
      expect(s.doc).toBeLessThanOrEqual(1);
      const top0 = await page.locator(head).first().evaluate((e) => e.getBoundingClientRect().top);
      await page.locator(root).first().evaluate((e) => { e.scrollTop = e.scrollHeight; });
      await page.waitForTimeout(200);
      const top1 = await page.locator(head).first().evaluate((e) => e.getBoundingClientRect().top);
      expect(Math.abs(top1 - top0)).toBeLessThanOrEqual(12);
      // the back button is still the thing under its own centre
      const back = await page.locator(`${head} button`).first().evaluate((b) => { const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return b.contains(hit); });
      expect(back).toBe(true);
      await ctx.close();
    });
  }
}
