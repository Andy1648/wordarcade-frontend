// e2e/gear2-fit.spec.js — TWO GEARS ALWAYS FIT (Andy oct21: "the second gear is still getting pushed off the screen just a
// bit … on this gear"). With both gear slots worn (season 2, R5+), the menu's two full slots must stay inside the frame
// whatever is worn: the WORST combos are the gears whose stat unit wraps ("+5,600% WINS IN WORD BOMB") or that carry four
// substat lines (ORIGIN), in either slot. Before the fix two mythics ran 6px off a 1280x720 screen and onto the frame at
// 1366x768. Real Bungee (the fallback font is narrower and hides overflow); every gear owned via the roll save / the
// earned + unlisted stores.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const OWN = ['mk-hydra', 'mk-origin', 'mk-chronos', 'mk-singularity', 'mk-kraken', 'mk-monsoon', 'mk-headmaster', 'mk-blaze', 'mk-ul-og'];
const COMBOS = [['mk-hydra', 'mk-origin'], ['mk-origin', 'mk-hydra'], ['mk-singularity', 'mk-monsoon'], ['mk-headmaster', 'mk-ul-og']];
const SIZES = [[1280, 720], [1366, 768], [1366, 657], [1280, 551], [1440, 900], [1536, 864], [1600, 900], [1920, 1080], [390, 844], [360, 640]];
const FRAME = 16; // the drawn menu frame a slot must clear

for (const [w, h] of SIZES) {
  test(`both gear slots fit at ${w}x${h}, worst-case gears in either slot`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.continue());
    const marks = {};
    OWN.forEach((id, i) => { marks[id] = { n: 99, first: 1 + i }; });
    for (const [one, two] of COMBOS) {
      await page.addInitScript(({ one, two, marks }) => {
        localStorage.clear();
        for (const [k, v] of Object.entries({
          'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1', 'taw.rollsOn': '1', 'taw.marksRevealed': '1',
          'taw.xp': JSON.stringify({ lv: 60, into: 0 }), 'taw.s2.xp': JSON.stringify({ lv: 60, f: 0, rc: 9, v: 10 }), 'taw.s2.rebirths': '9',
          'taw.markRolls': JSON.stringify({ v: 3, rolls: 999, sinceEpic: 0, sinceLegendary: 0, everEpic: true, starter: true, marks, milestones: [] }),
          'taw.permanentMarks': JSON.stringify(Object.keys(marks)),
          'taw.unlisted': JSON.stringify({ owned: { 'mk-ul-og': 1 } }),
          'taw.mark': one, 'taw.s2.mark2': two,
        })) localStorage.setItem(k, v);
      }, { one, two, marks });
      await page.goto('/?portal=1&season2=1');
      await menuReady(page);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.fonts.check('24px Bungee')), 'Bungee loaded').toBe(true);
      await page.waitForTimeout(500);
      const r = await page.evaluate((FRAME) => {
        const out = [];
        const stage = document.querySelector('.homepage-stage');
        const sb = stage ? stage.getBoundingClientRect() : { bottom: innerHeight };
        const floor = Math.min(sb.bottom, innerHeight);
        const phone = innerWidth <= 480;
        const slots = [...document.querySelectorAll('.menu-mark, .menu-mark2')].filter((e) => e.getBoundingClientRect().width > 0);
        for (const el of slots) {
          const b = el.getBoundingClientRect();
          let bottom = b.bottom, right = b.right;
          for (const d of el.querySelectorAll('*')) {
            if (d.closest('.gfx')) continue; // the rarity aura glows past the slot by design
            const q = d.getBoundingClientRect();
            if (!q.width || !q.height) continue;
            bottom = Math.max(bottom, q.bottom); right = Math.max(right, q.right);
          }
          const name = (el.getAttribute('aria-label') || '').slice(0, 30);
          // the desktop rail must clear the frame; the phone menu scrolls, so its chips need only stay on the screen's width
          if (!phone && bottom > floor - FRAME + 0.5) out.push(`${name}: bottom ${Math.round(bottom)} past ${Math.round(floor - FRAME)}`);
          if (right > innerWidth - (phone ? 0 : FRAME) + 0.5) out.push(`${name}: right ${Math.round(right)} past ${innerWidth}`);
          if (right > b.right + 1) out.push(`${name}: content spills past its slot (${Math.round(right - b.right)}px)`);
        }
        return { out, n: slots.length };
      }, FRAME);
      expect(r.n, `both slots rendered (${one} + ${two})`).toBe(2);
      expect(r.out, `${one} + ${two} at ${w}x${h}`).toEqual([]);
    }
  });
}
