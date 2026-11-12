// e2e/legal-pages.spec.js — PRIVACY + TERMS (nov4: Google won't publish the OAuth app without a homepage + privacy URL).
// Static pages, public/privacy/index.html + public/terms/index.html: on Vercel the filesystem is matched before the SPA
// rewrite (routeShadow.test.js), so /privacy and /terms serve these files with no vercel.json change. Here (vite preview)
// the files are opened by their real path. At 1366 and 390: the facts the policy must state are on the page, nothing
// runs off the side, the body text is readable; CREDITS links to both. SHOTS=<dir> saves each page.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SHOTS = process.env.SHOTS;
const PAGES = {
  privacy: ['andywang1648@gmail.com', 'EFFECTIVE NOVEMBER 3, 2026', 'Stripe', 'never see or store card numbers', 'cookieless', 'AdSense', 'do not sell', 'under 13', 'Reset account', 'Supabase Auth'],
  terms: ['no cash value', '$20 a month', 'Refunds', 'Fair play', "a parent's permission to buy", 'Privacy Policy'],
};

for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  for (const [name, facts] of Object.entries(PAGES)) {
    test(`@${vp.width}: /${name} — the page, its facts, readable, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize(vp);
      const r = await page.goto(`/${name}/index.html`);
      expect(r.status()).toBe(200);
      await expect(page.locator('h1')).toHaveText(name.toUpperCase());
      const text = await page.locator('main').innerText();
      for (const f of facts) expect(text.toLowerCase(), `${name} says "${f}"`).toContain(f.toLowerCase());
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        small: [...document.querySelectorAll('main p, main li')].filter((n) => parseFloat(getComputedStyle(n).fontSize) < 14).length,
      }));
      expect(m.sw, 'no horizontal scroll').toBeLessThanOrEqual(m.cw);
      expect(m.small, 'body text ≥ 14px').toBe(0);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-${vp.width}.png`, fullPage: true });
    });
  }
}

test('CREDITS links to PRIVACY and TERMS', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
  });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.locator('[data-nav="settings"]:visible').first().click();
  await page.locator('.sp-credits').click();
  await expect(page.getByTestId('credits-privacy')).toHaveAttribute('href', '/privacy');
  await expect(page.getByTestId('credits-terms')).toHaveAttribute('href', '/terms');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/credits-1366.png` });
});
