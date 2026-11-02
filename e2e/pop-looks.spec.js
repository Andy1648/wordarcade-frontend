// e2e/pop-looks.spec.js — Andy oct19: "the looks dont seem to do anything at all". The equipped POP STYLE now dresses the
// menu's +N XP pops (popLooks.js): its fill, coloured outline and hard shadow; CLASSIC keeps the old dress; equipping in
// the shop re-dresses the open menu without a reload. (Shards skip under REDUCE MOTION — the e2e default — so the
// colour / outline / shadow on the pooled pop node is what is asserted.)
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SHOTS = process.env.LOOK_SHOTS; // a folder → one screenshot per look (not part of the gate)

async function menuWith(page, popStyle) {
  await installBackendMock(page);
  await page.addInitScript((popStyle) => {
    if (sessionStorage.getItem('looks.seeded')) return;
    sessionStorage.setItem('looks.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    if (popStyle) localStorage.setItem('taw.equipped', JSON.stringify({ popStyle, soundPack: 'thock' }));
  }, popStyle);
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.waitForTimeout(800);
}

/** Type until a +N pop is up; return the computed dress of the newest visible one. */
async function popDress(page, kit = false) {
  let dress = null;
  await expect.poll(async () => {
    await page.keyboard.type('qwer', { delay: 90 });
    dress = await page.evaluate((kit) => {
      // kit: only a pop dressed by the worn look (the look's data loads at idle — a pop typed before it is plain)
      const els = [...document.querySelectorAll('.menu-xp-pop.is-tap .menu-xp-pop-plus')].filter((e) => /XP/.test(e.textContent) && (kit ? e.classList.contains('is-kit') : (e.style.color || e.classList.contains('is-kit'))));
      const e = els[els.length - 1];
      if (!e) return null;
      const c = getComputedStyle(e);
      const art = e.parentElement.querySelector('.menu-xp-pop-art');
      return { color: c.color, stroke: c.webkitTextStrokeColor, shadow: c.textShadow, chip: e.classList.contains('is-kit') ? e.style.backgroundImage : null, art: art && art.style.display === 'block' ? art.getAttribute('src') : null };
    }, kit);
    return !!dress;
  }, { timeout: 10_000 }).toBe(true);
  return dress;
}

// oct25: a paid look throws its painted BURST behind the pop (the look's colour lives in the art). oct27 (THE KIT): the
// number sits on a chip of the look's own painted texture, in white with a black outline (it reads on any burst).
test('INFERNO: the menu +N pops throw the inferno burst, the number white on an inferno-texture chip', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await menuWith(page, 'inferno');
  const d = await popDress(page, true);
  expect(d.art).toContain('burst-inferno');
  expect(d.color).toBe('rgb(255, 255, 255)');
  expect(d.stroke).toBe('rgb(0, 0, 0)');
  expect(d.chip).toContain('bar-inferno');
});

test('CLASSIC keeps the old dress (black outline, no look shadow)', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await menuWith(page, null);
  const d = await popDress(page);
  expect(d.stroke).toBe('rgb(0, 0, 0)');
  expect(d.shadow).not.toContain('3px 3px 0px');
  expect(d.art).toBeNull();
});

test('equipping a look while the menu is open re-dresses the next pop (no reload)', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await menuWith(page, null);
  await popDress(page);
  // the shop's equip path is shop.saveEquipped → EQUIP_CHANGE; drive it the same way
  await page.evaluate(() => {
    localStorage.setItem('taw.equipped', JSON.stringify({ popStyle: 'toxic', soundPack: 'thock' }));
    window.dispatchEvent(new Event('taw:equip-change'));
  });
  await page.waitForTimeout(1500); // let the classic pops finish
  const d = await popDress(page, true);
  expect(d.art).toContain('burst-toxic');
});

if (SHOTS) {
  test.describe(() => {
    test.use({ reducedMotion: 'no-preference' });
    for (const id of ['classic', 'chrome', 'inferno', 'void', 'prism', 'toxic', 'ember', 'frost', 'gold', 'plasma', 'nova', 'eclipse', 'legend']) {
      test(`shot ${id}`, async ({ page }) => {
        await page.setViewportSize({ width: 1366, height: 768 });
        await menuWith(page, id === 'classic' ? null : id);
        await page.keyboard.type('a', { delay: 70 });
        await page.waitForTimeout(60);
        const b = await page.evaluate(() => {
          const e = [...document.querySelectorAll('.menu-xp-pop.is-tap')].filter((x) => /XP/.test(x.textContent)).pop();
          // freeze the pop (and its shards) at its readable hold — a still for the record, not app behaviour
          for (const a of document.getAnimations()) { const d = a.effect.getTiming().duration; if (typeof d === 'number') { a.pause(); a.currentTime = d * 0.3; } }
          const r = e.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        await page.screenshot({ path: `${SHOTS}/look-${id}.png`, clip: { x: Math.max(0, b.x - 110), y: Math.max(0, b.y - 60), width: 220, height: 120 } });
      });
    }
  });
}
