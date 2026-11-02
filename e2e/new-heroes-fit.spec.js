// e2e/new-heroes-fit.spec.js — the newest crew heroes in the CUSTOMIZE menu (oct28 UI-done checklist): at 1366x768,
// 1920x1080 and 390x844 the hero's card sits in the grid with its painted face loaded, and its PREVIEW fits the screen:
// no scroll, nothing off screen, the hero art big, the top bar / the stage / the info column never overlapping, every
// control >= 44px. SHOTS=1 saves screenshots to claude/shots/new-heroes/.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

const NEW = ['buzz', 'zip'];
const OUT = 'claude/shots/new-heroes';
const shot = async (page, name) => { if (process.env.SHOTS) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: `${OUT}/${name}.png` }); } };
const seed = {
  'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seen.patch': PATCH_ID, 'taw.main': 'riot', 'taw.s2.heroes.gf': '1',
  'taw.gems': JSON.stringify({ v: 1, bal: 5000, peak: 12, streak: 0, mig: 1 }),
};
const hit = (a, b) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

for (const [w, h] of [[1366, 768], [1920, 1080], [390, 844]]) {
  for (const id of NEW) {
    test(`${id} ${w}x${h}: its CUSTOMIZE card + preview fit, big, nothing overlaps`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await installBackendMock(page);
      await page.addInitScript((s) => { if (sessionStorage.getItem('nh.seeded')) return; sessionStorage.setItem('nh.seeded', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed);
      await page.goto('/?portal=1');
      await menuReady(page);
      await page.locator('[data-nav="profile"]:visible').first().click();
      await page.getByTestId('profile-kit').click(); // CUSTOMIZE opens on its HERO tab
      const card = page.locator(`.hc[data-hero="${id}"]`);
      await card.scrollIntoViewIfNeeded();
      await expect(card).toBeVisible();
      await expect.poll(() => card.locator('img').first().evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
      await page.waitForTimeout(500);
      await shot(page, `${id}-${w}x${h}-1-grid`);
      await card.click();
      const pv = page.getByTestId('hero-preview');
      await expect(pv).toHaveAttribute('data-hero', id);
      await expect.poll(() => pv.locator('.hpv-art img, img.hpv-art').first().evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
      await page.waitForTimeout(800);
      await shot(page, `${id}-${w}x${h}-2-preview`);
      const m = await page.evaluate(() => {
        const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; };
        const small = [...document.querySelectorAll('[data-testid="hero-preview"] button')].filter((b) => b.offsetParent)
          .map((b) => { const r = b.getBoundingClientRect(); return { t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30), w: r.width, h: r.height }; })
          .filter((r) => r.w < 44 || r.h < 44);
        return { pv: box('[data-testid="hero-preview"]'), top: box('.hpv-top'), stage: box('.hpv-stage'), right: box('.hpv-right'), hero: box('.hpv-hero'),
          scroll: document.documentElement.scrollHeight - innerHeight, small };
      });
      expect(m.scroll, 'the page scrolls').toBeLessThanOrEqual(0);
      for (const k of ['top', 'stage', 'right']) {
        expect(m[k], `${k} missing`).toBeTruthy();
        expect(m[k].x, `${k} off screen`).toBeGreaterThanOrEqual(-0.5);
        expect(m[k].x + m[k].width, `${k} off screen`).toBeLessThanOrEqual(w + 0.5);
      }
      expect(hit(m.top, m.stage), 'top bar overlaps the stage').toBe(false);
      expect(hit(m.stage, m.right), 'the stage overlaps the info column').toBe(false);
      expect(m.hero.height, 'the hero art is small').toBeGreaterThanOrEqual(Math.min(h, 844) * 0.28);
      expect(m.small, 'preview controls under 44px').toEqual([]);
    });
  }
}
