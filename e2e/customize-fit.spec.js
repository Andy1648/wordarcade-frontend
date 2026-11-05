// e2e/customize-fit.spec.js — Andy oct28: "i want all cosmetics to be from profile … be simplistic … unecessarily cramped
// … reduced unecessary stuff". The PROFILE is your hero + ONE CUSTOMIZE button; CUSTOMIZE holds every cosmetic under
// one tab strip; the shop's COSMETICS opens the same menu. The UI checklist, as assertions, at 1366 / 1920 / 390:
//   - zero overlaps between the controls of a view (tabs, buttons, cards),
//   - the main element dominates its panel (the hero on the profile, the cards / the try-on stage in CUSTOMIZE),
//   - nothing runs off the panel sideways, every tap target ≥ 44px.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

async function boot(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('czf.seeded')) return;
    sessionStorage.setItem('czf.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0.1, rc: 3, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', '3');
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 5000, mig: 1 }));
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'e2e-czf', username: 'BETTERTHANANDY' }));
    localStorage.setItem('taw.bio', 'typing since the flash days. word bomb main, blitz enjoyer');
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
}

/** Overlapping pairs among the visible `sel` boxes inside `root` (> 2px each way), and any box past the root's sides. */
const layout = (page, root, sel) => page.evaluate(({ root, sel }) => {
  const R = document.querySelector(root).getBoundingClientRect();
  const els = [...document.querySelectorAll(`${root} ${sel}`)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(e).visibility !== 'hidden'; });
  const box = els.map((e) => ({ e, r: e.getBoundingClientRect() }));
  const overlaps = [];
  for (let i = 0; i < box.length; i += 1) for (let j = i + 1; j < box.length; j += 1) {
    const a = box[i]; const b = box[j];
    if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (x > 2 && y > 2) overlaps.push(`${a.e.className} × ${b.e.className}`);
  }
  const outside = box.filter(({ r }) => r.left < R.left - 1 || r.right > R.right + 1).map(({ e }) => e.className);
  const small = box.filter(({ e, r }) => e.matches('button, [role="tab"]') && (r.height < 43.5 || r.width < 43.5)).map(({ e }) => e.className);
  return { overlaps, outside, small, panel: { w: R.width, h: R.height } };
}, { root, sel });
const sizeOf = (loc) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; });

for (const [w, h] of [[1366, 768], [1920, 1080], [390, 844]]) {
  test(`${w}x${h}: PROFILE is the hero + one CUSTOMIZE; CUSTOMIZE's tabs and pickers never overlap, the content dominates`, async ({ page }) => {
    test.setTimeout(90_000);
    await boot(page, w, h);
    await page.locator('[data-nav="profile"]:visible').first().click();
    const pf = page.getByTestId('profile-popup');
    await pf.waitFor({ state: 'visible' });
    await page.waitForTimeout(450);
    // the profile: one CUSTOMIZE, the hero big
    await expect(pf.locator('.pf-crew, .pf-change, .pf-hero-tag')).toHaveCount(0);
    // the BANNER (nov2 audit #14): three stat medallions, no six-tile dashboard, the name on one line with its plate
    await expect(pf.locator('.pf-medal')).toHaveCount(3);
    await expect(pf.locator('.pf-stat')).toHaveCount(0);
    let m = await layout(page, '.pf', '.pf-head > *, .pf-kit, .pf-medal-disc, .pf-medal-k, .pf-nameline > *, .pc-badge, .pf-left .hs');
    expect(m.overlaps, 'profile overlaps').toEqual([]);
    expect(m.outside, 'profile: nothing past the panel').toEqual([]);
    const hero = await sizeOf(pf.locator('.pf-left .hs'));
    expect(hero.w / m.panel.w, 'the hero dominates the profile').toBeGreaterThan(w < 760 ? 0.55 : 0.3);
    // CUSTOMIZE: five tabs in one strip, each view's controls apart
    await pf.getByTestId('profile-kit').click();
    await expect(pf.getByTestId('customize').getByRole('tab')).toHaveCount(3);
    for (const [t, sel, main] of [
      ['hero', '.hc', '.hc'],
      ['frame', '.skp-tile, .skp-stage, .skp-cta, .skp-act > *', '.skp-stage'],
      ['pop', '.sp2-look', '.sp2-look'],
    ]) {
      await pf.locator(`.cz-tab[data-cz="${t}"]`).click();
      await page.waitForTimeout(400);
      m = await layout(page, '.pf', `.cz-tab, .pf-head > *, ${sel}`);
      expect(m.overlaps, `${t}: overlaps`).toEqual([]);
      expect(m.outside, `${t}: nothing past the panel`).toEqual([]);
      expect(m.small, `${t}: tap targets ≥ 44px`).toEqual([]);
      if (t === 'frame' && w >= 760) {
        // the try-on is not a list: on a desktop it fits whole, the HOLD TO BUY in view, no scroll
        const sc = await page.locator('.cz-body').evaluate((e) => e.scrollHeight - e.clientHeight);
        expect(sc, `${t}: the try-on fits without a scroll`).toBeLessThanOrEqual(1);
      }
      const big = await sizeOf(pf.locator(main).first());
      // the content is the point: a hero card / a look card is a real card, the try-on stage a big share of the panel
      if (main === '.skp-stage') expect(big.w / m.panel.w, `${t}: the try-on stage dominates`).toBeGreaterThan(w < 760 ? 0.5 : 0.28);
      else expect(big.w, `${t}: cards are big enough to read`).toBeGreaterThanOrEqual(w < 760 ? 140 : 150);
    }
  });

  test(`${w}x${h}: the shop's tabs wear their icons, never overlap or leave the row; COSMETICS is the same menu INLINE`, async ({ page }) => {
    await boot(page, w, h);
    await navControl(page, 'shop').click();
    await page.locator('.sp2').waitFor({ state: 'visible' });
    await expect(page.locator('.sp2-tab')).toHaveCount(2);
    await expect(page.locator('.sp2-tab[data-shelf="looks"]')).toHaveCount(0); // no cosmetics screen in the shop
    const m = await layout(page, '.sp2-stock', '.sp2-tab, .sp2-timer');
    expect(m.overlaps, 'shop tab overlaps').toEqual([]);
    expect(m.outside, 'shop tabs inside the shelf').toEqual([]);
    expect(m.small, 'shop tabs ≥ 44px').toEqual([]);
    await expect(page.locator('.sp2-tab .sp2-tab-ico')).toHaveCount(2);
    // nov2 (Andy "idk why cosmetics screen on upgrades gives popup"): COSMETICS is a shelf — the CUSTOMIZE menu inline in
    // the shop, no popup over it; every tab's controls apart, inside the shelf, and the try-on never needs a scroll
    await page.locator('.sp2-tab[data-shelf="cosmetics"]').click();
    await expect(page.getByTestId('shop-cosmetics').getByTestId('customize')).toBeVisible();
    await expect(page.getByTestId('profile-popup')).toHaveCount(0);
    await expect(page.locator('.cz-tab[data-cz="pop"]')).toHaveAttribute('aria-selected', 'true');
    for (const [t, sel] of [['pop', '.sp2-look'], ['hero', '.hc'], ['frame', '.skp-tile, .skp-stage, .skp-act > *']]) { // WIN FX + SOUND retired nov2
      await page.locator(`.cz-tab[data-cz="${t}"]`).click();
      await page.waitForTimeout(400);
      const c = await layout(page, '.sp2-stock', `.sp2-tab, .cz-tab, ${sel}`);
      expect(c.overlaps, `shop COSMETICS · ${t}: overlaps`).toEqual([]);
      expect(c.outside, `shop COSMETICS · ${t}: inside the shelf`).toEqual([]);
      expect(c.small, `shop COSMETICS · ${t}: tap targets ≥ 44px`).toEqual([]);
      if (t === 'frame' && w >= 1000) {
        const sc = await page.locator('.sp2-shelf-cz .cz-body').evaluate((e) => e.scrollHeight - e.clientHeight);
        expect(sc, `shop COSMETICS · ${t}: the try-on fits without a scroll`).toBeLessThanOrEqual(1);
      }
    }
    // equipping here is equipping everywhere: wear a hero in the shop → the profile shows it
    await page.locator('.cz-tab[data-cz="hero"]').click();
    const owned = await page.evaluate(() => [...document.querySelectorAll('.hc[data-hero]')].map((e) => e.dataset.hero));
    expect(owned.length).toBeGreaterThan(1);
  });
}

// nov2 overlap audit #2 item 9: CUSTOMIZE → HERO tags never shrink under 16px on a phone (they wrap instead)
for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`${w}x${h}: CUSTOMIZE → HERO card tags stay ≥ 16px and inside their card`, async ({ page }) => {
    await boot(page, w, h);
    await page.locator('[data-nav="profile"]:visible').first().click();
    await page.getByTestId('profile-kit').click();
    await page.locator('.hc').first().waitFor();
    await page.waitForTimeout(400);
    const tags = await page.evaluate(() => [...document.querySelectorAll('.hc-req')].map((t) => {
      const span = t.querySelector('.hc-req-t');
      const px = parseFloat(getComputedStyle(span).fontSize);
      const m = getComputedStyle(span).transform;
      const k = m && m !== 'none' ? Number(m.split('(')[1].split(',')[0]) : 1;
      const r = t.getBoundingClientRect(); const c = t.closest('.hc').getBoundingClientRect();
      return { label: span.textContent, px: +(px * k).toFixed(1), inside: r.left >= c.left - 1 && r.right <= c.right + 1 };
    }));
    expect(tags.length).toBeGreaterThan(0);
    for (const t of tags) {
      expect(t.px, `${t.label}: drawn at ${t.px}px`).toBeGreaterThanOrEqual(16);
      expect(t.inside, `${t.label}: inside its card`).toBe(true);
    }
  });
}

// nov2 audit #14: ONE name source — a player with no name yet never shows "NO NAME YET" beside a title plate
test('no name yet: the title plate stands alone with the claim hint — never "NO NAME YET" next to a plate', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('nn.seeded')) return;
    sessionStorage.setItem('nn.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0.1, rc: 3, v: 10 }));
  });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.locator('[data-nav="profile"]:visible').first().click();
  const pf = page.getByTestId('profile-popup');
  await pf.waitFor({ state: 'visible' });
  await expect(pf).not.toContainText('NO NAME YET');
  await expect(pf.locator('.pf-hint')).toBeVisible();
  await expect(pf.locator('.pf-medal')).toHaveCount(3);
});
