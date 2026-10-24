// profile-fit.spec.js — Andy oct21: "Why do I need to scroll on my profile screen? I'm on a laptop. You better not have
// to scroll on a Chromebook." A full account (every hero owned, a long bio, hours played) opens PROFILE at laptop and
// Chromebook sizes: the card sits inside the viewport and nothing in it scrolls.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SHOTS = process.env.PF_SHOT_DIR || '';
const VPS = [
  { w: 1536, h: 864, tag: '1536x864' },
  { w: 1366, h: 768, tag: '1366x768' },
  { w: 1280, h: 720, tag: '1280x720' },
  { w: 1536, h: 730, tag: 'laptop-1536x730' }, // a 1536x864 screen once the browser's bars are counted
  { w: 1366, h: 657, tag: 'laptop-1366x657' }, // a 1366x768 screen, same
  { w: 1366, h: 650, tag: 'chromebook-1366x650' },
  { w: 1280, h: 600, tag: 'chromebook-1280x600' },
];
const HEROES = ['glitch', 'hex', 'dud', 'lexi', 'shh', 'sizzle', 'quill', 'jinx', 'salty', 'boo', 'mecha', 'nova', 'riot-elite', 'glitch-elite', 'hype-elite', 'brawl-elite', 'hex-elite'];

async function seed(page) {
  await page.addInitScript((heroes) => {
    if (sessionStorage.getItem('pf.seeded')) return;
    sessionStorage.setItem('pf.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.tut.markRolls', '1');
    localStorage.setItem('taw.rollsOn', '1');
    localStorage.setItem('taw.marksRevealed', '1');
    localStorage.setItem('taw.gems', JSON.stringify({ v: 1, bal: 99999, peak: 12, streak: 0, mig: 1 }));
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0.1, rc: 12, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', '12');
    localStorage.setItem('taw.s2.heroes', JSON.stringify(heroes));
    localStorage.setItem('taw.s2.playsec', String(31 * 3600 + 17 * 60));
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'e2e-pf', username: 'BETTERTHANANDY' }));
    localStorage.setItem('taw.bio', 'typing since the flash days. word bomb main, blitz enjoyer, will out-type you at 3am');
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  }, HEROES);
}

for (const vp of VPS) {
  test(`@${vp.tag} PROFILE fits a full account without scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await installBackendMock(page);
    await seed(page);
    await page.goto('/?portal=1');
    await menuReady(page);
    await page.locator('[data-nav="profile"]:visible').first().click();
    const pf = page.getByTestId('profile-popup');
    await expect(pf).toBeVisible();
    await page.waitForTimeout(450); // the 300 ms pop-in
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/profile-${vp.tag}.png` });
    const r = await pf.evaluate((card) => {
      const box = card.getBoundingClientRect();
      const scrollers = [card, ...card.querySelectorAll('*')]
        .filter((el) => {
          const o = getComputedStyle(el);
          return /(auto|scroll)/.test(o.overflowY) && el.scrollHeight > el.clientHeight + 1;
        })
        .map((el) => `${el.className} ${el.scrollHeight}>${el.clientHeight}`);
      return { top: box.top, bottom: box.bottom, vh: innerHeight, scrollers };
    });
    expect(r.scrollers, `scrolls at ${vp.tag}`).toEqual([]);
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.bottom).toBeLessThanOrEqual(r.vh);
  });
}
