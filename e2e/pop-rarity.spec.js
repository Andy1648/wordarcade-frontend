// e2e/pop-rarity.spec.js — nov2 design audit #15. POP STYLES wear their tier: CLASSIC plain, CHROME–VOID rare, PRISM–FROST
// epic, GOLD–ECLIPSE legendary (+ LEGEND): the frame's line colour, the painted backplate under RARE / EPIC swatches, the
// gold-set gem on EPIC and up — the gem inside its card's corner and off the name, nothing on the price. And a locked
// (hidden) title in TITLES is a silhouette of its real plate with an outline, never a flat black blob. 1366 / 1920 / 390.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SHOTS = process.env.SHOTS;
async function boot(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('pr.seeded')) return;
    sessionStorage.setItem('pr.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0, rc: 1, v: 10 }));
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 400, mig: 1 }));
  });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
}

for (const [w, h] of [[1366, 768], [1920, 1080], [390, 844]]) {
  test(`${w}x${h}: pop styles wear their tier frame, plate and gem — the gem off the words`, async ({ page }) => {
    await boot(page, w, h);
    await page.locator('[data-nav="profile"]:visible').first().click();
    await page.getByTestId('profile-kit').click();
    await page.locator('.cz-tab[data-cz="pop"]').click();
    await page.locator('.sp2-look[data-look="eclipse"]').waitFor();
    await page.waitForTimeout(500);
    const tiers = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.sp2-look')].map((c) => [c.dataset.look, c.dataset.tier])));
    expect(tiers.classic).toBe('common');
    for (const id of ['chrome', 'inferno', 'void']) expect(tiers[id]).toBe('rare');
    for (const id of ['prism', 'toxic', 'ember', 'frost']) expect(tiers[id]).toBe('epic');
    for (const id of ['gold', 'plasma', 'nova', 'eclipse']) expect(tiers[id]).toBe('legendary');
    const bad = await page.evaluate(() => {
      const out = [];
      const glyphs = (el) => { if (!el) return null; const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
      const hit = (a, b) => a && b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
      for (const c of document.querySelectorAll('.sp2-look')) {
        const gem = c.querySelector('.sp2-look-gem');
        const t = c.dataset.tier;
        if (['epic', 'legendary', 'legend'].includes(t) !== !!gem) out.push(`${c.dataset.look}: gem ${gem ? 'on a ' + t : 'missing on a ' + t}`);
        for (const s of ['.sp2-look-name', '.sp2-look-xp', '.sp2-look-act']) if (hit(gem && gem.getBoundingClientRect(), s === '.sp2-look-act' ? c.querySelector(s)?.getBoundingClientRect() : glyphs(c.querySelector(s)))) out.push(`${c.dataset.look}: gem on ${s}`);
      }
      return out;
    });
    expect(bad, bad.join('\n')).toEqual([]);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/pop-rarity-${w}.png` });
  });
}

test('a locked title is an outlined silhouette of its plate, not a black blob', async ({ page }) => {
  await boot(page, 1366, 768);
  await page.locator('[data-nav="profile"]:visible').first().click();
  await page.getByTestId('profile-title').click();
  const hidden = page.locator('.rl-item.is-hidden .krp-art').first();
  await hidden.waitFor();
  const f = await hidden.evaluate((el) => getComputedStyle(el).filter);
  expect(f).toContain('brightness(0)');
  expect((f.match(/drop-shadow/g) || []).length, 'an outline round the silhouette').toBeGreaterThanOrEqual(4);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/titles-locked.png` });
});
