// e2e/hear-sound-packs.spec.js — HEAR BEFORE YOU BUY (oct29 shop functionality): in CUSTOMIZE → SOUND every pack's keycap
// is a button that plays the pack's own click — owned or not, with key clicks OFF — and never buys or equips anything.
// SILENT has nothing to hear (no badge, no sound). Counted on the audio graph (the noise-buffer voices a key click is made of), not by ear.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

async function boot(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  await page.addInitScript(() => {
    // count the noise-buffer voices the page makes: a key click is a filtered noise burst per press (+ its release);
    // the UI's own taps are tones, never a buffer
    window.__clk = 0;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      const make = AC.prototype.createBufferSource;
      AC.prototype.createBufferSource = function patched(...a) { window.__clk += 1; return make.apply(this, a); };
    }
    if (sessionStorage.getItem('hs.seeded')) return;
    sessionStorage.setItem('hs.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0, rc: 1, v: 10 }));
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 0, mig: 1 }));
  });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.locator('[data-nav="profile"]:visible').first().click();
  await page.getByTestId('profile-kit').click();
  await page.locator('.cz-tab[data-cz="sound"]').click();
  await page.locator('.sp2-look[data-look="glass"]').waitFor({ state: 'visible' });
}

for (const [w, h] of [[1366, 768], [390, 844]]) {
  test(`${w}x${h}: tap a keycap → hear that pack (owned or not, clicks off); SILENT has nothing; nothing is bought or worn`, async ({ page }) => {
    await boot(page, w, h);
    const equipped = await page.evaluate(() => localStorage.getItem('taw.equipped'));
    // every pack but SILENT wears the speaker badge, inside its card
    const badges = await page.evaluate(() => [...document.querySelectorAll('.sp2-look')].map((c) => {
      const b = c.querySelector('.sp2-hear-ico');
      if (!b) return { id: c.dataset.look, badge: false };
      const r = b.getBoundingClientRect(); const k = c.getBoundingClientRect();
      return { id: c.dataset.look, badge: true, inside: r.left >= k.left - 1 && r.right <= k.right + 1 && r.top >= k.top - 1 && r.bottom <= k.bottom + 1 };
    }));
    for (const b of badges) {
      if (b.id === 'silent') expect(b.badge, 'SILENT has no speaker').toBe(false);
      else expect(b, `${b.id}: the speaker badge sits inside its card`).toEqual({ id: b.id, badge: true, inside: true });
    }
    // a locked pack (0 gems) plays its riff: three presses, each a noise burst + its release
    const before = await page.evaluate(() => window.__clk);
    await page.getByTestId('hear-glass').click();
    await expect.poll(() => page.evaluate(() => window.__clk), { timeout: 3000 }).toBe(before + 6); // 3 presses × (press + release)
    await page.waitForTimeout(600); // the riff is staggered: nothing more lands after it
    const after = await page.evaluate(() => window.__clk);
    expect(after, 'one riff, no more').toBe(before + 6);
    await page.getByTestId('hear-silent').click();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__clk), 'SILENT plays nothing').toBe(after);
    expect(await page.evaluate(() => localStorage.getItem('taw.equipped')), 'hearing never equips').toBe(equipped);
    await expect(page.locator('.sp2-look[data-look="glass"]')).not.toHaveClass(/is-on|is-owned/);
  });
}
